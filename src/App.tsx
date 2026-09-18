import { Routes, Route, Navigate } from 'react-router'
// The Performance face's pages (Portfolio, Accounts, AccountDetail, Alerts,
// AlertRules, Reports, Automations, Integrations, RecommendationsPage) are still
// in src/pages/ but are deliberately not imported or routed — see the note on
// the /app route below.
import { MotionConfig } from 'framer-motion'
import { Toaster } from 'sonner'
import { useApp } from '@/context/app'
import { Logo } from '@/components/Logo'
import Landing from '@/pages/Landing'
import Shell from '@/components/shell/Shell'
import Login from '@/pages/Login'
import Settings from '@/pages/Settings'
import Team from '@/pages/Team'
import Branding from '@/pages/Branding'
import AcceptInvite from '@/pages/AcceptInvite'
import SocialOverview from '@/pages/social/SocialOverview'
import SocialAccountDetail from '@/pages/social/SocialAccountDetail'
import SocialRecommendations from '@/pages/social/SocialRecommendations'
import SocialReports from '@/pages/social/SocialReports'
import SocialIntegrations from '@/pages/social/SocialIntegrations'

function Booting() {
  return (
    <div className="min-h-screen grid place-items-center" data-testid="app-booting">
      <div className="flex flex-col items-center gap-3">
        <Logo size={44} />
        <div className="text-[12.5px] text-[var(--muted)] animate-pulse">Loading your console…</div>
      </div>
    </div>
  )
}

export default function App() {
  const { theme, user, checking } = useApp()
  return (
    <MotionConfig reducedMotion="user">
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/accept-invite" element={<AcceptInvite />} />
        {checking ? (
          <Route path="/app/*" element={<Booting />} />
        ) : user ? (
          <Route path="/app" element={<Shell />}>
            {/*
              The Performance face is withdrawn, not deleted. Its roster was
              generated demo data with no backend behind it, so every figure it
              showed was invented — and with real Meta numbers now arriving, a
              face of plausible fiction beside them is a liability. Its routes
              redirect rather than render, so nothing fake stays reachable by
              URL, and the pages stay in the repo to come back when there is an
              ad-platform connector to feed them.
            */}
            <Route index element={<Navigate to="/app/social" replace />} />
            <Route path="social" element={<SocialOverview />} />
            <Route path="social/clients/:id" element={<SocialAccountDetail />} />
            <Route path="social/recommendations" element={<SocialRecommendations />} />
            <Route path="social/reports" element={<SocialReports />} />
            <Route path="social/integrations" element={<SocialIntegrations />} />
            <Route path="team" element={<Team />} />
            <Route path="branding" element={<Branding />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/app/social" replace />} />
          </Route>
        ) : (
          <Route path="/app/*" element={<Login />} />
        )}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster
        position="bottom-right"
        theme={theme}
        toastOptions={{
          style: {
            background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--ink)',
            borderRadius: '10px', boxShadow: 'var(--shadow-pop)',
          },
        }}
      />
    </MotionConfig>
  )
}
