/**
 * Application persistence — the JSONB-backed stores the frontend reads/writes
 * instead of localStorage: the workspace blob, the seeded client roster, and
 * saved reports. Everything is workspace-scoped.
 */
import { pool } from './db.js'
import { seedCatalog } from './catalog.js'

function db() {
  if (!pool) throw new Error('database not configured')
  return pool
}

// ── workspace state (the persisted Persisted blob) ────────────────────────────
export async function getWorkspaceState(workspaceId: string): Promise<Record<string, unknown>> {
  const r = await db().query('select state from workspace_state where workspace_id = $1', [workspaceId])
  return r.rows[0]?.state ?? {}
}

export async function putWorkspaceState(workspaceId: string, state: Record<string, unknown>): Promise<void> {
  await db().query(
    `insert into workspace_state (workspace_id, state, updated_at) values ($1, $2, now())
     on conflict (workspace_id) do update set state = excluded.state, updated_at = now()`,
    [workspaceId, state],
  )
}

// ── clients (the demo roster) ─────────────────────────────────────────────────
/** Seed the roster into a workspace once (idempotent — skips if it already has clients). */
export async function seedClientsForWorkspace(workspaceId: string): Promise<void> {
  const existing = await db().query('select 1 from clients where workspace_id = $1 limit 1', [workspaceId])
  if ((existing.rowCount ?? 0) > 0) return
  for (const c of seedCatalog()) {
    await db().query(
      'insert into clients (workspace_id, client_id, data, importable) values ($1, $2, $3, $4) on conflict do nothing',
      [workspaceId, c.id, c.data, c.importable],
    )
  }
}

export async function listClients(workspaceId: string): Promise<{ clients: unknown[]; importableIds: string[] }> {
  const r = await db().query(
    'select client_id, data, importable from clients where workspace_id = $1 order by created_at',
    [workspaceId],
  )
  return {
    clients: r.rows.map((row) => row.data),
    importableIds: r.rows.filter((row) => row.importable).map((row) => row.client_id as string),
  }
}

// ── client editor (owner-managed roster) ─────────────────────────────────────
export async function upsertClient(workspaceId: string, id: string, data: unknown, importable = false): Promise<void> {
  await db().query(
    `insert into clients (workspace_id, client_id, data, importable) values ($1, $2, $3, $4)
     on conflict (workspace_id, client_id) do update set data = excluded.data, importable = excluded.importable`,
    [workspaceId, id, data, importable],
  )
}

export async function deleteClient(workspaceId: string, id: string): Promise<boolean> {
  const r = await db().query('delete from clients where workspace_id = $1 and client_id = $2', [workspaceId, id])
  return (r.rowCount ?? 0) > 0
}

// ── reports ───────────────────────────────────────────────────────────────────
export async function listReports(workspaceId: string) {
  const r = await db().query(
    `select r.id, r.name, r.config, r.created_at, u.name as author_name, u.email as author_email
       from reports r left join users u on u.id = r.author_id
      where r.workspace_id = $1 order by r.created_at desc`,
    [workspaceId],
  )
  return r.rows.map((row) => ({
    id: row.id, name: row.name, config: row.config, createdAt: row.created_at,
    authorName: row.author_name, authorEmail: row.author_email,
  }))
}

export async function createReport(workspaceId: string, authorId: string, name: string, config: Record<string, unknown>) {
  const r = await db().query(
    'insert into reports (workspace_id, author_id, name, config) values ($1, $2, $3, $4) returning id, name, config, created_at',
    [workspaceId, authorId, name, config],
  )
  return r.rows[0]
}

export async function deleteReport(workspaceId: string, id: string): Promise<boolean> {
  const r = await db().query('delete from reports where workspace_id = $1 and id = $2', [workspaceId, id])
  return (r.rowCount ?? 0) > 0
}
