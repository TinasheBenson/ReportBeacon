/** Real email + password sign-in and sign-up, backed by the API session. */
import { useState } from 'react'
import { motion } from 'framer-motion'
import { Link, useNavigate } from 'react-router'
import { ArrowRight, ArrowLeft, Loader2, ShieldCheck } from 'lucide-react'
import { useApp } from '@/context/app'
import { Logo } from '@/components/Logo'

const DEMO_PASSWORD = 'demo1234'
const DEMO_SEATS = [
  { email: 'owner@reportbeacon.demo', label: 'Agency owner', hint: 'Full roster + economics' },
  { email: 'manager@reportbeacon.demo', label: 'Account manager', hint: 'Only assigned accounts' },
  { email: 'viewer@reportbeacon.demo', label: 'Viewer', hint: 'Read-only, all accounts' },
]

export default function Login() {
  const { login, register } = useApp()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setBusy(true)
    try {
      if (mode === 'signin') await login(email.trim(), password)
      else await register(email.trim(), password, name.trim())
      navigate('/app')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setBusy(false)
    }
  }

  async function demoLogin(demoEmail: string) {
    setError(''); setBusy(true)
    setEmail(demoEmail); setPassword(DEMO_PASSWORD)
    try {
      await login(demoEmail, DEMO_PASSWORD)
      navigate('/app')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the demo.')
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.05fr_0.95fr]">
      {/* Left: form */}
      <div className="grid place-items-center px-5 py-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-[400px]"
        >
          <Link to="/" className="inline-flex items-center gap-1.5 text-[12.5px] text-[var(--muted)] hover:text-[var(--ink)] mb-6 transition-colors" data-testid="back-home-link"><ArrowLeft size={14} /> Back to home</Link>
          <div className="flex items-center gap-2.5 mb-6">
            <Logo size={36} />
            <div>
              <div className="font-bold text-[17px] tracking-[-0.01em] leading-none">ReportBeacon</div>
              <div className="text-[11.5px] text-[var(--muted)] mt-0.5">Account console</div>
            </div>
          </div>

          <h1 className="text-[22px] font-bold tracking-[-0.02em] mb-1" data-testid="auth-heading">
            {mode === 'signin' ? 'Sign in to your console' : 'Create your agency console'}
          </h1>
          <p className="text-[13px] text-[var(--ink-2)] mb-5">
            {mode === 'signin' ? 'Every client account on one screen.' : 'Your workspace opens with a populated demo roster.'}
          </p>

          <form onSubmit={submit} className="flex flex-col gap-3">
            {mode === 'signup' && (
              <Field label="Your name">
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex Rivera" autoComplete="name"
                  data-testid="auth-name-input" className={inputCls} />
              </Field>
            )}
            <Field label="Email">
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@agency.com" autoComplete="email"
                data-testid="auth-email-input" className={inputCls} />
            </Field>
            <Field label="Password">
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === 'signup' ? 'At least 8 characters' : '••••••••'} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                data-testid="auth-password-input" className={inputCls} />
            </Field>

            {error && <div className="text-[12.5px] text-white bg-[var(--st-critical)] rounded-[8px] px-3 py-2" data-testid="auth-error">{error}</div>}

            <button type="submit" disabled={busy} data-testid="auth-submit-button"
              className="mt-1 inline-flex items-center justify-center gap-2 h-11 rounded-[11px] bg-[var(--accent)] text-white font-semibold text-[14px] shadow-[var(--shadow-pop)] hover:brightness-105 active:scale-[0.99] transition-all disabled:opacity-60">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <>{mode === 'signin' ? 'Sign in' : 'Create console'} <ArrowRight size={16} /></>}
            </button>
          </form>

          <div className="text-[13px] text-[var(--ink-2)] mt-5">
            {mode === 'signin' ? (
              <>New here? <button onClick={() => { setMode('signup'); setError('') }} data-testid="switch-to-signup" className="font-semibold text-[var(--accent)] hover:underline">Create an account</button></>
            ) : (
              <>Already have a console? <button onClick={() => { setMode('signin'); setError('') }} data-testid="switch-to-signin" className="font-semibold text-[var(--accent)] hover:underline">Sign in</button></>
            )}
          </div>

          {/* Mobile: the demo roles live in the right panel on desktop; surface them here on small screens. */}
          <div className="lg:hidden mt-6 pt-5 border-t border-[var(--line)]">
            <div className="text-[11.5px] font-semibold text-[var(--ink-2)] mb-2.5">Or jump into a live demo</div>
            <div className="flex flex-col gap-2">
              {DEMO_SEATS.map((s) => (
                <button key={s.email} onClick={() => demoLogin(s.email)} disabled={busy}
                  data-testid={`demo-login-mobile-${s.label.split(' ')[0].toLowerCase()}`}
                  className="flex items-center gap-3 p-3 rounded-[11px] bg-[var(--surface-2)] border border-[var(--line)] text-left active:scale-[0.99] transition-transform disabled:opacity-60">
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold">{s.label}</span>
                    <span className="block text-[11.5px] text-[var(--muted)]">{s.hint}</span>
                  </span>
                  <ArrowRight size={16} className="text-[var(--muted)]" />
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Right: demo panel */}
      <div className="hidden lg:flex flex-col justify-center gap-4 px-10 py-10 bg-[var(--surface-2)] border-l border-[var(--line)]">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }} className="max-w-[380px]">
          <div className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-[var(--accent)] bg-[var(--accent-weak)] rounded-full px-3 py-1 mb-4"><ShieldCheck size={13} /> Try it instantly</div>
          <h2 className="text-[19px] font-bold tracking-[-0.01em] mb-1.5">Jump into a live demo</h2>
          <p className="text-[13px] text-[var(--ink-2)] mb-5">Sign in as one of three roles to see how access scopes the whole console. Same agency, different lens.</p>
          <div className="flex flex-col gap-2.5">
            {DEMO_SEATS.map((s, i) => (
              <motion.button
                key={s.email} onClick={() => demoLogin(s.email)} disabled={busy}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 + i * 0.06, duration: 0.35 }}
                data-testid={`demo-login-${s.label.split(' ')[0].toLowerCase()}`}
                className="group flex items-center gap-3 p-3.5 rounded-[12px] bg-[var(--surface)] border border-[var(--line)] shadow-[var(--shadow)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-pop)] transition-all text-left disabled:opacity-60"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-semibold">{s.label}</span>
                  <span className="block text-[12px] text-[var(--muted)]">{s.hint}</span>
                </span>
                <ArrowRight size={17} className="text-[var(--muted)] group-hover:text-[var(--accent)] group-hover:translate-x-0.5 transition-all" />
              </motion.button>
            ))}
          </div>
          <p className="text-[11.5px] text-[var(--muted)] mt-4">Demo password for all three: <span className="mono font-semibold text-[var(--ink-2)]">{DEMO_PASSWORD}</span></p>
        </motion.div>
      </div>
    </div>
  )
}

const inputCls = 'w-full bg-[var(--surface-2)] border border-[var(--line-2)] rounded-[10px] px-3.5 h-11 text-[14px] text-[var(--ink)] focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-weak)] transition-all'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11.5px] font-semibold text-[var(--ink-2)] mb-1.5">{label}</span>
      {children}
    </label>
  )
}
