/**
 * Last line of defence: if any render throws, show a recoverable card instead
 * of a blank white screen. The most likely trigger is a stale value left in
 * localStorage by an older build, so the primary recovery clears it.
 */
import { Component, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error) {
    // Surfaced in the console for debugging; no external logging in the demo.
    console.error('ReportBeacon crashed:', error)
  }

  resetDemo = () => {
    try {
      for (const k of Object.keys(localStorage)) {
        if (k.startsWith('rb-')) localStorage.removeItem(k)
      }
    } catch { /* private mode */ }
    window.location.assign('/app')
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div style={{
        minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '24px',
        background: 'var(--plane, #f7f8fa)', color: 'var(--ink, #101828)',
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      }}>
        <div style={{
          maxWidth: 440, width: '100%', background: 'var(--surface, #fff)',
          border: '1px solid var(--line, #e4e8ef)', borderRadius: 14, padding: '28px 26px',
          boxShadow: '0 20px 60px -30px rgba(16,24,40,.35)', textAlign: 'center',
        }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Something went wrong</div>
          <p style={{ fontSize: 13.5, color: 'var(--ink-2, #545c6a)', lineHeight: 1.6, margin: '0 0 20px' }}>
            The demo hit an unexpected state, most likely from data saved by an earlier version.
            Resetting it clears this browser's saved workspace and starts fresh.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={this.resetDemo} style={{
              fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 9, cursor: 'pointer',
              background: 'var(--accent, #4a3aa7)', color: '#fff', border: 'none',
            }}>Reset the demo</button>
            <button onClick={() => window.location.reload()} style={{
              fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 9, cursor: 'pointer',
              background: 'var(--surface, #fff)', color: 'var(--ink, #101828)',
              border: '1px solid var(--line-2, #d3d9e3)',
            }}>Reload the page</button>
          </div>
        </div>
      </div>
    )
  }
}
