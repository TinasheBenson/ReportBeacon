/**
 * Email + password auth. Passwords are bcrypt-hashed; sessions are the same
 * server-side, httpOnly-cookie sessions the magic-link flow uses. First signup
 * provisions the user's own workspace (owner) and seeds the demo roster into it,
 * so a brand-new account opens onto a populated console — the demo sells itself.
 * Brute force is throttled per {ip}:{email}.
 */
import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import { pool } from './db.js'
import { seedClientsForWorkspace } from './store.js'

const SESSION_TTL_DAYS = 30
const MAX_ATTEMPTS = 5
const LOCK_MINUTES = 15

const rawToken = () => crypto.randomBytes(32).toString('base64url')
const sha = (t: string) => crypto.createHash('sha256').update(t).digest('hex')
const emailValid = (e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)

function db() {
  if (!pool) throw new Error('database not configured')
  return pool
}

export class AuthError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

async function createSession(userId: string): Promise<string> {
  const token = rawToken()
  await db().query(
    "insert into sessions (token_hash, user_id, expires_at) values ($1, $2, now() + ($3 || ' days')::interval)",
    [sha(token), userId, String(SESSION_TTL_DAYS)],
  )
  return token
}

export async function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 12)
}

/** Create a user + their own owner workspace, seed the roster, open a session. */
export async function registerUser(rawEmail: string, password: string, name: string | null): Promise<{ sessionToken: string }> {
  const email = String(rawEmail).trim().toLowerCase()
  if (!emailValid(email)) throw new AuthError(400, 'Enter a valid email address.')
  if (typeof password !== 'string' || password.length < 8) throw new AuthError(400, 'Password must be at least 8 characters.')

  const client = await db().connect()
  try {
    await client.query('begin')
    const exists = await client.query('select 1 from users where email = $1', [email])
    if ((exists.rowCount ?? 0) > 0) throw new AuthError(409, 'An account with that email already exists.')

    const hash = await hashPassword(password)
    const user = (await client.query(
      'insert into users (email, name, password_hash) values ($1, $2, $3) returning id',
      [email, name?.trim() || null, hash],
    )).rows[0]
    const ws = (await client.query("insert into workspaces (agency_name) values ('Your Agency') returning id")).rows[0]
    await client.query('insert into memberships (user_id, workspace_id, role) values ($1, $2, $3)', [user.id, ws.id, 'owner'])
    await client.query('commit')
    // Session + roster seed happen post-commit so the FK to users is satisfied.
    const sessionToken = await createSession(user.id)
    await seedClientsForWorkspace(ws.id).catch((e) => console.error('seed roster for new workspace failed:', e))
    return { sessionToken }
  } catch (err) {
    await client.query('rollback')
    throw err
  } finally {
    client.release()
  }
}

async function lockState(identifier: string): Promise<{ locked: boolean }> {
  const r = await db().query('select count, locked_until from login_attempts where identifier = $1', [identifier])
  const row = r.rows[0]
  if (row?.locked_until && new Date(row.locked_until) > new Date()) return { locked: true }
  return { locked: false }
}

async function recordFailure(identifier: string): Promise<void> {
  await db().query(
    `insert into login_attempts (identifier, count, updated_at) values ($1, 1, now())
     on conflict (identifier) do update set
       count = login_attempts.count + 1,
       locked_until = case when login_attempts.count + 1 >= $2 then now() + ($3 || ' minutes')::interval else login_attempts.locked_until end,
       updated_at = now()`,
    [identifier, MAX_ATTEMPTS, String(LOCK_MINUTES)],
  )
}

async function clearAttempts(identifier: string): Promise<void> {
  await db().query('delete from login_attempts where identifier = $1', [identifier])
}

export async function loginUser(rawEmail: string, password: string, ip: string): Promise<{ sessionToken: string }> {
  const email = String(rawEmail).trim().toLowerCase()
  const identifier = `${ip}:${email}`
  if (!emailValid(email) || typeof password !== 'string') throw new AuthError(400, 'Enter a valid email and password.')

  if ((await lockState(identifier)).locked) {
    throw new AuthError(429, 'Too many attempts. Try again in a few minutes.')
  }

  const r = await db().query('select id, password_hash from users where email = $1', [email])
  const user = r.rows[0]
  const ok = user?.password_hash ? await bcrypt.compare(password, user.password_hash) : false
  if (!ok) {
    await recordFailure(identifier)
    throw new AuthError(401, 'Incorrect email or password.')
  }
  await clearAttempts(identifier)
  return { sessionToken: await createSession(user.id) }
}
