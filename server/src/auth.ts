/**
 * Magic-link auth and server sessions.
 *
 * Request: we insert a single-use token (only its hash is stored) and email a
 * link. Verify: on a valid token we find-or-create the user, and a brand-new
 * user gets a personal workspace with an owner membership (signup == first
 * login). A session row is created and its raw token goes in an httpOnly cookie.
 */
import crypto from 'node:crypto'
import { pool } from './db.js'
import { sendMagicLink } from './email.js'

const LINK_TTL_MIN = 15
const SESSION_TTL_DAYS = 30
const API_URL = process.env.API_URL ?? 'http://localhost:8080'

const rawToken = () => crypto.randomBytes(32).toString('base64url')
const sha = (t: string) => crypto.createHash('sha256').update(t).digest('hex')

function db() {
  if (!pool) throw new Error('database not configured')
  return pool
}

export interface SessionUser { id: string; email: string; name: string | null }

/** Insert a single-use token and email the link. Always safe to call — it never
 *  reveals whether the email already has an account. Returns the link only in
 *  non-production, so local dev can complete the flow without an inbox. */
export async function requestMagicLink(email: string): Promise<{ devLink?: string }> {
  const e = email.trim().toLowerCase()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new Error('invalid email')
  const token = rawToken()
  await db().query(
    'insert into magic_link_tokens (email, token_hash, expires_at) values ($1, $2, now() + ($3 || \' minutes\')::interval)',
    [e, sha(token), String(LINK_TTL_MIN)],
  )
  const link = `${API_URL}/api/auth/callback?token=${token}`
  await sendMagicLink(e, link)
  return process.env.NODE_ENV === 'production' ? {} : { devLink: link }
}

/** Verify a token, provision the user/workspace on first login, and open a
 *  session. Returns the raw session token to set as a cookie, or null. */
export async function verifyMagicLink(token: string): Promise<{ sessionToken: string } | null> {
  const client = await db().connect()
  try {
    await client.query('begin')
    const found = await client.query(
      'update magic_link_tokens set consumed_at = now() where token_hash = $1 and consumed_at is null and expires_at > now() returning email',
      [sha(token)],
    )
    if (found.rowCount === 0) { await client.query('rollback'); return null }
    const email = found.rows[0].email as string

    let user = (await client.query('select id from users where email = $1', [email])).rows[0]
    if (!user) {
      user = (await client.query('insert into users (email) values ($1) returning id', [email])).rows[0]
      const ws = (await client.query('insert into workspaces default values returning id')).rows[0]
      await client.query('insert into memberships (user_id, workspace_id, role) values ($1, $2, $3)', [user.id, ws.id, 'owner'])
    }

    const sessionToken = rawToken()
    await client.query(
      'insert into sessions (token_hash, user_id, expires_at) values ($1, $2, now() + ($3 || \' days\')::interval)',
      [sha(sessionToken), user.id, String(SESSION_TTL_DAYS)],
    )
    await client.query('commit')
    return { sessionToken }
  } catch (err) {
    await client.query('rollback')
    throw err
  } finally {
    client.release()
  }
}

/** Resolve a session cookie to its user, or null. */
export async function sessionUser(sessionToken: string | undefined): Promise<SessionUser | null> {
  if (!sessionToken || !pool) return null
  const r = await pool.query(
    `select u.id, u.email, u.name from sessions s
       join users u on u.id = s.user_id
      where s.token_hash = $1 and s.expires_at > now()`,
    [sha(sessionToken)],
  )
  return r.rows[0] ?? null
}

export async function endSession(sessionToken: string | undefined): Promise<void> {
  if (!sessionToken || !pool) return
  await pool.query('delete from sessions where token_hash = $1', [sha(sessionToken)])
}

/** The /api/me payload: the user plus every workspace they belong to. */
export async function meFor(userId: string) {
  const r = await db().query(
    `select w.id, w.agency_name, w.logo_url, w.brand, m.role
       from memberships m join workspaces w on w.id = m.workspace_id
      where m.user_id = $1
      order by w.created_at asc`,
    [userId],
  )
  return r.rows.map((w) => ({
    id: w.id, agencyName: w.agency_name, logo: w.logo_url, brand: w.brand, role: w.role,
  }))
}

/** The user's primary workspace id (their earliest membership). A workspace
 *  switcher can replace this later; for now each user has one. */
export async function firstWorkspaceId(userId: string): Promise<string | null> {
  const r = await db().query(
    'select workspace_id from memberships where user_id=$1 order by created_at asc limit 1',
    [userId],
  )
  return r.rows[0]?.workspace_id ?? null
}

export const SESSION_TTL_SECONDS = SESSION_TTL_DAYS * 24 * 60 * 60
