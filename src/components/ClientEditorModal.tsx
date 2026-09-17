/** Owner-only client editor. Builds a full Account from a few fields via
 *  makeAccount(), so a new/edited client gets a believable history + charts. */
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Check, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { metricsFor, makeAccount, TRADES, type Account } from '@/lib/data'
import { useWorkspace } from '@/context/workspace'
import { Button } from '@/components/ui/kit'
import { ClientMark } from '@/components/ClientMark'

const COLORS = ['#0c7a63', '#2a78d6', '#eb6834', '#7a5af0', '#c2410c', '#1baf7a', '#d03b3b', '#0e7490']

export default function ClientEditorModal({ open, initial, onClose }: { open: boolean; initial: Account | null; onClose: () => void }) {
  const { upsertClient } = useWorkspace()
  const editing = !!initial
  const [name, setName] = useState(initial?.name ?? '')
  const [trade, setTrade] = useState<Account['trade']>(initial?.trade ?? 'Dental')
  const [location, setLocation] = useState(initial?.location ?? '')
  const [budget, setBudget] = useState(String(initial?.budget ?? 8000))
  const [retainer, setRetainer] = useState(String(initial?.retainer ?? 2000))
  const [leads, setLeads] = useState(String(initial ? metricsFor(initial, '30d').leads : 180))
  const [rating, setRating] = useState(String(initial?.gbp.rating ?? 4.7))
  const [color, setColor] = useState(initial?.color ?? COLORS[0])
  const [logo, setLogo] = useState<string | null>(initial?.logo ?? null)

  async function pickLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const raw = await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(file) })
    const img = new Image()
    img.onload = () => {
      const max = 256, scale = Math.min(1, max / Math.max(img.width, img.height))
      const w = Math.max(1, Math.round(img.width * scale)), h = Math.max(1, Math.round(img.height * scale))
      const c = document.createElement('canvas'); c.width = w; c.height = h
      c.getContext('2d')!.drawImage(img, 0, 0, w, h)
      setLogo(c.toDataURL('image/png'))
    }
    img.onerror = () => setLogo(raw)
    img.src = raw
  }

  function save() {
    if (!name.trim() || !location.trim()) { toast.error('Name and location are required'); return }
    const account = makeAccount({
      id: initial?.id, name: name.trim(), trade, location: location.trim(), color,
      mark: name.trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2),
      budget: Number(budget) || 0, retainer: Number(retainer) || 0,
      monthlyLeads: Number(leads) || 1, rating: Number(rating) || 4.5, logo,
    })
    upsertClient(account)
    toast.success(editing ? 'Client updated' : 'Client added', { description: `${account.name} · saved to your roster` })
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[60] grid place-items-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            data-testid="client-editor-modal"
            className="relative w-full max-w-[520px] bg-[var(--surface)] border border-[var(--line)] rounded-[16px] shadow-[var(--shadow-pop)] overflow-hidden"
          >
            <div className="h-1.5" style={{ background: color }} />
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[var(--line)]">
              <h2 className="text-[17px] font-bold">{editing ? 'Edit client' : 'Add a client'}</h2>
              <button onClick={onClose} aria-label="Close" data-testid="client-editor-cancel" className="text-[var(--muted)] hover:text-[var(--ink)]"><X size={18} /></button>
            </div>

            <div className="p-5 grid grid-cols-2 gap-3.5 max-h-[70vh] overflow-y-auto clip-scroll">
              <Field label="Client name" full>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Brightside Dental" data-testid="client-editor-name" className={inp} />
              </Field>
              <Field label="Trade">
                <select value={trade} onChange={(e) => setTrade(e.target.value as Account['trade'])} data-testid="client-editor-trade" className={inp}>
                  {TRADES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Location">
                <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Phoenix, AZ" data-testid="client-editor-location" className={inp} />
              </Field>
              <Field label="Monthly budget ($)">
                <input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} data-testid="client-editor-budget" className={inp} />
              </Field>
              <Field label="Monthly retainer ($)">
                <input type="number" value={retainer} onChange={(e) => setRetainer(e.target.value)} data-testid="client-editor-retainer" className={inp} />
              </Field>
              <Field label="Leads / month">
                <input type="number" value={leads} onChange={(e) => setLeads(e.target.value)} data-testid="client-editor-leads" className={inp} />
              </Field>
              <Field label="Google rating">
                <input type="number" step="0.1" min="0" max="5" value={rating} onChange={(e) => setRating(e.target.value)} data-testid="client-editor-rating" className={inp} />
              </Field>
              <Field label="Brand colour" full>
                <div className="flex flex-wrap gap-2 mt-1">
                  {COLORS.map((c) => (
                    <button key={c} onClick={() => setColor(c)} aria-label={`Colour ${c}`} data-testid={`client-editor-color-${c}`}
                      className={`w-7 h-7 rounded-full transition-transform ${color === c ? 'ring-2 ring-offset-2 ring-offset-[var(--surface)] scale-110' : 'hover:scale-105'}`}
                      style={{ background: c, boxShadow: color === c ? `0 0 0 2px ${c}` : undefined }} />
                  ))}
                </div>
              </Field>

              <Field label="Brand logo (optional)" full>
                <div className="flex items-center gap-3 mt-1">
                  <ClientMark account={{ logo, color, mark: name.trim().slice(0, 2).toUpperCase() || 'CL', name }} className="w-11 h-11 rounded-[10px] text-[14px]" />
                  <label data-testid="client-editor-logo-label" className="cursor-pointer inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--accent)] bg-[var(--accent-weak)] rounded-[8px] px-3 py-2 hover:brightness-105 transition-all">
                    <Upload size={14} /> Upload
                    <input type="file" accept="image/*" className="hidden" onChange={pickLogo} data-testid="client-editor-logo-input" />
                  </label>
                  {logo && <button onClick={() => setLogo(null)} data-testid="client-editor-logo-remove" className="text-[12px] text-[var(--muted)] hover:text-[var(--st-critical)] transition-colors">Remove</button>}
                </div>
                <p className="text-[11px] text-[var(--muted)] mt-1.5">Shown on the roster and in reports. Falls back to the colour badge.</p>
              </Field>
            </div>

            <div className="flex items-center justify-end gap-2.5 px-5 py-4 border-t border-[var(--line)]">
              <Button onClick={onClose}>Cancel</Button>
              <Button variant="primary" onClick={save} data-testid="client-editor-save"><Check size={15} /> {editing ? 'Save changes' : 'Add client'}</Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

const inp = 'w-full bg-[var(--surface-2)] border border-[var(--line-2)] rounded-[9px] px-3 h-10 text-[13.5px] text-[var(--ink)] focus:outline-none focus:border-[var(--accent)]'

function Field({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <label className={`block ${full ? 'col-span-2' : ''}`}>
      <span className="block text-[11.5px] font-semibold text-[var(--ink-2)] mb-1">{label}</span>
      {children}
    </label>
  )
}
