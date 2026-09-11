/**
 * Data-access layer — the single seam between the app and where its data lives.
 *
 * Every read the app performs goes through this module. Today each function
 * resolves against the in-browser workspace state and the static catalog;
 * turning ReportBeacon into a real product means changing only this file — each
 * function becomes a `fetch` to the matching endpoint (the async signatures are
 * noted per function) with no change to the store or the UI above it. The store
 * (context/workspace) owns state and mutations; this owns queries.
 */
import {
  CATALOG, portfolioTotals, serviceHealthFor,
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
  listClients(s: DataState): Account[] {
    return CATALOG.filter((a) => s.importedIds.includes(a.id) && !s.archivedIds.includes(a.id))
  },

  /** GET /clients/:id */
  clientById(id: string): Account | undefined {
    return CATALOG.find((a) => a.id === id)
  },

  /** GET /clients?seat=:id — the roster a seat is allowed to see. */
  scopedClients(s: DataState, m: Seat): Account[] {
    const clients = api.listClients(s)
    return seesAll(m) ? clients : clients.filter((c) => s.ownerById[c.id] === m.id)
  },

  /** GET /clients?status=archived */
  archivedClients(s: DataState): Account[] {
    return CATALOG.filter((a) => s.archivedIds.includes(a.id))
  },

  /** GET /platforms/accounts?imported=false — discoverable, not yet imported. */
  importableClients(s: DataState): Account[] {
    return CATALOG.filter((a) => !s.importedIds.includes(a.id) && !s.archivedIds.includes(a.id))
  },

  /** GET /clients/:id/services — per-service health. */
  serviceHealth(id: string): ServiceHealth[] {
    const a = api.clientById(id)
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
