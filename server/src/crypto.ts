/**
 * App-layer encryption for secrets at rest (platform access tokens) and signed,
 * stateless values (the OAuth `state` parameter).
 *
 * Tokens: AES-256-GCM. The stored bytea is iv(12) ++ tag(16) ++ ciphertext.
 * The key comes from TOKEN_ENC_KEY (base64, 32 bytes); dev falls back to a fixed
 * derived key with a warning so the flow runs locally, but production must set a
 * real key or tokens written under the dev key won't decrypt after a redeploy.
 */
import crypto from 'node:crypto'

function loadKey(): Buffer {
  // Trimmed: a trailing newline on a pasted key changes its decoded length
  // and the service then refuses to boot with a confusing length error.
  const b64 = process.env.TOKEN_ENC_KEY?.trim()
  if (b64) {
    const k = Buffer.from(b64, 'base64')
    if (k.length !== 32) throw new Error('TOKEN_ENC_KEY must be 32 bytes (base64)')
    return k
  }
  if (process.env.NODE_ENV === 'production') throw new Error('TOKEN_ENC_KEY is required in production')
  console.warn('crypto: TOKEN_ENC_KEY unset, using a dev key (do not use in production)')
  return crypto.createHash('sha256').update('reportbeacon-dev-key').digest()
}
const KEY = loadKey()

/** True when a real TOKEN_ENC_KEY was supplied (not the dev fallback). The
 *  setup check reports this, because tokens encrypted under the dev key stop
 *  decrypting the moment a real key is set. */
export const tokenKeyConfigured = !!process.env.TOKEN_ENC_KEY

export function encrypt(plain: string): Buffer {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), enc])
}

export function decrypt(buf: Buffer): string {
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const enc = buf.subarray(28)
  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8')
}

// ── signed OAuth state (CSRF protection on the connect flow) ──────────────────
const STATE_SECRET = process.env.OAUTH_STATE_SECRET?.trim() || process.env.TOKEN_ENC_KEY?.trim() || 'reportbeacon-dev-state'
const STATE_TTL_MS = 10 * 60 * 1000
const b64u = (b: Buffer) => b.toString('base64url')
const hmac = (body: string) => crypto.createHmac('sha256', STATE_SECRET).update(body).digest('base64url')

export function signState(data: Record<string, unknown>): string {
  const body = b64u(Buffer.from(JSON.stringify({ ...data, exp: Date.now() + STATE_TTL_MS })))
  return `${body}.${hmac(body)}`
}

export function verifyState<T = Record<string, unknown>>(state: string): T | null {
  const [body, sig] = state.split('.')
  if (!body || !sig) return null
  const expected = hmac(body)
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    if (typeof data.exp !== 'number' || data.exp < Date.now()) return null
    return data as T
  } catch { return null }
}
