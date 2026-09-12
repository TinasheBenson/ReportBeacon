/** App shell: a collapsible nav rail, a top bar, and the routed page.
 *  Adapts to the active face — Performance or Social — when the workspace
 *  runs in "both" mode, with a switch in the top bar. */
import { useEffect } from 'react'
import { NavLink, Outlet, useLocation, useNavigate, Link } from 'react-router'
import { AnimatePresence, motion } from 'framer-motion'
import {
  LayoutGrid, Users, Bell, FileText, Cable, Settings as SettingsIcon, Lightbulb, UsersRound, Palette, CalendarClock,
  SlidersHorizontal, PanelLeftClose, PanelLeftOpen, Menu, X, Sun, Moon, LogOut,
} from 'lucide-react'
import { useApp, type Face } from '@/context/app'
import { useWorkspace, type Palette as Pal } from '@/context/workspace'
import { SOCIAL_ACCOUNTS } from '@/lib/social'

// Ground anchors per theme (mirrors index.css) and how strongly the base hue
// tints each surface. A null base clears the overrides and today's neutral
// palette applies unchanged.
const GROUND = {
  light: { '--plane': '#f7f8fa', '--surface': '#ffffff', '--surface-2': '#fbfbfd', '--line': '#e7e9ee', '--line-2': '#d7dbe2' },
  dark: { '--plane': '#0c0d10', '--surface': '#16181d', '--surface-2': '#1b1e24', '--line': '#262a31', '--line-2': '#333842' },
} as const
const TINT = {
  light: { '--plane': 11, '--surface': 7, '--surface-2': 13, '--line': 24, '--line-2': 30 },
  dark: { '--plane': 16, '--surface': 15, '--surface-2': 20, '--line': 28, '--line-2': 34 },
} as const
const GROUND_KEYS = ['--plane', '--surface', '--surface-2', '--line', '--line-2'] as const

function applyPalette(pal: Pal, theme: 'light' | 'dark') {
  const root = document.documentElement.style
  root.setProperty('--accent', pal.accent)
  if (!pal.base) { for (const k of GROUND_KEYS) root.removeProperty(k); return }
  const g = GROUND[theme]; const t = TINT[theme]
  for (const k of GROUND_KEYS) root.setProperty(k, `color-mix(in srgb, ${pal.base} ${t[k]}%, ${g[k]})`)
}
function clearPalette() {
  const root = document.documentElement.style
  root.removeProperty('--accent')
  for (const k of GROUND_KEYS) root.removeProperty(k)
}
import { IconButton, Segmented } from '@/components/ui/kit'

type NavItem = { to: string; label: string; icon: any; end?: boolean; badge?: boolean }

const PERF_NAV: NavItem[] = [
  { to: '/app', label: 'Portfolio', icon: LayoutGrid, end: true },
  { to: '/app/accounts', label: 'Accounts', icon: Users },
  { to: '/app/recommendations', label: 'Recommendations', icon: Lightbulb },
  { to: '/app/alerts', label: 'Alerts', icon: Bell, badge: true },
  { to: '/app/reports', label: 'Reports', icon: FileText },
  { to: '/app/automations', label: 'Automations', icon: CalendarClock },
]
const SOCIAL_NAV: NavItem[] = [
  { to: '/app/social', label: 'Overview', icon: LayoutGrid, end: true },
  { to: '/app/social/recommendations', label: 'Recommendations', icon: Lightbulb },
  { to: '/app/social/reports', label: 'Reports', icon: FileText },
]

const TITLES: Record<string, string> = {
  '/app': 'Portfolio', '/app/accounts': 'Accounts', '/app/recommendations': 'Recommendations', '/app/alerts': 'Alerts',
  '/app/reports': 'Reports', '/app/automations': 'Automations', '/app/integrations': 'Integrations',
  '/app/settings': 'Settings', '/app/team': 'Team & access', '/app/branding': 'Branding', '/app/alert-rules': 'Alert rules',
  '/app/social': 'Social overview', '/app/social/recommendations': 'Recommendations', '/app/social/reports': 'Reports', '/app/social/integrations': 'Integrations',
}
function pageTitle(path: string): string {
  if (path.startsWith('/app/social/clients/')) return 'Account'
  if (path.startsWith('/app/accounts/')) return 'Account'
  return TITLES[path] ?? 'ReportBeacon'
}

const SHARED_PATHS = ['/app/team', '/app/branding', '/app/settings']

export default function Shell() {
  const { navCollapsed, toggleNav, mobileNavOpen, setMobileNavOpen, theme, toggleTheme, signOut, face: appFace, setFace } = useApp()
  const { me, isAdmin, accountsForSeat, brand, openAlerts, mode } = useWorkspace()
  const location = useLocation()
  const navigate = useNavigate()
  const scoped = me ? accountsForSeat(me) : []
  const alertCount = openAlerts(scoped).length
  const seat = me

  const onSocialPath = location.pathname.startsWith('/app/social')
  const face: Face = mode === 'social' ? 'social' : mode === 'performance' ? 'performance' : (onSocialPath ? 'social' : appFace)
  const home = face === 'social' ? '/app/social' : '/app'

  const nav1 = face === 'social' ? SOCIAL_NAV : PERF_NAV
  const NAV_2: NavItem[] = [
    ...(isAdmin ? [
      ...(face === 'performance' ? [{ to: '/app/alert-rules', label: 'Alert rules', icon: SlidersHorizontal }] : []),
      { to: '/app/team', label: 'Team & access', icon: UsersRound },
      { to: '/app/branding', label: 'Branding', icon: Palette },
    ] : []),
    { to: face === 'social' ? '/app/social/integrations' : '/app/integrations', label: 'Integrations', icon: Cable },
    { to: '/app/settings', label: 'Settings', icon: SettingsIcon },
  ]

  useEffect(() => { setMobileNavOpen(false) }, [location.pathname, setMobileNavOpen])

  // Keep the route consistent with the workspace mode.
  useEffect(() => {
    const path = location.pathname
    const social = path.startsWith('/app/social')
    const shared = SHARED_PATHS.includes(path)
    if (mode === 'performance' && social) navigate('/app', { replace: true })
    else if (mode === 'social' && !social && !shared) navigate('/app/social', { replace: true })
    else if (mode === 'both' && appFace === 'social' && path === '/app') navigate('/app/social', { replace: true })
  }, [mode, appFace, location.pathname, navigate])

  // White-label: apply the active face's palette (ground tint + highlight) to
  // the tokens, easing the whole environment across on a switch or brand edit.
  const pal = face === 'social' ? brand.social : brand.performance
  useEffect(() => {
    const el = document.documentElement
    el.classList.add('theme-morph')
    applyPalette(pal, theme)
    const t = setTimeout(() => el.classList.remove('theme-morph'), 560)
    return () => clearTimeout(t)
  }, [pal.base, pal.accent, theme])
  useEffect(() => clearPalette, [])

  const railWidth = navCollapsed ? 'lg:w-[68px]' : 'lg:w-[236px]'
  const doSignOut = () => { signOut(); navigate('/app') }
  const switchFace = (f: Face) => { setFace(f); navigate(f === 'social' ? '/app/social' : '/app') }

  return (
    <div className="min-h-screen">
      {mobileNavOpen && <div className="fixed inset-0 z-40 bg-black/40 lg:hidden no-print" onClick={() => setMobileNavOpen(false)} />}

      <div className="flex min-h-screen">
        <aside
          className={`no-print fixed lg:sticky top-0 z-50 lg:z-auto h-screen flex flex-col bg-[var(--surface)] border-r border-[var(--line)] transition-all duration-200 ${railWidth} w-[236px]
            ${mobileNavOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
        >
          <Rail collapsed={navCollapsed} alertCount={alertCount} nav1={nav1} nav2={NAV_2} home={home} face={face} onCloseMobile={() => setMobileNavOpen(false)} />

          {/* Seat + collapse */}
          <div className="mt-auto border-t border-[var(--line)] p-2">
            <div className={`flex items-center gap-2.5 px-2 py-2 ${navCollapsed ? 'lg:justify-center lg:px-0' : ''}`}>
              <span className="w-8 h-8 rounded-full grid place-items-center flex-none text-[12px] font-bold text-white" style={{ background: seat?.role === 'owner' ? 'var(--ink)' : seat?.role === 'viewer' ? 'var(--muted)' : 'var(--accent)' }}>{seat?.initials ?? '-'}</span>
              {!navCollapsed && (
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-semibold truncate">{seat?.name}</div>
                  <div className="text-[11px] text-[var(--muted)]">{seat?.title}</div>
                </div>
              )}
              {!navCollapsed && <IconButton label="Sign out" onClick={doSignOut} className="w-8 h-8"><LogOut size={15} /></IconButton>}
            </div>
            {navCollapsed && (
              <button onClick={doSignOut} title="Sign out" className="hidden lg:flex w-full justify-center py-1.5 text-[var(--muted)] hover:text-[var(--ink)]"><LogOut size={15} /></button>
            )}
            <button
              onClick={toggleNav}
              className="hidden lg:flex items-center gap-2.5 w-full px-2 py-2 mt-1 rounded-[8px] text-[13px] text-[var(--ink-2)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)] transition-colors"
              title={navCollapsed ? 'Expand navigation' : 'Collapse navigation'}
            >
              {navCollapsed ? <PanelLeftOpen size={18} className="mx-auto" /> : <><PanelLeftClose size={18} /> Collapse</>}
            </button>
          </div>
        </aside>

        <div className="flex-1 min-w-0">
          <header className="no-print sticky top-0 z-30 flex items-center gap-3 px-4 lg:px-6 py-3 border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--surface)_80%,transparent)] backdrop-blur">
            <IconButton label="Open navigation" className="lg:hidden" onClick={() => setMobileNavOpen(true)}><Menu size={18} /></IconButton>
            <h1 className="text-[18px] font-bold tracking-[-0.02em]">{pageTitle(location.pathname)}</h1>
            <span className="hidden sm:flex items-center gap-2 text-[12px] text-[var(--ink-2)] ml-1">
              <span className="w-[7px] h-[7px] rounded-full bg-[var(--st-good)]" style={{ boxShadow: '0 0 0 3px color-mix(in srgb, var(--st-good) 20%, transparent)' }} />
              Synced 4 min ago
            </span>
            <div className="flex-1" />
            {mode === 'both' && (
              <Segmented value={face} onChange={switchFace} size="sm" options={[{ value: 'performance', label: 'Performance' }, { value: 'social', label: 'Social' }]} />
            )}
            <span className="hidden lg:inline text-[12px] text-[var(--muted)]">{face === 'social' ? `${SOCIAL_ACCOUNTS.length} accounts` : seat?.role === 'owner' ? 'Agency view' : `${scoped.length} accounts`}</span>
            <IconButton label="Toggle light and dark" onClick={toggleTheme}>{theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</IconButton>
          </header>

          <main className="px-4 lg:px-6 py-5 pb-16 max-w-[1360px]">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={face} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}>
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </div>
  )
}

function Rail({ collapsed, alertCount, nav1, nav2, home, face, onCloseMobile }: { collapsed: boolean; alertCount: number; nav1: NavItem[]; nav2: NavItem[]; home: string; face: Face; onCloseMobile: () => void }) {
  const { brand, brandMonogram } = useWorkspace()
  return (
    <>
      <Link to={home} className={`flex items-center gap-2.5 px-4 pt-4 pb-4 ${collapsed ? 'lg:justify-center lg:px-0' : ''}`}>
        {brand.logo
          ? <img src={brand.logo} alt="" className="w-[30px] h-[30px] rounded-[8px] object-cover flex-none" />
          : <span className="w-[30px] h-[30px] rounded-[8px] grid place-items-center flex-none text-[12px] font-bold text-white" style={{ background: 'var(--accent)' }}>{brandMonogram}</span>}
        {!collapsed && (
          <div className="min-w-0">
            <div className="font-bold text-[14.5px] tracking-[-0.01em] leading-tight truncate">{brand.agencyName}</div>
            <div className="text-[11px] text-[var(--muted)] mt-0.5">{face === 'social' ? 'Social · ReportBeacon' : 'Powered by ReportBeacon'}</div>
          </div>
        )}
        <IconButton label="Close navigation" className="lg:hidden ml-auto" onClick={(e: any) => { e.preventDefault(); onCloseMobile() }}><X size={16} /></IconButton>
      </Link>
      <nav className="flex-1 overflow-y-auto clip-scroll px-2.5">
        <NavGroup collapsed={collapsed} label="Workspace" items={nav1} alertCount={alertCount} />
        <NavGroup collapsed={collapsed} label="Configure" items={nav2} alertCount={alertCount} />
      </nav>
    </>
  )
}

function NavGroup({ collapsed, label, items, alertCount }: {
  collapsed: boolean; label: string; items: NavItem[]; alertCount: number
}) {
  return (
    <div className="mb-1">
      {!collapsed ? <div className="text-[10.5px] font-semibold tracking-[0.06em] uppercase text-[var(--muted)] px-2 pt-3.5 pb-1.5">{label}</div> : <div className="h-3.5" />}
      {items.map((it) => {
        const Icon = it.icon
        return (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.end}
            title={collapsed ? it.label : undefined}
            className={({ isActive }) =>
              `relative flex items-center gap-2.5 rounded-[8px] px-2.5 py-2 my-[1px] text-[13.5px] font-medium border border-transparent transition-colors ${collapsed ? 'lg:justify-center lg:px-0' : ''} ${
                isActive ? 'bg-[var(--accent-weak)] text-[var(--accent)] font-semibold border-[color-mix(in_srgb,var(--accent)_22%,transparent)]' : 'text-[var(--ink-2)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]'
              }`
            }
          >
            <Icon size={17} className="flex-none" />
            {!collapsed && <span>{it.label}</span>}
            {!collapsed && it.badge && alertCount > 0 && <span className="ml-auto text-[11px] font-semibold bg-[var(--st-critical)] text-white rounded-full px-[7px] leading-[18px]">{alertCount}</span>}
            {collapsed && it.badge && alertCount > 0 && <span className="absolute right-2 top-2 w-[7px] h-[7px] rounded-full bg-[var(--st-critical)]" />}
          </NavLink>
        )
      })}
    </div>
  )
}
