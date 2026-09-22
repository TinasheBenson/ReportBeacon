/**
 * App-wide state: theme, the active demo seat, the date range, nav collapse,
 * and the OpenRouter AI config.
 *
 * There is no sign-in. This build is a demo a stranger opens from a cold email,
 * so a credential prompt between them and the product only loses them, and a
 * session round-trip makes the whole thing fail whenever the backend is cold.
 * The visitor picks a seat instead, and that choice drives every scoped view -
 * roster, economics, read-only - exactly as a real role would.
 *
 * `user` stays in the shape the data contexts expect and is always null, which
 * is deliberate: null is their zero-backend path, already written and already
 * feeding the local demo roster. UI preferences persist locally.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { RANGES, type RangeId } from '@/lib/data'
import { type ApiUser } from '@/lib/apiClient'

type Theme = 'light' | 'dark'
export type Role = 'owner' | 'manager' | 'viewer'
export type Face = 'performance' | 'social'
export interface AIConfigState { key: string; model: string }
export interface SessionUser extends ApiUser { role: Role }

// Which seat identity in the demo roster each role scopes to.
const ROLE_SEAT: Record<Role, string> = { owner: 'owner', manager: 'dana', viewer: 'priya' }

interface AppState {
  theme: Theme
  toggleTheme: () => void
  setTheme: (t: Theme) => void

  face: Face
  setFace: (f: Face) => void

  /** Always null: the data contexts treat that as "no backend", which is the
   *  demo path. Kept so those contexts need no change. */
  user: SessionUser | null
  /** The seat the visitor is viewing as. Switching it rescopes the console. */
  role: Role
  setRole: (r: Role) => void
  seatId: string

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

function readRole(): Role {
  const v = readLS<unknown>('rb-role', 'owner')
  return v === 'manager' || v === 'viewer' ? v : 'owner'
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(initialTheme)
  const [face, setFaceState] = useState<Face>(readFace)
  const [role, setRoleState] = useState<Role>(readRole)
  const [range, setRangeState] = useState<RangeId>(readRange)
  const [navCollapsed, setNavCollapsed] = useState<boolean>(() => readLS<boolean>('rb-nav', false))
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [ai, setAiState] = useState<AIConfigState>(readAi)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    writeLS('rb-theme', theme)
  }, [theme])

  const seatId = ROLE_SEAT[role] ?? 'owner'

  const value: AppState = {
    theme,
    toggleTheme: () => setThemeState((t) => (t === 'dark' ? 'light' : 'dark')),
    setTheme: setThemeState,
    face,
    setFace: (f) => { setFaceState(f); writeLS('rb-face', f) },

    user: null,
    role, seatId,
    setRole: (r) => { setRoleState(r); writeLS('rb-role', r) },

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
