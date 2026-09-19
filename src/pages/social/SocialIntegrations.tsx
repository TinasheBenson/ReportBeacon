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

export default function SocialIntegrations() {
  const { isAdmin, canWrite } = useWorkspace()
  const {
    accounts, source, connected, metaConfigured, linkedinConfigured, instagramConfigured,
    syncing, sync, connectMeta, connectLinkedIn, connectInstagram, refresh,
  } = useSocial()
  const [params, setParams] = useSearchParams()
  const [lastErrors, setLastErrors] = useState<string[]>([])

  // The Meta callback redirects back here with the outcome on the query string.
  useEffect(() => {
    const connectedParam = params.get('connected')
    const problem = params.get('connect')
    if (connectedParam) {
      const label = connectedParam === 'linkedin' ? 'LinkedIn'
        : connectedParam === 'instagram' ? 'Instagram' : 'Meta'
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
    } else if (problem === 'instagram-unconfigured') {
      toast.error('No Instagram app is configured on the server yet.')
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
      if (res.live > 0) toast.success(`Synced — ${res.live} channel${res.live === 1 ? '' : 's'} pulled live`)
      else if (res.errors.length) toast.error('Sync finished, but no channel returned live data.')
      else toast.success('Synced.')
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  const connectedPlatforms = new Set(accounts.flatMap((a) => a.platforms))

  /**
   * Which OAuth flow a platform's Connect button starts, or null if it isn't
   * built.
   *
   * Instagram is the awkward one: it can be reached two ways and they are not
   * interchangeable. Instagram Login authorises on instagram.com and works at
   * standard access, so it is the default — but it brings Instagram alone.
   * Facebook Login brings the Page and its linked Instagram account together,
   * which is what an agency running both actually wants, but Meta gates it
   * behind advanced access and therefore Business Verification. Neither is
   * simply better, so the tile leads with the one that works today and keeps
   * the other a click away.
   */
  function connectRoute(id: SocialPlatformId) {
    if (id === 'instagram') {
      return instagramConfigured
        ? {
            connect: connectInstagram,
            warning: undefined,
            alternative: metaConfigured ? {
              label: 'or connect via Facebook',
              title: 'Connects the Facebook Page and its linked Instagram account together. Needs the Meta app to hold advanced access, which requires Business Verification.',
              connect: connectMeta,
            } : undefined,
          }
        : {
            connect: connectMeta,
            warning: 'No Instagram app is configured, so this goes through Facebook — which needs advanced access on the Meta app.',
            alternative: undefined,
          }
    }
    if (id === 'facebook') {
      return { connect: connectMeta, warning: undefined, alternative: undefined }
    }
    if (id === 'linkedin') {
      return {
        connect: connectLinkedIn,
        warning: linkedinConfigured ? undefined : 'No LinkedIn app is configured on the server yet.',
        alternative: undefined,
      }
    }
    return null
  }

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
            const route = connectRoute(pl.id)
            const isOn = connectedPlatforms.has(pl.id)
            return (
              <div key={pl.id} className="bg-[var(--surface-2)] border border-[var(--line)] rounded-[9px] px-3 py-3 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <PlatformLogo platform={pl.id} size={26} />
                  <span className="w-[9px] h-[9px] rounded-full" style={{ background: isOn ? 'var(--st-good)' : 'var(--line-2)' }} />
                </div>
                <span className="text-[12.5px] font-semibold">{pl.name}</span>
                {!route ? (
                  <span className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--muted)]">Not built</span>
                ) : isAdmin && canWrite ? (
                  <>
                    <Button
                      variant={isOn ? undefined : 'primary'}
                      className="py-1 px-2 text-[11px]"
                      onClick={route.connect}
                      title={route.warning}
                    >
                      {isOn ? 'Reconnect' : 'Connect'}
                    </Button>
                    {/* Instagram is the one platform with two doors, and which
                        one a given account can use is not something we can tell
                        from here — so offer the alternative rather than choose
                        silently. */}
                    {route.alternative && (
                      <button
                        type="button"
                        onClick={route.alternative.connect}
                        title={route.alternative.title}
                        className="text-[10.5px] text-[var(--muted)] underline underline-offset-2 hover:text-[var(--ink-2)] transition-colors text-left"
                      >
                        {route.alternative.label}
                      </button>
                    )}
                  </>
                ) : (
                  <span className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: isOn ? 'var(--st-good)' : 'var(--muted)' }}>{isOn ? 'Connected' : 'Not connected'}</span>
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
            Instagram connects on its own through Instagram, or together with a Facebook Page through Meta. Either way the account has to be a Professional (Business or Creator) one. LinkedIn needs its Community Management API approved by LinkedIn before it returns any data, and only company pages you administer can be connected.
          </span>
        </div>

        {!linkedinConfigured && (
          <div className="mt-3 text-[11.5px] rounded-[8px] px-3 py-2 flex items-start gap-2" style={{ background: 'var(--surface-2)', color: 'var(--ink-2)' }}>
            <AlertTriangle size={13} className="mt-0.5 flex-none" style={{ color: 'var(--st-warn)' }} />
            <span>No LinkedIn app is configured, so LinkedIn cannot connect yet. Set <code>LINKEDIN_CLIENT_ID</code> and <code>LINKEDIN_CLIENT_SECRET</code>, and note that LinkedIn must approve the app for the Community Management API before it returns any statistics.</span>
          </div>
        )}

        {!instagramConfigured && (
          <div className="mt-3 text-[11.5px] rounded-[8px] px-3 py-2 flex items-start gap-2" style={{ background: 'var(--surface-2)', color: 'var(--ink-2)' }}>
            <AlertTriangle size={13} className="mt-0.5 flex-none" style={{ color: 'var(--st-warn)' }} />
            <span>No Instagram app is configured, so Instagram can only be connected through Facebook — which needs advanced access on the Meta app, and that needs Business Verification. Set <code>INSTAGRAM_APP_ID</code> and <code>INSTAGRAM_APP_SECRET</code> (from <em>Instagram → API setup with Instagram login</em>, not the Facebook app’s credentials) to connect Instagram directly instead.</span>
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
