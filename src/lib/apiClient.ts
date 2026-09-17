/**
 * API client — the single fetch seam to the ReportBeacon backend. Same-origin by
 * default (the /api paths are proxied to the server); set VITE_API_BASE to point
 * at a separate API origin (e.g. the Railway deployment) if the app and API are
 * split across domains. Always sends the session cookie.
 */
const BASE = (import.meta as any).env?.VITE_API_BASE ?? ''

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  })
  const text = await res.text()
  const data = text ? JSON.parse(text) : {}
  if (!res.ok) throw new Error((data && data.error) || `Request failed (${res.status})`)
  return data as T
}

export interface ApiUser { id: string; email: string; name: string | null }
export interface ApiWorkspace { id: string; agencyName: string; logo: string | null; brand: unknown; role: 'owner' | 'manager' | 'viewer' }
export interface MeResponse { user: ApiUser; workspaces: ApiWorkspace[] }
export interface SavedReport { id: string; name: string; config: Record<string, unknown>; createdAt: string; authorName?: string | null; authorEmail?: string | null }

export const apiClient = {
  me: () => req<MeResponse>('/api/me'),
  login: (email: string, password: string) => req<MeResponse>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (email: string, password: string, name: string) =>
    req<MeResponse>('/api/auth/register', { method: 'POST', body: JSON.stringify({ email, password, name }) }),
  logout: () => req<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),

  getWorkspace: () => req<{ state: Record<string, unknown> }>('/api/workspace'),
  putWorkspace: (state: Record<string, unknown>) => req<{ ok: boolean }>('/api/workspace', { method: 'PUT', body: JSON.stringify({ state }) }),
  getClients: () => req<{ clients: unknown[]; importableIds: string[] }>('/api/clients'),
  upsertClient: (client: Record<string, unknown>) => req<{ ok: boolean }>('/api/clients', { method: 'POST', body: JSON.stringify({ client }) }),
  deleteClient: (id: string) => req<{ ok: boolean }>(`/api/clients/${id}`, { method: 'DELETE' }),

  listReports: () => req<{ reports: SavedReport[] }>('/api/reports'),
  saveReport: (name: string, config: Record<string, unknown>) => req<{ report: SavedReport }>('/api/reports', { method: 'POST', body: JSON.stringify({ name, config }) }),
  deleteReport: (id: string) => req<{ ok: boolean }>(`/api/reports/${id}`, { method: 'DELETE' }),
}
