import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import App from './App'
import { AppProvider } from './context/app'
import { WorkspaceProvider } from './context/workspace'
import { ErrorBoundary } from './components/ErrorBoundary'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ErrorBoundary>
        <AppProvider>
          <WorkspaceProvider>
            <App />
          </WorkspaceProvider>
        </AppProvider>
      </ErrorBoundary>
    </BrowserRouter>
  </StrictMode>,
)
