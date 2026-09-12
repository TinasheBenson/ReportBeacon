/**
 * App-wide UI state: theme, the signed-in seat (mock auth), the active date
 * range, nav collapse, and the OpenRouter AI config. Persisted to
 * localStorage so a reload keeps the operator where they were.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { RANGES, SEATS, type RangeId } from '@/lib/data'

type Theme = 'light' | 'dark'
export type Face = 'performance' | 'social'
export interface AIConfigState { key: string; model: string }

interface AppState {
  theme: Theme
  toggleTheme: () => void
  setTheme: (t: Theme) => void

  // Which face of the console is active when the workspace runs in "both" mode.
  face: Face
  setFace: (f: Face) => void

  seatId: string | null
  login: (id: string) => void
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
  } catch {
    return fallback
  }
}
function writeLS(key: string, v: unknown) {
  try { localStorage.setItem(key, JSON.stringify(v)) } catch { /* private mode */ }
}

// Persisted values are only trusted after validation: a value left by an older
// build (a renamed range, a removed seat, a wrong shape) is coerced back to a
// safe default rather than flowing into a hot path and crashing the render.
function readRange(): RangeId {
  const v = readLS<unknown>('rb-range', '30d')
  return RANGES.some((r) => r.id === v) ? (v as RangeId) : '30d'
}
function readSeat(): string | null {
  const v = readLS<unknown>('rb-seat', null)
  return typeof v === 'string' && SEATS.some((s) => s.id === v) ? v : null
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

export function AppProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(initialTheme)
  const [face, setFaceState] = useState<Face>(readFace)
  const [seatId, setSeatId] = useState<string | null>(readSeat)
  const [range, setRangeState] = useState<RangeId>(readRange)
  const [navCollapsed, setNavCollapsed] = useState<boolean>(() => readLS<boolean>('rb-nav', false))
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [ai, setAiState] = useState<AIConfigState>(readAi)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    writeLS('rb-theme', theme)
  }, [theme])

  const value: AppState = {
    theme,
    toggleTheme: () => setThemeState((t) => (t === 'dark' ? 'light' : 'dark')),
    setTheme: setThemeState,
    face,
    setFace: (f) => { setFaceState(f); writeLS('rb-face', f) },
    seatId,
    login: (id) => { setSeatId(id); writeLS('rb-seat', id) },
    signOut: () => { setSeatId(null); writeLS('rb-seat', null) },
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
