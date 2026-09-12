/**
 * Migration runner. Applies server/migrations/*.sql in filename order, each in
 * its own transaction, and records what ran in schema_migrations so it is safe
 * to run on every boot. No-op when there is no database configured.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { pool } from './db.js'

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations')

export async function runMigrations(): Promise<void> {
  if (!pool) { console.log('migrate: no DATABASE_URL, skipping'); return }
  await pool.query('create table if not exists schema_migrations (name text primary key, run_at timestamptz not null default now())')
  const done = new Set((await pool.query('select name from schema_migrations')).rows.map((r) => r.name as string))
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
  for (const file of files) {
    if (done.has(file)) continue
    const sql = readFileSync(join(dir, file), 'utf8')
    const client = await pool.connect()
    try {
      await client.query('begin')
      await client.query(sql)
      await client.query('insert into schema_migrations(name) values ($1)', [file])
      await client.query('commit')
      console.log('migrate: applied', file)
    } catch (err) {
      await client.query('rollback')
      throw err
    } finally {
      client.release()
    }
  }
}

// Allow `npm run migrate` as a standalone command.
if (process.argv[1] && process.argv[1].endsWith('migrate.ts')) {
  runMigrations().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
}
