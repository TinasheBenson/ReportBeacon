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
  SEATS, CATALOG, ACCOUNTS, PLATFORMS,
  type Account, type Seat, type PlatformId, type RoleId,
} from '@/lib/data'
import {
  defaultRules, evaluateAll, type AlertRule, type AlertInstance, type AlertStatus,
} from '@/lib/alerts'

/** An evaluated alert with its persisted lifecycle status applied. */
export type LiveAlert = AlertInstance & { status: AlertStatus }

export type Member = Seat

export interface Brand { agencyName: string; accent: string; logo: string | null }
export type Freq = 'off' | 'weekly' | 'monthly'
export interface Schedule { freq: Freq; recipient: string }

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
}

// Demo opens under a neutral placeholder brand so a prospect reads it as
// their own agency, then rebrands it live on the Branding screen.
const DEFAULT_BRAND: Brand = { agencyName: 'Your Agency', accent: '#4a3aa7', logo: null }

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
      brand: { ...base.brand, ...(p.brand ?? {}) },
      schedules: p.schedules ?? base.schedules,
      alertRules: p.alertRules ?? base.alertRules,
      alertStatus: p.alertStatus ?? base.alertStatus,
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
  addMember: (name: string) => string
  removeMember: (id: string) => void
  assignClient: (clientId: string, memberId: string) => void
  importClient: (clientId: string, ownerId?: string) => void
  archiveClient: (clientId: string) => void
  restoreClient: (clientId: string) => void
  connectProvider: (id: PlatformId) => void
  disconnectProvider: (id: PlatformId) => void
  setBrand: (patch: Partial<Brand>) => void
  brandMonogram: string
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
    const isLive = (a: Account) => state.importedIds.includes(a.id) && !state.archivedIds.includes(a.id)
    const clients = CATALOG.filter(isLive)
    const me = state.members.find((m) => m.id === seatId) ?? null
    const role: RoleId = me?.role ?? 'manager'

    const managerFor = (clientId: string) => {
      const owner = state.ownerById[clientId]
      return owner ? state.members.find((m) => m.id === owner) : undefined
    }
    const accountsForSeat = (m: Member) =>
      m.role === 'owner' ? clients : clients.filter((c) => state.ownerById[c.id] === m.id)
    const canSee = (m: Member, clientId: string) =>
      m.role === 'owner' || state.ownerById[clientId] === m.id

    const applyStatus = (list: AlertInstance[]): LiveAlert[] =>
      list.map((al) => ({ ...al, status: state.alertStatus[al.id]?.status ?? 'open' }))

    return {
      ...state,
      me, role, isAdmin: role === 'owner',
      clients,
      getClient: (id) => CATALOG.find((a) => a.id === id),
      managerFor,
      accountsForSeat,
      canSee,
      unassigned: clients.filter((c) => !state.ownerById[c.id]),
      archivedClients: CATALOG.filter((a) => state.archivedIds.includes(a.id)),
      importable: CATALOG.filter((a) => !state.importedIds.includes(a.id) && !state.archivedIds.includes(a.id)),
      clientCount: (memberId) => clients.filter((c) => state.ownerById[c.id] === memberId).length,

      addMember: (name) => {
        const id = 'm-' + Date.now().toString(36)
        const member: Member = { id, name, initials: initials(name), role: 'manager', title: 'Account manager', accountIds: [] }
        save({ ...state, members: [...state.members, member] })
        return id
      },
      removeMember: (id) => {
        const ownerById = { ...state.ownerById }
        for (const k of Object.keys(ownerById)) if (ownerById[k] === id) ownerById[k] = ''
        save({ ...state, members: state.members.filter((m) => m.id !== id), ownerById })
      },
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
      brandMonogram: initials(state.brand.agencyName),
      setSchedule: (clientId, s) => patch({ schedules: { ...state.schedules, [clientId]: s } }),
      scheduledFor: (m) => {
        const scope = m.role === 'owner' ? clients : clients.filter((c) => state.ownerById[c.id] === m.id)
        return scope
          .map((client) => ({ client, schedule: state.schedules[client.id] }))
          .filter((r): r is { client: Account; schedule: Schedule } => !!r.schedule && r.schedule.freq !== 'off')
          .map((r) => ({ ...r, nextSend: nextSend(r.schedule.freq) }))
          .sort((a, b) => a.nextSend.getTime() - b.nextSend.getTime())
      },

      alerts: (accounts) => {
        const list = applyStatus(evaluateAll(accounts, state.alertRules))
        // Keep severity order (from evaluateAll), sink resolved to the bottom.
        return [...list].sort((a, b) => (a.status === 'resolved' ? 1 : 0) - (b.status === 'resolved' ? 1 : 0))
      },
      openAlerts: (accounts) =>
        applyStatus(evaluateAll(accounts, state.alertRules)).filter((a) => a.status !== 'resolved'),
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
