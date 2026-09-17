/** Automations: scheduled report deliveries. Set them up on the Reports page;
 *  this lists what will go out and when. */
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { CalendarClock, Send, ArrowRight, Mail } from 'lucide-react'
import { useWorkspace } from '@/context/workspace'
import { Card, Button } from '@/components/ui/kit'
import { ClientMark } from '@/components/ClientMark'
import { Reveal } from '@/components/ui/disclosure'

const FREQ_LABEL: Record<string, string> = { weekly: 'Weekly', monthly: 'Monthly' }

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export default function Automations() {
  const { me, scheduledFor } = useWorkspace()
  const navigate = useNavigate()
  const rows = me ? scheduledFor(me) : []

  return (
    <Reveal className="flex flex-col gap-4 max-w-[820px]">
      <p className="text-[13px] text-[var(--ink-2)] max-w-[620px]">
        Reports that go out on their own. Each client's next send is queued below. Set or change a schedule from the client's report.
      </p>

      {rows.length === 0 ? (
        <Card className="p-10 text-center">
          <CalendarClock size={22} className="mx-auto mb-3 text-[var(--muted)]" />
          <div className="text-[14px] font-semibold mb-1">No scheduled reports yet</div>
          <p className="text-[13px] text-[var(--muted)] mb-4 max-w-[380px] mx-auto">Turn a monthly report into an automatic send so you never build it by hand again.</p>
          <Button variant="primary" onClick={() => navigate('/app/reports')}>Set up a schedule <ArrowRight size={15} /></Button>
        </Card>
      ) : (
        <Card className="divide-y divide-[var(--line)]">
          {rows.map(({ client, schedule, nextSend }) => (
            <div key={client.id} className="flex items-center gap-3 px-4 py-3.5">
              <ClientMark account={client} className="w-9 h-9 rounded-[9px] text-[12px]" />
              <div className="min-w-0 flex-1">
                <Link to={`/app/reports?account=${client.id}`} className="text-[13.5px] font-semibold hover:text-[var(--accent)] transition-colors">{client.name}</Link>
                <div className="text-[11.5px] text-[var(--muted)] flex items-center gap-1.5"><Mail size={12} /> {schedule.recipient || 'no recipient set'}</div>
              </div>
              <div className="text-right hidden sm:block">
                <div className="text-[12px] font-semibold">{FREQ_LABEL[schedule.freq]}</div>
                <div className="text-[11px] text-[var(--muted)]">Next: {fmtDate(nextSend)}</div>
              </div>
              <Button className="press" onClick={() => toast.success(`Report sent to ${client.name}`, { description: schedule.recipient || 'demo send' })}><Send size={14} /> Send now</Button>
            </div>
          ))}
        </Card>
      )}
    </Reveal>
  )
}
