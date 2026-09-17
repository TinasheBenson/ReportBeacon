/**
 * App-wide state: theme, the signed-in user (real email+password session), the
 * active date range, nav collapse, and the OpenRouter AI config.
 *
 * Auth is a server session (httpOnly cookie): on mount we resolve /api/me. The
 * user's workspace role maps to the console's seat model so every scoped view
 * (roster, economics, read-only) keeps working. UI preferences persist locally.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { RANGES, type RangeId } from '@/lib/data'
import { apiClient, type ApiUser } from '@/lib/apiClient'

type Theme = 'light' | 'dark'
export type Role = 'owner' | 'manager' | 'viewer'
export type Face = 'performance' | 'social'
export interface AIConfigState { key: string; model: string }
export interface SessionUser extends ApiUser { role: Role }

// The workspace role drives which seat identity the console scopes to.
const ROLE_SEAT: Record<Role, string> = { owner: 'owner', manager: 'dana', viewer: 'priya' }

interface AppState {
  theme: Theme
  toggleTheme: () => void
  setTheme: (t: Theme) => void

  face: Face
  setFace: (f: Face) => void

  // Auth. `checking` gates the app until the session is resolved.
  user: SessionUser | null
  checking: boolean
  role: Role
  seatId: string | null
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name: string) => Promise<void>
  signOut: () => void

  range: RangeId
  setRange: (r: RangeId) => void

  navCollapsed: boolean
  toggleNav: () => void
  mobileNavOpen: boolean
  setMobileNavOpen: (v: boolean) => void

  ai: AIConfigState
  setAi: (patch: Partial<AIConfigState>) => void
}

const Ctx = createContext<AppState | null>(null)

function readLS<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key)
    return v === null ? fallback : (JSON.parse(v) as T)
  } catch { return fallback }
}
function writeLS(key: string, v: unknown) {
  try { localStorage.setItem(key, JSON.stringify(v)) } catch { /* private mode */ }
}

function readRange(): RangeId {
  const v = readLS<unknown>('rb-range', '30d')
  return RANGES.some((r) => r.id === v) ? (v as RangeId) : '30d'
}
function readFace(): Face {
  const v = readLS<unknown>('rb-face', 'performance')
  return v === 'social' ? 'social' : 'performance'
}
function readAi(): AIConfigState {
  const v = readLS<unknown>('rb-ai', null)
  if (v && typeof v === 'object' && typeof (v as any).key === 'string' && typeof (v as any).model === 'string') {
    return { key: (v as any).key, model: (v as any).model }
  }
  return { key: '', model: 'anthropic/claude-3.5-sonnet' }
}

function initialTheme(): Theme {
  const stored = readLS<Theme | null>('rb-theme', null)
  if (stored === 'light' || stored === 'dark') return stored
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark'
  return 'light'
}

function toSessionUser(me: { user: ApiUser; workspaces: { role: Role }[] }): SessionUser {
  return { ...me.user, role: me.workspaces[0]?.role ?? 'owner' }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(initialTheme)
  const [face, setFaceState] = useState<Face>(readFace)
  const [user, setUser] = useState<SessionUser | null>(null)
  const [checking, setChecking] = useState(true)
  const [range, setRangeState] = useState<RangeId>(readRange)
  const [navCollapsed, setNavCollapsed] = useState<boolean>(() => readLS<boolean>('rb-nav', false))
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [ai, setAiState] = useState<AIConfigState>(readAi)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    writeLS('rb-theme', theme)
  }, [theme])

  // Resolve the existing session once on load.
  useEffect(() => {
    let cancelled = false
    apiClient.me()
      .then((me) => { if (!cancelled) setUser(toSessionUser(me as any)) })
      .catch(() => { if (!cancelled) setUser(null) })
      .finally(() => { if (!cancelled) setChecking(false) })
    return () => { cancelled = true }
  }, [])

  const role: Role = user?.role ?? 'manager'
  const seatId = user ? (ROLE_SEAT[user.role] ?? 'owner') : null

  const value: AppState = {
    theme,
    toggleTheme: () => setThemeState((t) => (t === 'dark' ? 'light' : 'dark')),
    setTheme: setThemeState,
    face,
    setFace: (f) => { setFaceState(f); writeLS('rb-face', f) },

    user, checking, role, seatId,
    login: async (email, password) => { setUser(toSessionUser((await apiClient.login(email, password)) as any)) },
    register: async (email, password, name) => { setUser(toSessionUser((await apiClient.register(email, password, name)) as any)) },
    signOut: () => { apiClient.logout().catch(() => {}); setUser(null); try { localStorage.removeItem('rb-ws') } catch {} },

    range,
    setRange: (r) => { setRangeState(r); writeLS('rb-range', r) },
    navCollapsed,
    toggleNav: () => setNavCollapsed((c) => { writeLS('rb-nav', !c); return !c }),
    mobileNavOpen, setMobileNavOpen,
    ai,
    setAi: (patch) => setAiState((prev) => { const next = { ...prev, ...patch }; writeLS('rb-ai', next); return next }),
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp(): AppState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useApp outside provider')
  return v
}
