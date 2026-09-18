/** Social integrations: connect the platforms a social manager runs on, and
 *  keep the numbers fresh once they are connected. */
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { PlugZap, RefreshCw, AlertTriangle, Stethoscope } from 'lucide-react'
import { useWorkspace } from '@/context/workspace'
import { useSocial } from '@/context/social'
import { setupCheckUrl } from '@/lib/apiClient'
import { SOCIAL_PLATFORMS, socialPlatform, type SocialPlatformId } from '@/lib/social'
import { relTime } from '@/lib/format'
import { Card, Button } from '@/components/ui/kit'
import { ClientMark } from '@/components/ClientMark'
import { PlatformLogo } from '@/components/social/PlatformLogo'
import { SourceBadge } from '@/components/social/SourceBadge'
import { Reveal } from '@/components/ui/disclosure'

/** Facebook and Instagram arrive together through the Meta connect flow.
 *  LinkedIn has its own. TikTok is not built. */
const VIA_META: SocialPlatformId[] = ['instagram', 'facebook']

export default function SocialIntegrations() {
  const { isAdmin, canWrite } = useWorkspace()
  const { accounts, source, connected, metaConfigured, linkedinConfigured, syncing, sync, connectMeta, connectLinkedIn, refresh } = useSocial()
  const [params, setParams] = useSearchParams()
  const [lastErrors, setLastErrors] = useState<string[]>([])

  // The Meta callback redirects back here with the outcome on the query string.
  useEffect(() => {
    const connectedParam = params.get('connected')
    const problem = params.get('connect')
    if (connectedParam) {
      const label = connectedParam === 'linkedin' ? 'LinkedIn' : 'Meta'
      const n = Number(params.get('accounts') ?? 0)
      const live = Number(params.get('live') ?? 0)
      toast.success(`${label} connected — ${n} account${n === 1 ? '' : 's'} imported${live > 0 ? `, ${live} pulling live data` : ''}`)
      void refresh()
    } else if (problem === 'error') {
      // The server passes the real reason through: "administers no company
      // pages" and "not approved for this API" need different responses.
      const reason = params.get('reason')
      toast.error(reason ? decodeURIComponent(reason) : 'Connection failed. Check the app credentials and try again.')
    } else if (problem === 'denied') {
      toast.error('Authorisation was declined.')
    } else if (problem === 'linkedin-unconfigured') {
      toast.error('No LinkedIn app is configured on the server yet.')
    } else if (problem === 'invalid') {
      toast.error('That connect link expired. Try connecting again.')
    }
    if (connectedParam || problem) {
      for (const k of ['connected', 'accounts', 'live', 'connect', 'reason']) params.delete(k)
      setParams(params, { replace: true })
    }
  }, [params, setParams, refresh])

  async function runSync() {
    try {
      const res = await sync()
      if (!res) return
      setLastErrors(res.errors)
      if (res.live > 0) toast.success(`Synced — ${res.live} channel${res.live === 1 ? '' : 's'} pulled live from Meta`)
      else if (res.errors.length) toast.error('Sync finished, but no channel returned live data.')
      else toast.success('Synced.')
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  const connectedPlatforms = new Set(accounts.flatMap((a) => a.platforms))

  return (
    <Reveal className="flex flex-col gap-5 max-w-[980px]">
      <Card className="p-5">
        <div className="flex items-start gap-3 mb-4">
          <span className="w-9 h-9 rounded-[9px] grid place-items-center flex-none" style={{ background: 'var(--accent-weak)', color: 'var(--accent)' }}><PlugZap size={18} /></span>
          <div className="flex-1">
            <div className="text-[14px] font-bold">Social connections</div>
            <div className="text-[12.5px] text-[var(--ink-2)] mt-0.5">Connect a platform and ReportBeacon pulls in the profiles and posts you manage there.</div>
          </div>
          <SourceBadge source={source} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          {SOCIAL_PLATFORMS.map((pl) => {
            const viaMeta = VIA_META.includes(pl.id)
            const isOn = connectedPlatforms.has(pl.id)
            return (
              <div key={pl.id} className="bg-[var(--surface-2)] border border-[var(--line)] rounded-[9px] px-3 py-3 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <PlatformLogo platform={pl.id} size={26} />
                  <span className="w-[9px] h-[9px] rounded-full" style={{ background: isOn ? 'var(--st-good)' : 'var(--line-2)' }} />
                </div>
                <span className="text-[12.5px] font-semibold">{pl.name}</span>
                {viaMeta || pl.id === 'linkedin' ? (
                  isAdmin && canWrite ? (
                    <Button
                      variant={isOn ? undefined : 'primary'}
                      className="py-1 px-2 text-[11px]"
                      onClick={viaMeta ? connectMeta : connectLinkedIn}
                      title={pl.id === 'linkedin' && !linkedinConfigured
                        ? 'No LinkedIn app is configured on the server yet.'
                        : undefined}
                    >
                      {isOn ? 'Reconnect' : 'Connect'}
                    </Button>
                  ) : (
                    <span className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: isOn ? 'var(--st-good)' : 'var(--muted)' }}>{isOn ? 'Connected' : 'Not connected'}</span>
                  )
                ) : (
                  <span className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--muted)]">Not built</span>
                )}
              </div>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-4">
          {isAdmin && canWrite && connected && (
            <Button className="py-1.5 px-3 text-[12px] inline-flex items-center gap-1.5" onClick={runSync} disabled={syncing}>
              <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
              {syncing ? 'Syncing…' : 'Sync now'}
            </Button>
          )}
          <a
            href={setupCheckUrl()}
            target="_blank"
            rel="noreferrer"
            title="Checks every deployment requirement and says, in plain English, what to change for anything that is not working."
            className="py-1.5 px-3 text-[12px] inline-flex items-center gap-1.5 rounded-[8px] border border-[var(--line)] hover:bg-[var(--surface-2)] transition-colors"
          >
            <Stethoscope size={13} />
            Setup check
          </a>
          <span className="text-[11.5px] text-[var(--muted)]">
            Facebook and Instagram connect together through Meta. LinkedIn needs its Community Management API approved by LinkedIn before it returns any data, and only company pages you administer can be connected.
          </span>
        </div>

        {!linkedinConfigured && (
          <div className="mt-3 text-[11.5px] rounded-[8px] px-3 py-2 flex items-start gap-2" style={{ background: 'var(--surface-2)', color: 'var(--ink-2)' }}>
            <AlertTriangle size={13} className="mt-0.5 flex-none" style={{ color: 'var(--st-warn)' }} />
            <span>No LinkedIn app is configured, so LinkedIn cannot connect yet. Set <code>LINKEDIN_CLIENT_ID</code> and <code>LINKEDIN_CLIENT_SECRET</code>, and note that LinkedIn must approve the app for the Community Management API before it returns any statistics.</span>
          </div>
        )}

        {!metaConfigured && (
          <div className="mt-3 text-[11.5px] rounded-[8px] px-3 py-2 flex items-start gap-2" style={{ background: 'var(--surface-2)', color: 'var(--ink-2)' }}>
            <AlertTriangle size={13} className="mt-0.5 flex-none" style={{ color: 'var(--st-warn)' }} />
            <span>No Meta app is configured on the server, so connecting runs against a mock and imports sample accounts. Set <code>META_APP_ID</code> and <code>META_APP_SECRET</code> to pull real data.</span>
          </div>
        )}

        {lastErrors.length > 0 && (
          <div className="mt-3 text-[11.5px] rounded-[8px] px-3 py-2" style={{ background: 'var(--surface-2)', color: 'var(--ink-2)' }}>
            <div className="font-semibold mb-1 flex items-center gap-1.5" style={{ color: 'var(--st-warn)' }}><AlertTriangle size={13} /> Last sync reported</div>
            <ul className="list-disc pl-4 flex flex-col gap-0.5">
              {lastErrors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </div>
        )}
      </Card>

      <div>
        <div className="text-[13px] font-bold mb-1">Account sync status</div>
        <p className="text-[12.5px] text-[var(--ink-2)] mb-3">Every managed profile and when it last pulled fresh data.</p>
        <div className="flex flex-col gap-3">
          {accounts.map((a) => (
            <Card key={a.id} className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <ClientMark account={a} className="w-8 h-8 rounded-[8px] text-[12px]" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[13.5px]">{a.name}</div>
                  <div className="text-[11.5px] text-[var(--muted)]">{a.handle} · synced {relTime(a.lastSyncedMin)}</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {a.channels.map((ch) => {
                  const pl = socialPlatform(ch.platform)
                  const healthy = (ch as { status?: string }).status !== 'needs_reauth'
                  return (
                    <span key={ch.platform} className="inline-flex items-center gap-1.5 bg-[var(--surface-2)] border border-[var(--line)] rounded-[8px] px-2.5 py-1.5 text-[12px]"
                      title={healthy ? undefined : 'This channel needs reconnecting — its token was rejected.'}>
                      <PlatformLogo platform={ch.platform} size={16} />
                      {pl.name}
                      <span className="w-[7px] h-[7px] rounded-full" style={{ background: healthy ? 'var(--st-good)' : 'var(--st-critical)' }} />
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
