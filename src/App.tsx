import { Routes, Route, Navigate } from 'react-router'
import { MotionConfig } from 'framer-motion'
import { Toaster } from 'sonner'
import { useApp } from '@/context/app'
import Landing from '@/pages/Landing'
import Shell from '@/components/shell/Shell'
import Portfolio from '@/pages/Portfolio'
import Accounts from '@/pages/Accounts'
import AccountDetail from '@/pages/AccountDetail'
import RecommendationsPage from '@/pages/RecommendationsPage'
import Alerts from '@/pages/Alerts'
import Reports from '@/pages/Reports'
import Integrations from '@/pages/Integrations'
import Settings from '@/pages/Settings'
import Team from '@/pages/Team'
import Branding from '@/pages/Branding'
import Automations from '@/pages/Automations'
import AlertRules from '@/pages/AlertRules'
import AcceptInvite from '@/pages/AcceptInvite'
import SocialOverview from '@/pages/social/SocialOverview'
import SocialAccountDetail from '@/pages/social/SocialAccountDetail'
import SocialRecommendations from '@/pages/social/SocialRecommendations'
import SocialReports from '@/pages/social/SocialReports'
import SocialIntegrations from '@/pages/social/SocialIntegrations'

export default function App() {
  // No auth gate. The console is a demo running on local sample data, so a
  // visitor arriving from the landing page goes straight in.
  const { theme } = useApp()
  return (
    <MotionConfig reducedMotion="user">
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/accept-invite" element={<AcceptInvite />} />
        <Route path="/app" element={<Shell />}>
          <Route index element={<Portfolio />} />
          <Route path="accounts" element={<Accounts />} />
          <Route path="accounts/:id" element={<AccountDetail />} />
          <Route path="recommendations" element={<RecommendationsPage />} />
          <Route path="alerts" element={<Alerts />} />
          <Route path="alert-rules" element={<AlertRules />} />
          <Route path="social" element={<SocialOverview />} />
          <Route path="social/clients/:id" element={<SocialAccountDetail />} />
          <Route path="social/recommendations" element={<SocialRecommendations />} />
          <Route path="social/reports" element={<SocialReports />} />
          <Route path="social/integrations" element={<SocialIntegrations />} />
          <Route path="reports" element={<Reports />} />
          <Route path="automations" element={<Automations />} />
          <Route path="integrations" element={<Integrations />} />
          <Route path="team" element={<Team />} />
          <Route path="branding" element={<Branding />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Route>
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
