import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import App from './App'
import { AppProvider } from './context/app'
import { WorkspaceProvider } from './context/workspace'
import { SocialProvider } from './context/social'
import { ErrorBoundary } from './components/ErrorBoundary'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ErrorBoundary>
        <AppProvider>
          <WorkspaceProvider>
            <SocialProvider>
              <App />
            </SocialProvider>
          </WorkspaceProvider>
        </AppProvider>
      </ErrorBoundary>
    </BrowserRouter>
  </StrictMode>,
)
