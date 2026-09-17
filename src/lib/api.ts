/**
 * Data-access layer — the single seam between the app and where its data lives.
 *
 * The client roster (the catalog) is loaded from the backend (GET /api/clients)
 * and passed in by the workspace store, so this module is pure: it filters and
 * scopes the roster the store hydrated. Alerts and overview totals are computed
 * from the same rows.
 */
import {
  portfolioTotals, serviceHealthFor,
  type Account, type Seat, type RangeId, type ServiceHealth,
} from './data'
import { evaluateAll, type AlertRule, type AlertInstance, type AlertStatus } from './alerts'

/** The slice of persisted workspace state the query layer needs. */
export interface DataState {
  ownerById: Record<string, string>
  importedIds: string[]
  archivedIds: string[]
  alertRules: AlertRule[]
  alertStatus: Record<string, { status: AlertStatus; at: string }>
}

export type LiveAlert = AlertInstance & { status: AlertStatus }

const seesAll = (m: Seat) => m.role === 'owner' || m.role === 'viewer'

export const api = {
  /** GET /clients — the live roster (imported, not archived). */
  listClients(s: DataState, catalog: Account[]): Account[] {
    return catalog.filter((a) => s.importedIds.includes(a.id) && !s.archivedIds.includes(a.id))
  },

  /** GET /clients/:id */
  clientById(catalog: Account[], id: string): Account | undefined {
    return catalog.find((a) => a.id === id)
  },

  /** GET /clients?seat=:id — the roster a seat is allowed to see. */
  scopedClients(s: DataState, m: Seat, catalog: Account[]): Account[] {
    const clients = api.listClients(s, catalog)
    return seesAll(m) ? clients : clients.filter((c) => s.ownerById[c.id] === m.id)
  },

  /** GET /clients?status=archived */
  archivedClients(s: DataState, catalog: Account[]): Account[] {
    return catalog.filter((a) => s.archivedIds.includes(a.id))
  },

  /** GET /platforms/accounts?imported=false — discoverable, not yet imported. */
  importableClients(s: DataState, catalog: Account[]): Account[] {
    return catalog.filter((a) => !s.importedIds.includes(a.id) && !s.archivedIds.includes(a.id))
  },

  /** GET /clients/:id/services — per-service health. */
  serviceHealth(catalog: Account[], id: string): ServiceHealth[] {
    const a = api.clientById(catalog, id)
    return a ? serviceHealthFor(a) : []
  },

  /** GET /overview — roster totals for the range. */
  overview(accounts: Account[], range: RangeId) {
    return portfolioTotals(range, accounts)
  },

  /** GET /alert-rules */
  alertRules(s: DataState): AlertRule[] {
    return s.alertRules
  },

  /** GET /alerts — rules evaluated against the accounts, lifecycle applied. */
  evaluateAlerts(s: DataState, accounts: Account[]): LiveAlert[] {
    return evaluateAll(accounts, s.alertRules).map((al) => ({
      ...al,
      status: s.alertStatus[al.id]?.status ?? 'open',
    }))
  },
}
