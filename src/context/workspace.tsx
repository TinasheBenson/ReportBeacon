/**
 * Workspace store: the live agency state that admins and managers change.
 *
 * When signed in, the store hydrates from the API — the client roster from
 * GET /api/clients and the persisted workspace blob from GET /api/workspace —
 * and every change is written back (debounced PUT), so the workspace behaves
 * like a real multi-seat product across reloads and devices. Without a session
 * (the public landing / offline) it falls back to a seeded localStorage copy.
 */
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useApp } from '@/context/app'
import {
  SEATS, ACCOUNTS, CATALOG, PLATFORMS,
  type Account, type Seat, type PlatformId, type RoleId,
} from '@/lib/data'
import { defaultRules, type AlertRule, type AlertStatus } from '@/lib/alerts'
import { api as dataApi, type LiveAlert } from '@/lib/api'
import { apiClient } from '@/lib/apiClient'

export type { LiveAlert }

export type Member = Seat

export interface Palette { base: string | null; accent: string }
export interface Brand {
  agencyName: string
  logo: string | null
  performance: Palette
  social: Palette
}
export type WorkspaceMode = 'performance' | 'social' | 'both'
export type Freq = 'off' | 'weekly' | 'monthly'
export interface Schedule { freq: Freq; recipient: string }
export interface Invitation { id: string; email: string; role: RoleId; token: string; createdAt: string; status: 'pending' | 'accepted' }

function titleFor(role: RoleId): string {
  return role === 'viewer' ? 'Viewer · read-only' : 'Account manager'
}

interface Persisted {
  members: Member[]
  ownerById: Record<string, string>
  importedIds: string[]
  archivedIds: string[]
  connections: Record<PlatformId, boolean>
  brand: Brand
  schedules: Record<string, Schedule>
  alertRules: AlertRule[]
  alertStatus: Record<string, { status: AlertStatus; at: string }>
  invitations: Invitation[]
  mode: WorkspaceMode
}

const DEFAULT_BRAND: Brand = {
  agencyName: 'Your Agency', logo: null,
  performance: { base: null, accent: '#4a3aa7' },
  social: { base: '#1d4ed8', accent: '#3b82f6' },
}
const LEGACY_SOCIAL = { base: '#12b886', accent: '#fd7e14' }

function migrateBrand(p: any): Brand {
  if (!p || typeof p !== 'object') return DEFAULT_BRAND
  const name = typeof p.agencyName === 'string' ? p.agencyName : DEFAULT_BRAND.agencyName
  const logo = typeof p.logo === 'string' ? p.logo : null
  if (p.performance && p.social) {
    const social = { base: p.social.base ?? DEFAULT_BRAND.social.base, accent: p.social.accent ?? DEFAULT_BRAND.social.accent }
    const isLegacy = (social.base ?? '').toLowerCase() === LEGACY_SOCIAL.base && (social.accent ?? '').toLowerCase() === LEGACY_SOCIAL.accent
    return {
      agencyName: name, logo,
      performance: { base: p.performance.base ?? null, accent: p.performance.accent ?? DEFAULT_BRAND.performance.accent },
      social: isLegacy ? { ...DEFAULT_BRAND.social } : social,
    }
  }
  return {
    agencyName: name, logo,
    performance: { base: null, accent: typeof p.accent === 'string' ? p.accent : DEFAULT_BRAND.performance.accent },
    social: { ...DEFAULT_BRAND.social },
  }
}

export function nextSend(freq: Freq): Date {
  const d = new Date()
  if (freq === 'weekly') { d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)) }
  else { d.setMonth(d.getMonth() + 1, 1) }
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

/** Merge a partial (localStorage or server) blob over a fresh seed. */
function mergePersisted(p: Partial<Persisted> | null | undefined): Persisted {
  const base = seed()
  if (!p || typeof p !== 'object') return base
  return {
    members: Array.isArray(p.members) ? p.members : base.members,
    ownerById: p.ownerById ?? base.ownerById,
    importedIds: Array.isArray(p.importedIds) ? p.importedIds : base.importedIds,
    archivedIds: Array.isArray(p.archivedIds) ? p.archivedIds : base.archivedIds,
    connections: { ...base.connections, ...(p.connections ?? {}) },
    brand: migrateBrand(p.brand),
    schedules: p.schedules ?? base.schedules,
    alertRules: Array.isArray(p.alertRules) ? p.alertRules : base.alertRules,
    alertStatus: p.alertStatus ?? base.alertStatus,
    invitations: Array.isArray(p.invitations) ? p.invitations : base.invitations,
    mode: p.mode ?? base.mode,
  }
}

function load(): Persisted {
  try {
    const raw = localStorage.getItem('rb-ws')
    if (!raw) return seed()
    return mergePersisted(JSON.parse(raw) as Partial<Persisted>)
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
  canWrite: boolean
  clients: Account[]
  getClient: (id: string) => Account | undefined
  managerFor: (clientId: string) => Member | undefined
  accountsForSeat: (m: Member) => Account[]
  canSee: (m: Member, clientId: string) => boolean
  unassigned: Account[]
  archivedClients: Account[]
  importable: Account[]
  clientCount: (memberId: string) => number
  addMember: (name: string, role?: RoleId) => string
  removeMember: (id: string) => void
  setMemberRole: (id: string, role: RoleId) => void
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
  alerts: (accounts: Account[]) => LiveAlert[]
  openAlerts: (accounts: Account[]) => LiveAlert[]
  setAlertStatus: (id: string, status: AlertStatus) => void
  addAlertRule: (rule: AlertRule) => void
  updateAlertRule: (id: string, patch: Partial<AlertRule>) => void
  deleteAlertRule: (id: string) => void
  upsertClient: (account: Account) => void
  removeClient: (id: string) => void
  resetWorkspace: () => void
}

const Ctx = createContext<WorkspaceApi | null>(null)

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { seatId, user } = useApp()
  const [state, setState] = useState<Persisted>(load)
  const [catalog, setCatalog] = useState<Account[]>(() => CATALOG)
  const putTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Hydrate the roster + persisted blob from the API once a session exists.
  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      try {
        const [ws, cl] = await Promise.all([
          apiClient.getWorkspace().catch(() => null),
          apiClient.getClients().catch(() => null),
        ])
        if (cancelled) return
        if (cl && Array.isArray(cl.clients) && cl.clients.length) setCatalog(cl.clients as Account[])
        if (ws && ws.state && Object.keys(ws.state).length) setState(mergePersisted(ws.state as Partial<Persisted>))
      } catch { /* keep local seed */ }
    })()
    return () => { cancelled = true }
  }, [user])

  const save = (next: Persisted) => {
    setState(next)
    try { localStorage.setItem('rb-ws', JSON.stringify(next)) } catch { /* private mode */ }
    if (user) {
      if (putTimer.current) clearTimeout(putTimer.current)
      putTimer.current = setTimeout(() => { apiClient.putWorkspace(next as any).catch(() => {}) }, 600)
    }
  }
  const patch = (p: Partial<Persisted>) => save({ ...state, ...p })

  const api = useMemo<WorkspaceApi>(() => {
    const clients = dataApi.listClients(state, catalog)
    const meRaw = state.members.find((m) => m.id === seatId) ?? null
    // Overlay the real signed-in identity onto the seat used for scoping.
    const me: Member | null = meRaw && user
      ? { ...meRaw, name: user.name || meRaw.name, initials: initials(user.name || user.email) }
      : meRaw
    const role: RoleId = meRaw?.role ?? 'manager'
    const seesAll = (m: Member) => m.role === 'owner' || m.role === 'viewer'

    const managerFor = (clientId: string) => {
      const owner = state.ownerById[clientId]
      return owner ? state.members.find((m) => m.id === owner) : undefined
    }
    const accountsForSeat = (m: Member) => dataApi.scopedClients(state, m, catalog)
    const canSee = (m: Member, clientId: string) => seesAll(m) || state.ownerById[clientId] === m.id

    return {
      ...state,
      me, role, isAdmin: role === 'owner', canWrite: role !== 'viewer',
      clients,
      getClient: (id) => dataApi.clientById(catalog, id),
      managerFor,
      accountsForSeat,
      canSee,
      unassigned: clients.filter((c) => !state.ownerById[c.id]),
      archivedClients: dataApi.archivedClients(state, catalog),
      importable: dataApi.importableClients(state, catalog),
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
        return [...list].sort((a, b) => (a.status === 'resolved' ? 1 : 0) - (b.status === 'resolved' ? 1 : 0))
      },
      openAlerts: (accounts) => dataApi.evaluateAlerts(state, accounts).filter((a) => a.status !== 'resolved'),
      setAlertStatus: (id, status) =>
        patch({ alertStatus: { ...state.alertStatus, [id]: { status, at: new Date().toISOString() } } }),
      addAlertRule: (rule) => patch({ alertRules: [...state.alertRules, rule] }),
      updateAlertRule: (id, p) => patch({ alertRules: state.alertRules.map((r) => (r.id === id ? { ...r, ...p } : r)) }),
      deleteAlertRule: (id) => patch({ alertRules: state.alertRules.filter((r) => r.id !== id) }),

      upsertClient: (account) => {
        setCatalog((prev) => (prev.some((c) => c.id === account.id) ? prev.map((c) => (c.id === account.id ? account : c)) : [...prev, account]))
        if (!state.importedIds.includes(account.id)) {
          save({ ...state, importedIds: [...state.importedIds, account.id], archivedIds: state.archivedIds.filter((x) => x !== account.id) })
        }
        if (user) apiClient.upsertClient(account as any).catch(() => {})
      },
      removeClient: (id) => {
        setCatalog((prev) => prev.filter((c) => c.id !== id))
        const ownerById = { ...state.ownerById }; delete ownerById[id]
        save({ ...state, importedIds: state.importedIds.filter((x) => x !== id), archivedIds: state.archivedIds.filter((x) => x !== id), ownerById })
        if (user) apiClient.deleteClient(id).catch(() => {})
      },

      resetWorkspace: () => save(seed()),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, catalog, seatId, user])

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}

export function useWorkspace(): WorkspaceApi {
  const v = useContext(Ctx)
  if (!v) throw new Error('useWorkspace outside provider')
  return v
}
