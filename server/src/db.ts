/**
 * Postgres connection. Railway injects DATABASE_URL when a Postgres plugin is
 * attached to the service; until then the pool stays unconfigured and the API
 * still boots (health reports the database as "unconfigured" rather than
 * crashing), so the service is deployable before the database exists.
 */
import { Pool } from 'pg'

const url = process.env.DATABASE_URL?.trim()

export const pool = url
  ? new Pool({
      connectionString: url,
      // Railway's managed Postgres terminates TLS with its own CA; in production
      // accept it without pinning. Local dev over a plain socket needs no SSL.
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
      max: 5,
    })
  : null

export const dbConfigured = !!pool

/** Round-trips a trivial query so /health reflects real connectivity. */
export async function dbHealthy(): Promise<boolean> {
  if (!pool) return false
  try {
    await pool.query('select 1')
    return true
  } catch {
    return false
  }
}
