/** Social integrations: connect the platforms a social manager runs on. */
import { useState } from 'react'
import { toast } from 'sonner'
import { PlugZap } from 'lucide-react'
import { useWorkspace } from '@/context/workspace'
import { SOCIAL_PLATFORMS, SOCIAL_ACCOUNTS, socialPlatform, type SocialPlatformId } from '@/lib/social'
import { relTime } from '@/lib/format'
import { Card, Button } from '@/components/ui/kit'
import { Reveal } from '@/components/ui/disclosure'

export default function SocialIntegrations() {
  const { isAdmin, canWrite } = useWorkspace()
  const [on, setOn] = useState<Record<SocialPlatformId, boolean>>({ instagram: true, facebook: true, tiktok: true, linkedin: false })

  return (
    <Reveal className="flex flex-col gap-5 max-w-[980px]">
      <Card className="p-5">
        <div className="flex items-start gap-3 mb-4">
          <span className="w-9 h-9 rounded-[9px] grid place-items-center flex-none" style={{ background: 'var(--accent-weak)', color: 'var(--accent)' }}><PlugZap size={18} /></span>
          <div className="flex-1">
            <div className="text-[14px] font-bold">Social connections</div>
            <div className="text-[12.5px] text-[var(--ink-2)] mt-0.5">Connect a platform and ReportBeacon pulls in the profiles and posts you manage there.</div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          {SOCIAL_PLATFORMS.map((pl) => {
            const isOn = on[pl.id]
            return (
              <div key={pl.id} className="bg-[var(--surface-2)] border border-[var(--line)] rounded-[9px] px-3 py-3 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="w-6 h-6 rounded-[6px] grid place-items-center text-[9px] font-bold text-white" style={{ background: pl.color }}>{pl.short}</span>
                  <span className="w-[9px] h-[9px] rounded-full" style={{ background: isOn ? 'var(--st-good)' : 'var(--line-2)' }} />
                </div>
                <span className="text-[12.5px] font-semibold">{pl.name}</span>
                {isAdmin && canWrite ? (
                  isOn
                    ? <Button className="py-1 px-2 text-[11px]" onClick={() => { setOn((s) => ({ ...s, [pl.id]: false })); toast.success(`${pl.name} disconnected`) }}>Disconnect</Button>
                    : <Button variant="primary" className="py-1 px-2 text-[11px]" onClick={() => { setOn((s) => ({ ...s, [pl.id]: true })); toast.success(`${pl.name} connected`) }}>Connect</Button>
                ) : (
                  <span className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: isOn ? 'var(--st-good)' : 'var(--muted)' }}>{isOn ? 'Connected' : 'Not connected'}</span>
                )}
              </div>
            )
          })}
        </div>
        <div className="text-[11.5px] text-[var(--muted)] mt-3">Facebook and Instagram connect together through Meta. LinkedIn and TikTok connect once their developer access is approved.</div>
      </Card>

      <div>
        <div className="text-[13px] font-bold mb-1">Account sync status</div>
        <p className="text-[12.5px] text-[var(--ink-2)] mb-3">Every managed profile and when it last pulled fresh data.</p>
        <div className="flex flex-col gap-3">
          {SOCIAL_ACCOUNTS.map((a) => (
            <Card key={a.id} className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <span className="w-8 h-8 rounded-[8px] grid place-items-center mono text-[12px] font-bold text-white flex-none" style={{ background: a.color }}>{a.mark}</span>
                <div><div className="font-semibold text-[13.5px]">{a.name}</div><div className="text-[11.5px] text-[var(--muted)]">{a.handle} · synced {relTime(a.lastSyncedMin)}</div></div>
              </div>
              <div className="flex flex-wrap gap-2">
                {a.platforms.map((pid) => {
                  const pl = socialPlatform(pid)
                  const live = on[pid]
                  return (
                    <span key={pid} className="inline-flex items-center gap-1.5 bg-[var(--surface-2)] border border-[var(--line)] rounded-[8px] px-2.5 py-1.5 text-[12px]">
                      <span className="w-4 h-4 rounded-[4px] grid place-items-center text-[7px] font-bold text-white" style={{ background: pl.color }}>{pl.short}</span>
                      {pl.name}
                      <span className="w-[7px] h-[7px] rounded-full" style={{ background: live ? 'var(--st-good)' : 'var(--st-critical)' }} />
                    </span>
                  )
                })}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </Reveal>
  )
}
