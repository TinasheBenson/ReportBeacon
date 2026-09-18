/**
 * Social data source — the seam between the Social face and where its numbers
 * come from.
 *
 * Signed in, it reads GET /api/social/accounts, which returns accounts already
 * shaped like `SocialAccount` (60-day reach and engagement curves, per-channel
 * stats, recent posts). Every derived helper in lib/social.ts — metrics, health,
 * alerts, recommendations — then works on live Meta data unchanged.
 *
 * Signed out, or with nothing connected yet, it falls back to the demo roster so
 * the public showcase and the zero-backend Vercel build keep working.
 *
 * `source` says which it is ('live' | 'seed' | 'demo'), and the UI labels seeded
 * or demo numbers rather than passing them off as real.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useApp } from '@/context/app'
import { apiClient, metaConnectUrl } from '@/lib/apiClient'
import { SOCIAL_ACCOUNTS, type SocialAccount } from '@/lib/social'

export type SocialSource = 'live' | 'seed' | 'demo'

interface SocialCtx {
  accounts: SocialAccount[]
  /** Where the numbers on screen came from. */
  source: SocialSource
  /** True once the workspace has at least one connected account. */
  connected: boolean
  /** True when the server has a Meta app configured (so Connect is real). */
  metaConfigured: boolean
  loading: boolean
  syncing: boolean
  error: string | null
  /** Re-read the roster from the API. */
  refresh: () => Promise<void>
  /** Re-pull from Meta, then refresh. */
  sync: () => Promise<{ live: number; errors: string[] } | null>
  /** Send the browser into the Meta OAuth flow. */
  connectMeta: () => void
  accountById: (id: string) => SocialAccount | undefined
}

const Ctx = createContext<SocialCtx | null>(null)

export function SocialProvider({ children }: { children: ReactNode }) {
  const { user } = useApp()
  const [accounts, setAccounts] = useState<SocialAccount[] | null>(null)
  const [source, setSource] = useState<SocialSource>('demo')
  const [metaConfigured, setMetaConfigured] = useState(false)
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user) { setAccounts(null); setSource('demo'); return }
    setLoading(true)
    try {
      const res = await apiClient.socialAccounts()
      setMetaConfigured(res.metaConfigured)
      if (res.accounts?.length) {
        setAccounts(res.accounts as SocialAccount[])
        setSource(res.source === 'live' ? 'live' : 'seed')
      } else {
        // Nothing connected yet — show the demo roster so the face isn't blank.
        setAccounts(null)
        setSource('demo')
      }
      setError(null)
    } catch (err) {
      // Offline or the API is down: the demo roster keeps the app usable.
      setAccounts(null)
      setSource('demo')
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { void load() }, [load])

  const sync = useCallback(async () => {
    if (!user) return null
    setSyncing(true)
    try {
      const res = await apiClient.syncSocial()
      if (res.accounts?.length) {
        setAccounts(res.accounts as SocialAccount[])
        setSource(res.live > 0 ? 'live' : 'seed')
      }
      setError(null)
      return { live: res.live, errors: res.errors ?? [] }
    } catch (err) {
      setError((err as Error).message)
      throw err
    } finally {
      setSyncing(false)
    }
  }, [user])

  const value = useMemo<SocialCtx>(() => {
    const list = accounts ?? SOCIAL_ACCOUNTS
    return {
      accounts: list,
      source,
      connected: !!accounts?.length,
      metaConfigured,
      loading,
      syncing,
      error,
      refresh: load,
      sync,
      connectMeta: () => { window.location.href = metaConnectUrl() },
      accountById: (id: string) => list.find((a) => a.id === id),
    }
  }, [accounts, source, metaConfigured, loading, syncing, error, load, sync])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useSocial(): SocialCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useSocial must be used inside <SocialProvider>')
  return ctx
}
