/** Accept an invitation. Public route reached from an invite link
 *  (/accept-invite?token=…). Simulated: accepting creates the teammate's seat
 *  and signs them in. Branded with the agency's white-label. */
import { useState } from 'react'
import { motion } from 'framer-motion'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { ArrowRight, ArrowLeft, MailCheck } from 'lucide-react'
import { useApp } from '@/context/app'
import { useWorkspace } from '@/context/workspace'
import { ROLE_LABEL } from '@/lib/data'
import { Button } from '@/components/ui/kit'

export default function AcceptInvite() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const { login } = useApp()
  const { invitations, acceptInvite, brand, brandMonogram } = useWorkspace()
  const navigate = useNavigate()
  const [name, setName] = useState('')

  const inv = invitations.find((i) => i.token === token)
  const valid = inv && inv.status === 'pending'

  function accept() {
    const id = acceptInvite(token, name)
    if (!id) return
    login(id)
    navigate('/app')
  }

  return (
    <div className="min-h-screen grid place-items-center px-5 py-10">
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[440px]"
      >
        <Link to="/" className="inline-flex items-center gap-1.5 text-[12.5px] text-[var(--muted)] hover:text-[var(--ink)] mb-5 transition-colors"><ArrowLeft size={14} /> Back to home</Link>

        <div className="flex items-center gap-2.5 mb-6">
          {brand.logo ? (
            <>
              <img src={brand.logo} alt={brand.agencyName} className="h-11 max-w-[180px] object-contain bg-white rounded-[10px] px-2.5 py-1.5" />
              <span className="text-[11.5px] text-[var(--muted)]">Powered by ReportBeacon</span>
            </>
          ) : (
            <>
              <span className="w-9 h-9 rounded-[9px] grid place-items-center text-[13px] font-bold text-white" style={{ background: brand.performance.accent }}>{brandMonogram}</span>
              <div>
                <div className="font-bold text-[16px] tracking-[-0.01em] leading-none">{brand.agencyName}</div>
                <div className="text-[11.5px] text-[var(--muted)] mt-0.5">Powered by ReportBeacon</div>
              </div>
            </>
          )}
        </div>

        {valid ? (
          <div className="rounded-[14px] bg-[var(--surface)] border border-[var(--line)] shadow-[var(--shadow)] p-6">
            <span className="inline-grid place-items-center w-11 h-11 rounded-[11px] mb-4" style={{ background: 'var(--accent-weak)', color: 'var(--accent)' }}><MailCheck size={20} /></span>
            <h1 className="text-[19px] font-bold tracking-[-0.02em] mb-1">You're invited to {brand.agencyName}</h1>
            <p className="text-[13px] text-[var(--ink-2)] mb-5">Joining as <b className="text-[var(--ink)]">{ROLE_LABEL[inv!.role]}</b>, with the invite sent to {inv!.email}. Add your name to set up your seat.</p>
            <label className="eyebrow">Your name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) accept() }}
              placeholder="Jordan Lee"
              className="w-full mt-2 mb-4 bg-[var(--surface-2)] border border-[var(--line-2)] rounded-[8px] px-3 py-2 text-[13px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent)]"
            />
            <Button variant="primary" className="w-full justify-center" disabled={!name.trim()} onClick={accept}>Accept and open the console <ArrowRight size={16} /></Button>
          </div>
        ) : (
          <div className="rounded-[14px] bg-[var(--surface)] border border-[var(--line)] shadow-[var(--shadow)] p-6 text-center">
            <div className="text-[15px] font-bold mb-1">{inv ? 'This invitation was already accepted' : 'That invite link is not valid'}</div>
            <p className="text-[13px] text-[var(--ink-2)] mb-4">{inv ? 'Sign in from the seat picker instead.' : 'Ask your agency owner to send a fresh invitation.'}</p>
            <Button onClick={() => navigate('/app')}>Go to the console</Button>
          </div>
        )}
      </motion.div>
    </div>
  )
}
