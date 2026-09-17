/**
 * Demo seeding. Three shared demo accounts — owner, manager, viewer — all belong
 * to ONE workspace so signing in as each shows the same agency scoped by role.
 * Idempotent: safe to run on every boot; refreshes the password if it changed.
 */
import bcrypt from 'bcryptjs'
import { pool } from './db.js'
import { hashPassword } from './passwordAuth.js'
import { seedClientsForWorkspace } from './store.js'

const DEMO_WS = '00000000-0000-0000-0000-0000000000d0'

interface DemoUser { email: string; name: string; role: 'owner' | 'manager' | 'viewer' }

export async function seedDemo(): Promise<void> {
  if (!pool) return
  const password = process.env.DEMO_PASSWORD || 'demo1234'
  const users: DemoUser[] = [
    { email: process.env.DEMO_OWNER_EMAIL || 'owner@reportbeacon.demo', name: 'Tinashe Benson', role: 'owner' },
    { email: process.env.DEMO_MANAGER_EMAIL || 'manager@reportbeacon.demo', name: 'Dana Okafor', role: 'manager' },
    { email: process.env.DEMO_VIEWER_EMAIL || 'viewer@reportbeacon.demo', name: 'Priya Shah', role: 'viewer' },
  ]

  await pool.query(
    "insert into workspaces (id, agency_name) values ($1, 'Northstar Digital') on conflict (id) do nothing",
    [DEMO_WS],
  )

  const hash = await hashPassword(password)
  for (const u of users) {
    const email = u.email.trim().toLowerCase()
    const existing = (await pool.query('select id, password_hash from users where email = $1', [email])).rows[0]
    let userId: string
    if (!existing) {
      userId = (await pool.query(
        'insert into users (email, name, password_hash) values ($1, $2, $3) returning id',
        [email, u.name, hash],
      )).rows[0].id
    } else {
      userId = existing.id
      const matches = existing.password_hash ? await bcrypt.compare(password, existing.password_hash) : false
      if (!matches) await pool.query('update users set password_hash = $1, name = $2 where id = $3', [hash, u.name, userId])
    }
    await pool.query(
      `insert into memberships (user_id, workspace_id, role) values ($1, $2, $3)
       on conflict (user_id, workspace_id) do update set role = excluded.role`,
      [userId, DEMO_WS, u.role],
    )
  }

  await seedClientsForWorkspace(DEMO_WS)
  console.log('seed: demo workspace + owner/manager/viewer ready')
}
