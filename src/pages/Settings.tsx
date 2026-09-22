/** Settings: workspace preferences, wired to real app state. */
import { useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { ArrowRight, RotateCcw } from 'lucide-react'
import { useApp } from '@/context/app'
import { useWorkspace } from '@/context/workspace'
import { RANGES } from '@/lib/data'
import { MODELS } from '@/lib/llm'
import { Card, Segmented, Toggle, Button } from '@/components/ui/kit'
import { Reveal } from '@/components/ui/disclosure'

export default function Settings() {
  const { theme, setTheme, range, setRange, role, setRole, ai } = useApp()
  const { me, accountsForSeat, resetWorkspace } = useWorkspace()
  const seat = me
  const [alertEmail, setAlertEmail] = useState(true)
  const [weeklyDigest, setWeeklyDigest] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const connectedModel = MODELS.find((m) => m.id === ai.model)

  function doReset() {
    resetWorkspace()
    toast.success('Demo reset', { description: 'Roster, team, branding and schedules are back to the sample state.' })
    setTimeout(() => window.location.assign('/app'), 250)
  }


  return (
    <Reveal className="flex flex-col gap-4 max-w-[640px]">
      <Card className="p-5">
        <div className="text-[13px] font-bold mb-4">Seat</div>
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-full grid place-items-center flex-none text-[14px] font-bold text-white" style={{ background: seat?.role === 'owner' ? 'var(--ink)' : 'var(--accent)' }}>{seat?.initials}</span>
          <div className="flex-1">
            <div className="text-[14px] font-semibold">{seat?.name}</div>
            <div className="text-[12px] text-[var(--muted)]">{seat?.title} · {seat?.role === 'owner' ? 'all accounts' : `${seat ? accountsForSeat(seat).length : 0} accounts`}</div>
          </div>
        </div>
        {/* There is no session to end, so the useful control here is the seat
            itself: switching it is how a visitor sees access actually scope. */}
        <div className="mt-4 pt-4 border-t border-[var(--line)]">
          <Row label="Viewing as" hint="Switch seat to see what each role is allowed to see">
            <Segmented
              value={role}
              onChange={setRole}
              options={[
                { value: 'owner', label: 'Owner' },
                { value: 'manager', label: 'Manager' },
                { value: 'viewer', label: 'Viewer' },
              ]}
            />
          </Row>
        </div>
      </Card>

      <Card className="p-5">
        <div className="text-[13px] font-bold mb-4">Appearance</div>
        <Row label="Theme" hint="Also on the top bar">
          <Segmented value={theme} onChange={setTheme} options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
        </Row>
        <Row label="Default date range" hint="Applied across the console">
          <Segmented value={range} onChange={setRange} options={RANGES.map((r) => ({ value: r.id, label: r.label }))} />
        </Row>
      </Card>

      <Card className="p-5">
        <div className="text-[13px] font-bold mb-4">AI recommendations</div>
        <Row label="OpenRouter model" hint={ai.key ? 'Connected' : 'Not connected'}>
          <Link to="/app/integrations" className="text-[12.5px] font-semibold text-[var(--accent)] inline-flex items-center gap-1">
            {ai.key ? connectedModel?.label : 'Connect'} <ArrowRight size={13} />
          </Link>
        </Row>
      </Card>

      <Card className="p-5">
        <div className="text-[13px] font-bold mb-4">Notifications</div>
        <Row label="Email me on new alerts" hint="At-risk and watch flags"><Toggle on={alertEmail} onChange={setAlertEmail} label="Alert email" /></Row>
        <Row label="Weekly portfolio digest" hint="Monday mornings"><Toggle on={weeklyDigest} onChange={setWeeklyDigest} label="Weekly digest" /></Row>
        <div className="mt-4"><Button variant="primary" onClick={() => toast.success('Preferences saved')}>Save preferences</Button></div>
      </Card>

      <Card className="p-5">
        <div className="text-[13px] font-bold mb-1">Demo data</div>
        <p className="text-[12px] text-[var(--muted)] mb-4 max-w-[420px]">Everything you change in this demo is saved to this browser only. Reset to bring back the sample roster, team, branding and schedules for a fresh walkthrough.</p>
        {confirmReset ? (
          <div className="flex items-center gap-2.5">
            <Button variant="primary" onClick={doReset}><RotateCcw size={15} /> Yes, reset the demo</Button>
            <Button onClick={() => setConfirmReset(false)}>Cancel</Button>
          </div>
        ) : (
          <Button onClick={() => setConfirmReset(true)}><RotateCcw size={15} /> Reset demo</Button>
        )}
      </Card>
    </Reveal>
  )
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 border-t border-[var(--line)] first:border-t-0">
      <div>
        <div className="text-[13px] font-medium">{label}</div>
        {hint && <div className="text-[11.5px] text-[var(--muted)]">{hint}</div>}
      </div>
      {children}
    </div>
  )
}
