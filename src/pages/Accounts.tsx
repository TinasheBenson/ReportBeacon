/** Accounts: the full roster, searchable, with the range control.
 *  Owners can add, edit and remove clients right here. */
import { useMemo, useState } from 'react'
import { Search, Plus, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useApp } from '@/context/app'
import { useWorkspace } from '@/context/workspace'
import { RANGES, type Account } from '@/lib/data'
import { useLoading } from '@/lib/useLoading'
import { Segmented, TableSkeleton, Button, Card } from '@/components/ui/kit'
import { Reveal } from '@/components/ui/disclosure'
import AccountsTable from '@/components/AccountsTable'
import ClientEditorModal from '@/components/ClientEditorModal'

export default function Accounts() {
  const { range, setRange } = useApp()
  const { me, isAdmin, accountsForSeat, removeClient } = useWorkspace()
  const [q, setQ] = useState('')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<Account | null>(null)
  const scope = me ? accountsForSeat(me) : []
  const loading = useLoading([me?.id], 380)

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return scope
    return scope.filter((a) => (a.name + ' ' + a.trade + ' ' + a.location).toLowerCase().includes(s))
  }, [q, scope])

  function openAdd() { setEditing(null); setEditorOpen(true) }
  function openEdit(a: Account) { setEditing(a); setEditorOpen(true) }
  function remove(a: Account) {
    removeClient(a.id)
    toast.success('Client removed', { description: `${a.name} is off your roster` })
  }

  if (loading) return <TableSkeleton rows={scope.length} />

  return (
    <Reveal className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-[340px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search accounts"
            data-testid="accounts-search"
            className="w-full bg-[var(--surface)] border border-[var(--line-2)] rounded-[8px] pl-9 pr-3 py-2 text-[13px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>
        <span className="text-[12.5px] text-[var(--muted)]">{filtered.length} of {scope.length}</span>
        <div className="ml-auto flex items-center gap-2.5">
          <Segmented value={range} onChange={setRange} options={RANGES.map((r) => ({ value: r.id, label: r.label }))} />
          {isAdmin && <Button variant="primary" onClick={openAdd} data-testid="add-client-button"><Plus size={15} /> Add client</Button>}
        </div>
      </div>
      {filtered.length > 0 ? (
        <AccountsTable range={range} accounts={filtered} showManager={isAdmin} />
      ) : (
        <div className="text-center text-[13px] text-[var(--muted)] py-12">No accounts match “{q}”.</div>
      )}

      {isAdmin && scope.length > 0 && (
        <Card className="p-4" data-testid="manage-roster">
          <div className="text-[13px] font-bold mb-1">Manage roster</div>
          <p className="text-[12px] text-[var(--muted)] mb-3">Edit a client's details or remove it. Changes save to your workspace.</p>
          <div className="flex flex-col divide-y divide-[var(--line)]">
            {scope.map((a) => (
              <div key={a.id} className="flex items-center gap-3 py-2.5" data-testid={`roster-row-${a.id}`}>
                <span className="w-7 h-7 rounded-[7px] grid place-items-center mono text-[10px] font-bold text-white flex-none" style={{ background: a.color }}>{a.mark}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold truncate">{a.name}</div>
                  <div className="text-[11.5px] text-[var(--muted)]">{a.trade} · {a.location}</div>
                </div>
                <Button className="py-1 px-2.5 text-[12px]" onClick={() => openEdit(a)} data-testid={`edit-client-${a.id}`}><Pencil size={13} /> Edit</Button>
                <button onClick={() => remove(a)} title="Remove" data-testid={`remove-client-${a.id}`}
                  className="grid place-items-center w-8 h-8 rounded-[8px] border border-[var(--line-2)] text-[var(--muted)] hover:text-[var(--st-critical)] hover:border-[color-mix(in_srgb,var(--st-critical)_40%,transparent)] transition-colors"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <ClientEditorModal open={editorOpen} initial={editing} onClose={() => setEditorOpen(false)} />
    </Reveal>
  )
}
