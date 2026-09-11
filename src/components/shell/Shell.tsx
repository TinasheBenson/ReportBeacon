/** App shell: a collapsible nav rail, a top bar, and the routed page. */
import { useEffect } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import {
  LayoutGrid, Users, Bell, FileText, Cable, Settings as SettingsIcon, Lightbulb, UsersRound, Palette, CalendarClock,
  SlidersHorizontal, PanelLeftClose, PanelLeftOpen, Menu, X, Sun, Moon, LogOut,
} from 'lucide-react'
import { useApp } from '@/context/app'
import { useWorkspace } from '@/context/workspace'
import { IconButton } from '@/components/ui/kit'

const NAV = [
  { to: '/app', label: 'Portfolio', icon: LayoutGrid, end: true },
  { to: '/app/accounts', label: 'Accounts', icon: Users },
  { to: '/app/recommendations', label: 'Recommendations', icon: Lightbulb },
  { to: '/app/alerts', label: 'Alerts', icon: Bell, badge: true },
  { to: '/app/reports', label: 'Reports', icon: FileText },
  { to: '/app/automations', label: 'Automations', icon: CalendarClock },
]

const TITLES: Record<string, string> = {
  '/app': 'Portfolio', '/app/accounts': 'Accounts', '/app/recommendations': 'Recommendations', '/app/alerts': 'Alerts',
  '/app/reports': 'Reports', '/app/automations': 'Automations', '/app/integrations': 'Integrations',
  '/app/settings': 'Settings', '/app/team': 'Team & access', '/app/branding': 'Branding',
  '/app/alert-rules': 'Alert rules',
}
function pageTitle(path: string): string {
  if (path.startsWith('/app/accounts/')) return 'Account'
  return TITLES[path] ?? 'ReportBeacon'
}

export default function Shell() {
  const { navCollapsed, toggleNav, mobileNavOpen, setMobileNavOpen, theme, toggleTheme, signOut } = useApp()
  const { me, isAdmin, accountsForSeat, brand, openAlerts } = useWorkspace()
  const location = useLocation()
  const navigate = useNavigate()
  const scoped = me ? accountsForSeat(me) : []
  const alertCount = openAlerts(scoped).length
  const seat = me

  const NAV_2 = [
    ...(isAdmin ? [
      { to: '/app/alert-rules', label: 'Alert rules', icon: SlidersHorizontal },
      { to: '/app/team', label: 'Team & access', icon: UsersRound },
      { to: '/app/branding', label: 'Branding', icon: Palette },
    ] : []),
    { to: '/app/integrations', label: 'Integrations', icon: Cable },
    { to: '/app/settings', label: 'Settings', icon: SettingsIcon },
  ]

  useEffect(() => { setMobileNavOpen(false) }, [location.pathname, setMobileNavOpen])

  // White-label: the agency's accent recolours the console while signed in.
  useEffect(() => {
    document.documentElement.style.setProperty('--accent', brand.accent)
    return () => { document.documentElement.style.removeProperty('--accent') }
  }, [brand.accent])

  const railWidth = navCollapsed ? 'lg:w-[68px]' : 'lg:w-[236px]'
  const doSignOut = () => { signOut(); navigate('/app') }

  return (
    <div className="min-h-screen">
      {mobileNavOpen && <div className="fixed inset-0 z-40 bg-black/40 lg:hidden no-print" onClick={() => setMobileNavOpen(false)} />}

      <div className="flex min-h-screen">
        <aside
          className={`no-print fixed lg:sticky top-0 z-50 lg:z-auto h-screen flex flex-col bg-[var(--surface)] border-r border-[var(--line)] transition-all duration-200 ${railWidth} w-[236px]
            ${mobileNavOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
        >
          <Rail collapsed={navCollapsed} alertCount={alertCount} nav2={NAV_2} onCloseMobile={() => setMobileNavOpen(false)} />

          {/* Seat + collapse */}
          <div className="mt-auto border-t border-[var(--line)] p-2">
            <div className={`flex items-center gap-2.5 px-2 py-2 ${navCollapsed ? 'lg:justify-center lg:px-0' : ''}`}>
              <span className="w-8 h-8 rounded-full grid place-items-center flex-none text-[12px] font-bold text-white" style={{ background: seat?.role === 'owner' ? 'var(--ink)' : 'var(--accent)' }}>{seat?.initials ?? '-'}</span>
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
            <span className="hidden md:inline text-[12px] text-[var(--muted)]">{seat?.role === 'owner' ? 'Agency view' : `${scoped.length} accounts`}</span>
            <IconButton label="Toggle light and dark" onClick={toggleTheme}>{theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</IconButton>
          </header>

          <main className="px-4 lg:px-6 py-5 pb-16 max-w-[1360px]">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}

function Rail({ collapsed, alertCount, nav2, onCloseMobile }: { collapsed: boolean; alertCount: number; nav2: { to: string; label: string; icon: any }[]; onCloseMobile: () => void }) {
  const { brand, brandMonogram } = useWorkspace()
  return (
    <>
      <div className={`flex items-center gap-2.5 px-4 pt-4 pb-4 ${collapsed ? 'lg:justify-center lg:px-0' : ''}`}>
        {brand.logo
          ? <img src={brand.logo} alt="" className="w-[30px] h-[30px] rounded-[8px] object-cover flex-none" />
          : <span className="w-[30px] h-[30px] rounded-[8px] grid place-items-center flex-none text-[12px] font-bold text-white" style={{ background: brand.accent }}>{brandMonogram}</span>}
        {!collapsed && (
          <div className="min-w-0">
            <div className="font-bold text-[14.5px] tracking-[-0.01em] leading-tight truncate">{brand.agencyName}</div>
            <div className="text-[11px] text-[var(--muted)] mt-0.5">Powered by ReportBeacon</div>
          </div>
        )}
        <IconButton label="Close navigation" className="lg:hidden ml-auto" onClick={onCloseMobile}><X size={16} /></IconButton>
      </div>
      <nav className="flex-1 overflow-y-auto clip-scroll px-2.5">
        <NavGroup collapsed={collapsed} label="Workspace" items={NAV} alertCount={alertCount} />
        <NavGroup collapsed={collapsed} label="Configure" items={nav2} alertCount={alertCount} />
      </nav>
    </>
  )
}

function NavGroup({ collapsed, label, items, alertCount }: {
  collapsed: boolean; label: string
  items: { to: string; label: string; icon: any; end?: boolean; badge?: boolean }[]
  alertCount: number
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
