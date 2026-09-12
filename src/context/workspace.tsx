/**
 * Workspace store: the live agency state that admins and managers change.
 *
 * Clients are not typed in — they are imported from connected platforms
 * (see connectProvider / importClient). Ownership, the imported roster, the
 * archive and the team all live here and persist to localStorage, so the demo
 * behaves like a real multi-seat workspace within one browser.
 */
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { useApp } from '@/context/app'
import {
  SEATS, ACCOUNTS, PLATFORMS,
  type Account, type Seat, type PlatformId, type RoleId,
} from '@/lib/data'
import { defaultRules, type AlertRule, type AlertStatus } from '@/lib/alerts'
import { api as dataApi, type LiveAlert } from '@/lib/api'

export type { LiveAlert }

export type Member = Seat

/** A face's palette: a ground/dashboard tint (null = the neutral default) and
 *  a highlight/accent colour. */
export interface Palette { base: string | null; accent: string }
export interface Brand {
  agencyName: string
  logo: string | null
  performance: Palette
  social: Palette
}
/** What the workspace reports on. 'both' shows a Performance/Social switch. */
export type WorkspaceMode = 'performance' | 'social' | 'both'
export type Freq = 'off' | 'weekly' | 'monthly'
export interface Schedule { freq: Freq; recipient: string }
export interface Invitation { id: string; email: string; role: RoleId; token: string; createdAt: string; status: 'pending' | 'accepted' }

function titleFor(role: RoleId): string {
  return role === 'viewer' ? 'Viewer · read-only' : 'Account manager'
}

interface Persisted {
  members: Member[]
  ownerById: Record<string, string> // clientId -> memberId ('' = unassigned)
  importedIds: string[]
  archivedIds: string[]
  connections: Record<PlatformId, boolean>
  brand: Brand
  schedules: Record<string, Schedule> // clientId -> schedule
  alertRules: AlertRule[]
  alertStatus: Record<string, { status: AlertStatus; at: string }> // alertId -> lifecycle
  invitations: Invitation[]
  mode: WorkspaceMode
}

// Demo opens under a neutral placeholder brand so a prospect reads it as
// their own agency, then rebrands it live on the Branding screen.
const DEFAULT_BRAND: Brand = {
  agencyName: 'Your Agency', logo: null,
  // Performance keeps the neutral navigation (base null) with the indigo highlight.
  performance: { base: null, accent: '#4a3aa7' },
  // Social gets its own identity out of the box: a blue navigation rail with a
  // bright blue highlight. The content area stays white — only the chrome
  // (sidebar + accents) carries the colour, so the two faces read apart at a
  // glance even in light mode.
  social: { base: '#1d4ed8', accent: '#3b82f6' },
}
// The earlier mint/orange Social default, so returning demo sessions that never
// customised the Social face are lifted to the new blue identity on load.
const LEGACY_SOCIAL = { base: '#12b886', accent: '#fd7e14' }

/** Accept both the current per-face shape and the older single-accent brand. */
function migrateBrand(p: any): Brand {
  if (!p || typeof p !== 'object') return DEFAULT_BRAND
  const name = typeof p.agencyName === 'string' ? p.agencyName : DEFAULT_BRAND.agencyName
  const logo = typeof p.logo === 'string' ? p.logo : null
  if (p.performance && p.social) {
    const social = { base: p.social.base ?? DEFAULT_BRAND.social.base, accent: p.social.accent ?? DEFAULT_BRAND.social.accent }
    // Lift the old mint/orange default to the new blue one; keep any custom choice.
    const isLegacy = (social.base ?? '').toLowerCase() === LEGACY_SOCIAL.base && (social.accent ?? '').toLowerCase() === LEGACY_SOCIAL.accent
    return {
      agencyName: name, logo,
      performance: { base: p.performance.base ?? null, accent: p.performance.accent ?? DEFAULT_BRAND.performance.accent },
      social: isLegacy ? { ...DEFAULT_BRAND.social } : social,
    }
  }
  // Older shape: { agencyName, accent, logo }.
  return {
    agencyName: name, logo,
    performance: { base: null, accent: typeof p.accent === 'string' ? p.accent : DEFAULT_BRAND.performance.accent },
    social: { ...DEFAULT_BRAND.social },
  }
}

/** When the next automatic send lands: weekly → next Monday, monthly → 1st, both at 9am. */
export function nextSend(freq: Freq): Date {
  const d = new Date()
  if (freq === 'weekly') { d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)) } // next Monday
  else { d.setMonth(d.getMonth() + 1, 1) } // 1st of next month
  d.setHours(9, 0, 0, 0)
  return d
}

function seed(): Persisted {
  const ownerById: Record<string, string> = {}
  for (const s of SEATS) for (const cid of s.accountIds) ownerById[cid] = s.id
  const connections = Object.fromEntries(PLATFORMS.map((p) => [p.id, true])) as Record<PlatformId, boolean>
  return {
    members: SEATS.map((s) => ({ ...s, accountIds: [] })),
    ownerById,
    importedIds: ACCOUNTS.map((a) => a.id),
    archivedIds: [],
    connections,
    brand: DEFAULT_BRAND,
    schedules: {},
    alertRules: defaultRules(),
    alertStatus: {},
    invitations: [],
    mode: 'both',
  }
}

function load(): Persisted {
  try {
    const raw = localStorage.getItem('rb-ws')
    if (!raw) return seed()
    const p = JSON.parse(raw) as Partial<Persisted>
    const base = seed()
    return {
      members: p.members ?? base.members,
      ownerById: p.ownerById ?? base.ownerById,
      importedIds: p.importedIds ?? base.importedIds,
      archivedIds: p.archivedIds ?? base.archivedIds,
      connections: { ...base.connections, ...(p.connections ?? {}) },
      brand: migrateBrand(p.brand),
      schedules: p.schedules ?? base.schedules,
      alertRules: p.alertRules ?? base.alertRules,
      alertStatus: p.alertStatus ?? base.alertStatus,
      invitations: p.invitations ?? base.invitations,
      mode: p.mode ?? base.mode,
    }
  } catch {
    return seed()
  }
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'AM'
}

interface WorkspaceApi extends Persisted {
  me: Member | null
  role: RoleId
  isAdmin: boolean
  canWrite: boolean // false for viewers (read-only)
  // reads
  clients: Account[] // live roster (imported, not archived)
  getClient: (id: string) => Account | undefined
  managerFor: (clientId: string) => Member | undefined
  accountsForSeat: (m: Member) => Account[]
  canSee: (m: Member, clientId: string) => boolean
  unassigned: Account[]
  archivedClients: Account[]
  importable: Account[] // discoverable, not yet imported
  clientCount: (memberId: string) => number
  // mutations
  addMember: (name: string, role?: RoleId) => string
  removeMember: (id: string) => void
  setMemberRole: (id: string, role: RoleId) => void
  // invitations
  invitations: Invitation[]
  invite: (email: string, role: RoleId) => Invitation
  acceptInvite: (token: string, name: string) => string | null
  revokeInvite: (id: string) => void
  assignClient: (clientId: string, memberId: string) => void
  importClient: (clientId: string, ownerId?: string) => void
  archiveClient: (clientId: string) => void
  restoreClient: (clientId: string) => void
  connectProvider: (id: PlatformId) => void
  disconnectProvider: (id: PlatformId) => void
  setBrand: (patch: Partial<Pick<Brand, 'agencyName' | 'logo'>>) => void
  setPalette: (face: 'performance' | 'social', patch: Partial<Palette>) => void
  brandMonogram: string
  setMode: (m: WorkspaceMode) => void
  setSchedule: (clientId: string, s: Schedule) => void
  scheduledFor: (m: Member) => { client: Account; schedule: Schedule; nextSend: Date }[]
  // alert rules + lifecycle
  alerts: (accounts: Account[]) => LiveAlert[]
  openAlerts: (accounts: Account[]) => LiveAlert[]
  setAlertStatus: (id: string, status: AlertStatus) => void
  addAlertRule: (rule: AlertRule) => void
  updateAlertRule: (id: string, patch: Partial<AlertRule>) => void
  deleteAlertRule: (id: string) => void
  resetWorkspace: () => void
}

const Ctx = createContext<WorkspaceApi | null>(null)

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { seatId } = useApp()
  const [state, setState] = useState<Persisted>(load)

  const save = (next: Persisted) => {
    setState(next)
    try { localStorage.setItem('rb-ws', JSON.stringify(next)) } catch { /* private mode */ }
  }
  const patch = (p: Partial<Persisted>) => save({ ...state, ...p })

  const api = useMemo<WorkspaceApi>(() => {
    const clients = dataApi.listClients(state)
    const me = state.members.find((m) => m.id === seatId) ?? null
    const role: RoleId = me?.role ?? 'manager'
    // Owners and viewers see the whole agency; managers see only their book.
    // Viewers see everything but change nothing (canWrite === false).
    const seesAll = (m: Member) => m.role === 'owner' || m.role === 'viewer'

    const managerFor = (clientId: string) => {
      const owner = state.ownerById[clientId]
      return owner ? state.members.find((m) => m.id === owner) : undefined
    }
    const accountsForSeat = (m: Member) => dataApi.scopedClients(state, m)
    const canSee = (m: Member, clientId: string) =>
      seesAll(m) || state.ownerById[clientId] === m.id

    return {
      ...state,
      me, role, isAdmin: role === 'owner', canWrite: role !== 'viewer',
      clients,
      getClient: (id) => dataApi.clientById(id),
      managerFor,
      accountsForSeat,
      canSee,
      unassigned: clients.filter((c) => !state.ownerById[c.id]),
      archivedClients: dataApi.archivedClients(state),
      importable: dataApi.importableClients(state),
      clientCount: (memberId) => clients.filter((c) => state.ownerById[c.id] === memberId).length,

      addMember: (name, memberRole = 'manager') => {
        const id = 'm-' + Date.now().toString(36)
        const member: Member = { id, name, initials: initials(name), role: memberRole, title: titleFor(memberRole), accountIds: [] }
        save({ ...state, members: [...state.members, member] })
        return id
      },
      removeMember: (id) => {
        const ownerById = { ...state.ownerById }
        for (const k of Object.keys(ownerById)) if (ownerById[k] === id) ownerById[k] = ''
        save({ ...state, members: state.members.filter((m) => m.id !== id), ownerById })
      },
      setMemberRole: (id, memberRole) =>
        patch({ members: state.members.map((m) => (m.id === id ? { ...m, role: memberRole, title: titleFor(memberRole) } : m)) }),

      invite: (email, inviteRole) => {
        const inv: Invitation = {
          id: 'inv-' + Date.now().toString(36), email: email.trim(), role: inviteRole,
          token: Math.random().toString(36).slice(2, 10), createdAt: new Date().toISOString(), status: 'pending',
        }
        save({ ...state, invitations: [...state.invitations, inv] })
        return inv
      },
      acceptInvite: (token, name) => {
        const inv = state.invitations.find((i) => i.token === token && i.status === 'pending')
        if (!inv) return null
        const id = 'm-' + Date.now().toString(36)
        const nm = name.trim() || inv.email
        const member: Member = { id, name: nm, initials: initials(nm), role: inv.role, title: titleFor(inv.role), accountIds: [] }
        save({
          ...state,
          members: [...state.members, member],
          invitations: state.invitations.map((i) => (i.id === inv.id ? { ...i, status: 'accepted' } : i)),
        })
        return id
      },
      revokeInvite: (id) => patch({ invitations: state.invitations.filter((i) => i.id !== id) }),
      assignClient: (clientId, memberId) => patch({ ownerById: { ...state.ownerById, [clientId]: memberId } }),
      importClient: (clientId, ownerId = '') =>
        save({
          ...state,
          importedIds: state.importedIds.includes(clientId) ? state.importedIds : [...state.importedIds, clientId],
          archivedIds: state.archivedIds.filter((x) => x !== clientId),
          ownerById: { ...state.ownerById, [clientId]: ownerId },
        }),
      archiveClient: (clientId) => patch({ archivedIds: [...state.archivedIds, clientId] }),
      restoreClient: (clientId) => patch({ archivedIds: state.archivedIds.filter((x) => x !== clientId) }),
      connectProvider: (id) => patch({ connections: { ...state.connections, [id]: true } }),
      disconnectProvider: (id) => patch({ connections: { ...state.connections, [id]: false } }),

      setBrand: (p) => patch({ brand: { ...state.brand, ...p } }),
      setPalette: (f, p) => patch({ brand: { ...state.brand, [f]: { ...state.brand[f], ...p } } }),
      brandMonogram: initials(state.brand.agencyName),
      setMode: (m) => patch({ mode: m }),
      setSchedule: (clientId, s) => patch({ schedules: { ...state.schedules, [clientId]: s } }),
      scheduledFor: (m) => {
        const scope = seesAll(m) ? clients : clients.filter((c) => state.ownerById[c.id] === m.id)
        return scope
          .map((client) => ({ client, schedule: state.schedules[client.id] }))
          .filter((r): r is { client: Account; schedule: Schedule } => !!r.schedule && r.schedule.freq !== 'off')
          .map((r) => ({ ...r, nextSend: nextSend(r.schedule.freq) }))
          .sort((a, b) => a.nextSend.getTime() - b.nextSend.getTime())
      },

      alerts: (accounts) => {
        const list = dataApi.evaluateAlerts(state, accounts)
        // Keep severity order (from the engine), sink resolved to the bottom.
        return [...list].sort((a, b) => (a.status === 'resolved' ? 1 : 0) - (b.status === 'resolved' ? 1 : 0))
      },
      openAlerts: (accounts) => dataApi.evaluateAlerts(state, accounts).filter((a) => a.status !== 'resolved'),
      setAlertStatus: (id, status) =>
        patch({ alertStatus: { ...state.alertStatus, [id]: { status, at: new Date().toISOString() } } }),
      addAlertRule: (rule) => patch({ alertRules: [...state.alertRules, rule] }),
      updateAlertRule: (id, p) => patch({ alertRules: state.alertRules.map((r) => (r.id === id ? { ...r, ...p } : r)) }),
      deleteAlertRule: (id) => patch({ alertRules: state.alertRules.filter((r) => r.id !== id) }),

      resetWorkspace: () => save(seed()),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, seatId])

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}

export function useWorkspace(): WorkspaceApi {
  const v = useContext(Ctx)
  if (!v) throw new Error('useWorkspace outside provider')
  return v
}
