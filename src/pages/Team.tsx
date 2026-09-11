/**
 * Team & access (admin only): manage the team, their roles, and client
 * assignments; invite new teammates by email; archive clients that leave.
 */
import { useState } from 'react'
import { toast } from 'sonner'
import { UserPlus, Trash2, Archive, RotateCcw, Inbox, Mail, Copy, Check } from 'lucide-react'
import { useWorkspace } from '@/context/workspace'
import { ROLE_LABEL, type RoleId } from '@/lib/data'
import { Card, Button, SectionTitle } from '@/components/ui/kit'
import { Reveal } from '@/components/ui/disclosure'

const input = 'bg-[var(--surface-2)] border border-[var(--line-2)] rounded-[8px] px-3 py-2 text-[13px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent)]'

export default function Team() {
  const {
    isAdmin, members, clients, unassigned, archivedClients, managerFor, clientCount,
    addMember, removeMember, setMemberRole, assignClient, archiveClient, restoreClient,
    invitations, invite, revokeInvite,
  } = useWorkspace()
  const [name, setName] = useState('')
  const [addRole, setAddRole] = useState<RoleId>('manager')
  const [email, setEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<RoleId>('manager')
  const [copied, setCopied] = useState<string | null>(null)

  if (!isAdmin) {
    return <Card className="p-10 text-center text-[13px] text-[var(--muted)] max-w-[520px]">Team and access is managed by the agency owner.</Card>
  }

  const managers = members.filter((m) => m.role === 'manager')
  const pending = invitations.filter((i) => i.status === 'pending')

  function add() {
    const n = name.trim()
    if (!n) return
    addMember(n, addRole)
    setName('')
    toast.success(`${n} added`, { description: 'They can now sign in from the seat picker' })
  }

  function sendInvite() {
    const e = email.trim()
    if (!e) return
    const inv = invite(e, inviteRole)
    setEmail('')
    toast.success('Invitation created', { description: `${e} · ${ROLE_LABEL[inv.role]}` })
  }

  function copyLink(token: string) {
    const link = `${window.location.origin}/accept-invite?token=${token}`
    navigator.clipboard?.writeText(link).then(() => {
      setCopied(token)
      toast.success('Invite link copied', { description: 'Share it with your teammate' })
      setTimeout(() => setCopied((c) => (c === token ? null : c)), 1800)
    }).catch(() => toast.error('Could not copy the link'))
  }

  const roleOptions = (['manager', 'viewer'] as RoleId[])
  const subtitle = (role: RoleId, id: string) =>
    role === 'owner' ? 'Agency owner · all accounts'
    : role === 'viewer' ? 'Viewer · read-only, full agency'
    : `Account manager · ${clientCount(id)} clients`

  return (
    <Reveal className="flex flex-col gap-6 max-w-[920px]">
      {/* Team members */}
      <section>
        <SectionTitle>Team</SectionTitle>
        <Card className="divide-y divide-[var(--line)]">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 px-4 py-3">
              <span className="w-9 h-9 rounded-full grid place-items-center flex-none text-[12px] font-bold text-white" style={{ background: m.role === 'owner' ? 'var(--ink)' : m.role === 'viewer' ? 'var(--muted)' : 'var(--accent)' }}>{m.initials}</span>
              <div className="flex-1 min-w-0">
                <div className="text-[13.5px] font-semibold">{m.name}</div>
                <div className="text-[11.5px] text-[var(--muted)]">{subtitle(m.role, m.id)}</div>
              </div>
              {m.role !== 'owner' && (
                <>
                  <select value={m.role} onChange={(e) => { setMemberRole(m.id, e.target.value as RoleId); toast.success(`${m.name} is now a ${ROLE_LABEL[e.target.value as RoleId]}`) }}
                    className={`${input} py-1.5 text-[12.5px]`}>
                    {roleOptions.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                  </select>
                  <Button onClick={() => { removeMember(m.id); toast.success(`${m.name} removed`, { description: 'Any clients moved to Unassigned' }) }} className="text-[12px] py-1.5 px-2.5"><Trash2 size={13} /> Remove</Button>
                </>
              )}
            </div>
          ))}
          <div className="flex items-center gap-2 px-4 py-3 flex-wrap">
            <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add() }}
              placeholder="Add a teammate by name" className={`${input} flex-1 min-w-[180px]`} />
            <select value={addRole} onChange={(e) => setAddRole(e.target.value as RoleId)} className={`${input} py-2 text-[12.5px]`}>
              {roleOptions.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </select>
            <Button variant="primary" onClick={add} disabled={!name.trim()}><UserPlus size={15} /> Add</Button>
          </div>
        </Card>
      </section>

      {/* Invitations */}
      <section>
        <SectionTitle>Invitations</SectionTitle>
        <Card className="p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') sendInvite() }}
              placeholder="teammate@email.com" className={`${input} flex-1 min-w-[200px]`} />
            <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as RoleId)} className={`${input} py-2 text-[12.5px]`}>
              {roleOptions.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </select>
            <Button variant="primary" onClick={sendInvite} disabled={!email.trim()}><Mail size={15} /> Invite</Button>
          </div>
          {pending.length > 0 && (
            <div className="flex flex-col divide-y divide-[var(--line)] border-t border-[var(--line)] -mx-4 -mb-4">
              {pending.map((inv) => (
                <div key={inv.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="w-8 h-8 rounded-full grid place-items-center flex-none text-[var(--muted)] bg-[var(--surface-2)]"><Mail size={14} /></span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold truncate">{inv.email}</div>
                    <div className="text-[11.5px] text-[var(--muted)]">Pending · {ROLE_LABEL[inv.role]}</div>
                  </div>
                  <Button onClick={() => copyLink(inv.token)} className="text-[12px] py-1.5 px-2.5">{copied === inv.token ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy link</>}</Button>
                  <button onClick={() => { revokeInvite(inv.id); toast.success('Invitation revoked') }} aria-label="Revoke invitation" className="w-8 h-8 grid place-items-center rounded-[7px] text-[var(--muted)] hover:text-[var(--st-critical)] hover:bg-[var(--surface-2)] transition-colors"><Trash2 size={15} /></button>
                </div>
              ))}
            </div>
          )}
          {pending.length === 0 && <div className="text-[12px] text-[var(--muted)]">No pending invitations. Invite a teammate and share their link.</div>}
        </Card>
      </section>

      {/* Client assignments */}
      <section>
        <SectionTitle>Client assignments <span className="text-[11px] font-medium text-[var(--muted)] ml-1">{clients.length} clients</span></SectionTitle>
        {unassigned.length > 0 && (
          <div className="flex items-center gap-2 text-[12.5px] text-[var(--st-warn)] mb-2.5"><Inbox size={14} /> {unassigned.length} unassigned {unassigned.length === 1 ? 'client needs' : 'clients need'} an owner.</div>
        )}
        <Card className="divide-y divide-[var(--line)]">
          {clients.map((c) => {
            const owner = managerFor(c.id)
            return (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                <span className="w-8 h-8 rounded-[8px] grid place-items-center mono text-[11px] font-bold text-white flex-none" style={{ background: c.color }}>{c.mark}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold">{c.name}</div>
                  <div className="text-[11.5px] text-[var(--muted)]">{c.trade} · {c.location}</div>
                </div>
                {!owner && <span className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--st-warn)] hidden sm:inline">Unassigned</span>}
                <select value={owner?.id ?? ''} onChange={(e) => assignClient(c.id, e.target.value)}
                  className="bg-[var(--surface-2)] border border-[var(--line-2)] rounded-[8px] px-2.5 py-1.5 text-[12.5px] text-[var(--ink)] focus:outline-none focus:border-[var(--accent)]">
                  <option value="">Unassigned</option>
                  {managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
                <Button onClick={() => { archiveClient(c.id); toast.success(`${c.name} archived`) }} className="text-[12px] py-1.5 px-2.5"><Archive size={13} /> Archive</Button>
              </div>
            )
          })}
          {clients.length === 0 && <div className="px-4 py-8 text-center text-[13px] text-[var(--muted)]">No clients imported yet. Add them from Integrations.</div>}
        </Card>
      </section>

      {/* Archived */}
      {archivedClients.length > 0 && (
        <section>
          <SectionTitle>Archived</SectionTitle>
          <Card className="divide-y divide-[var(--line)]">
            {archivedClients.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                <span className="w-8 h-8 rounded-[8px] grid place-items-center mono text-[11px] font-bold text-white flex-none opacity-60" style={{ background: c.color }}>{c.mark}</span>
                <div className="flex-1 min-w-0"><div className="text-[13px] font-semibold text-[var(--ink-2)]">{c.name}</div><div className="text-[11.5px] text-[var(--muted)]">{c.trade} · {c.location}</div></div>
                <Button onClick={() => { restoreClient(c.id); toast.success(`${c.name} restored`, { description: 'Now unassigned' }) }} className="text-[12px] py-1.5 px-2.5"><RotateCcw size={13} /> Restore</Button>
              </div>
            ))}
          </Card>
        </section>
      )}
    </Reveal>
  )
}
