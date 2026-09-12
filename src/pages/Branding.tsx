/** Branding (admin): white-label the console and reports. Beyond a single
 *  accent, each face (Performance / Social) has its own palette — a dashboard
 *  ground colour and a highlight colour — so the two can look and feel
 *  distinct. Changes apply live across the app. */
import { useState } from 'react'
import { toast } from 'sonner'
import { Upload, Trash2, Check, Ban } from 'lucide-react'
import { useApp, type Face } from '@/context/app'
import { useWorkspace, type WorkspaceMode, type Palette } from '@/context/workspace'
import { Card, Button, SectionTitle, Segmented } from '@/components/ui/kit'
import { Reveal } from '@/components/ui/disclosure'

const MODE_HINT: Record<WorkspaceMode, string> = {
  performance: 'Ads, SEO and lead-gen reporting only.',
  social: 'Social media reporting only.',
  both: 'Both, with a Performance / Social switch in the top bar.',
}
// Ground tints ("dashboard colour"). Neutral (null) keeps the default look.
const BASES: { value: string | null; label: string }[] = [
  { value: null, label: 'Neutral' },
  { value: '#12b886', label: 'Emerald' }, { value: '#0ca678', label: 'Teal' },
  { value: '#7c3aed', label: 'Violet' }, { value: '#e64980', label: 'Rose' },
  { value: '#4f46e5', label: 'Indigo' }, { value: '#0ea5e9', label: 'Sky' },
  { value: '#f59f00', label: 'Amber' }, { value: '#475569', label: 'Slate' },
]
const ACCENTS = ['#4a3aa7', '#fd7e14', '#2563eb', '#0d9488', '#16a34a', '#dc2626', '#db2777', '#7c3aed', '#f59f00', '#0ea5e9']

function previewVars(pal: Palette, light: boolean): React.CSSProperties {
  const g = light
    ? { plane: '#f7f8fa', surface: '#ffffff', surface2: '#fbfbfd', line: '#e7e9ee', ink: '#101828', ink2: '#5a6472', muted: '#98a2b3' }
    : { plane: '#0c0d10', surface: '#16181d', surface2: '#1b1e24', line: '#262a31', ink: '#f2f4f7', ink2: '#a4abb8', muted: '#737a88' }
  const t = light ? { plane: 11, surface: 7, surface2: 13, line: 24 } : { plane: 16, surface: 15, surface2: 20, line: 28 }
  const mix = (pct: number, anchor: string) => (pal.base ? `color-mix(in srgb, ${pal.base} ${pct}%, ${anchor})` : anchor)
  return {
    '--accent': pal.accent,
    '--accent-weak': `color-mix(in srgb, ${pal.accent} ${light ? 12 : 24}%, transparent)`,
    '--plane': mix(t.plane, g.plane), '--surface': mix(t.surface, g.surface), '--surface-2': mix(t.surface2, g.surface2),
    '--line': mix(t.line, g.line), '--ink': g.ink, '--ink-2': g.ink2, '--muted': g.muted,
  } as React.CSSProperties
}

export default function Branding() {
  const { theme } = useApp()
  const { isAdmin, brand, brandMonogram, setBrand, setPalette, mode, setMode } = useWorkspace()
  const [editFace, setEditFace] = useState<Face>('performance')

  if (!isAdmin) {
    return <Card className="p-10 text-center text-[13px] text-[var(--muted)] max-w-[520px]">Branding is managed by the agency owner.</Card>
  }

  function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 400_000) { toast.error('Logo is too large', { description: 'Use an image under 400 KB' }); return }
    const reader = new FileReader()
    reader.onload = () => { setBrand({ logo: String(reader.result) }); toast.success('Logo applied') }
    reader.readAsDataURL(file)
  }

  const pal = editFace === 'social' ? brand.social : brand.performance
  const isBase = (v: string | null) => (pal.base?.toLowerCase() ?? null) === (v?.toLowerCase() ?? null)

  return (
    <Reveal className="grid lg:grid-cols-[1fr_360px] gap-6 max-w-[980px]">
      {/* Controls */}
      <div className="flex flex-col gap-4">
        <Card className="p-5">
          <SectionTitle>Reporting focus</SectionTitle>
          <Segmented value={mode} onChange={(m) => { setMode(m); toast.success(`Focus set to ${m === 'both' ? 'both' : m}`) }} className="w-full"
            options={[{ value: 'performance', label: 'Performance' }, { value: 'social', label: 'Social' }, { value: 'both', label: 'Both' }]} />
          <div className="text-[11.5px] text-[var(--muted)] mt-2.5">{MODE_HINT[mode]}</div>
        </Card>

        <Card className="p-5">
          <SectionTitle>Agency</SectionTitle>
          <label className="eyebrow">Agency name</label>
          <input value={brand.agencyName} onChange={(e) => setBrand({ agencyName: e.target.value })}
            className="w-full mt-2 mb-5 bg-[var(--surface-2)] border border-[var(--line-2)] rounded-[8px] px-3 py-2 text-[13px] text-[var(--ink)] focus:outline-none focus:border-[var(--accent)]" />
          <label className="eyebrow">Logo</label>
          <div className="flex items-center gap-3 mt-2.5">
            {brand.logo
              ? <img src={brand.logo} alt="" className="w-12 h-12 rounded-[10px] object-cover border border-[var(--line)]" />
              : <span className="w-12 h-12 rounded-[10px] grid place-items-center text-[15px] font-bold text-white" style={{ background: 'var(--accent)' }}>{brandMonogram}</span>}
            <label className="inline-flex">
              <span className="inline-flex items-center gap-2 text-[13px] font-semibold px-3.5 py-2 rounded-[8px] border border-[var(--line-2)] bg-[var(--surface)] hover:bg-[var(--surface-2)] cursor-pointer transition-colors"><Upload size={15} /> Upload logo</span>
              <input type="file" accept="image/*" onChange={onLogo} className="hidden" />
            </label>
            {brand.logo && <Button onClick={() => setBrand({ logo: null })}><Trash2 size={15} /> Remove</Button>}
          </div>
          <div className="text-[11.5px] text-[var(--muted)] mt-2">PNG or SVG, under 400 KB. Shared across both faces.</div>
        </Card>

        <Card className="p-5">
          <SectionTitle>Palette</SectionTitle>
          <Segmented value={editFace} onChange={setEditFace} className="w-full mb-4"
            options={[{ value: 'performance', label: 'Performance' }, { value: 'social', label: 'Social' }]} />

          <label className="eyebrow">Dashboard colour</label>
          <div className="text-[11px] text-[var(--muted)] mb-2.5">Tints the whole {editFace} console — backgrounds, cards and borders.</div>
          <div className="flex flex-wrap items-center gap-2 mb-5">
            {BASES.map((b) => (
              <button key={b.label} onClick={() => setPalette(editFace, { base: b.value })} title={b.label} aria-label={b.label}
                className="w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 grid place-items-center"
                style={{ background: b.value ?? 'var(--surface)', borderColor: isBase(b.value) ? 'var(--ink)' : 'var(--line-2)' }}>
                {b.value === null && <Ban size={14} className="text-[var(--muted)]" />}
                {b.value !== null && isBase(b.value) && <Check size={15} className="text-white" />}
              </button>
            ))}
            <label className="w-8 h-8 rounded-full border border-dashed border-[var(--line-2)] grid place-items-center cursor-pointer relative overflow-hidden" title="Custom dashboard colour">
              <span className="text-[11px] text-[var(--muted)]">+</span>
              <input type="color" value={pal.base ?? '#12b886'} onChange={(e) => setPalette(editFace, { base: e.target.value })} className="absolute inset-0 opacity-0 cursor-pointer" />
            </label>
          </div>

          <label className="eyebrow">Highlight colour</label>
          <div className="text-[11px] text-[var(--muted)] mb-2.5">Buttons, active items, links and emphasis.</div>
          <div className="flex flex-wrap items-center gap-2">
            {ACCENTS.map((c) => (
              <button key={c} onClick={() => setPalette(editFace, { accent: c })} aria-label={c}
                className="w-8 h-8 rounded-full border-2 transition-transform hover:scale-110"
                style={{ background: c, borderColor: pal.accent.toLowerCase() === c ? 'var(--ink)' : 'transparent' }}>
                {pal.accent.toLowerCase() === c && <Check size={15} className="text-white mx-auto" />}
              </button>
            ))}
            <label className="w-8 h-8 rounded-full border border-dashed border-[var(--line-2)] grid place-items-center cursor-pointer relative overflow-hidden" title="Custom highlight">
              <span className="text-[11px] text-[var(--muted)]">+</span>
              <input type="color" value={pal.accent} onChange={(e) => setPalette(editFace, { accent: e.target.value })} className="absolute inset-0 opacity-0 cursor-pointer" />
            </label>
          </div>
        </Card>
      </div>

      {/* Live preview */}
      <div className="flex flex-col gap-3">
        <div className="eyebrow">Live preview · {editFace}</div>
        <div className="rounded-[14px] border border-[var(--line)] overflow-hidden shadow-[var(--shadow)]" style={previewVars(pal, theme === 'light')}>
          <div style={{ background: 'var(--plane)' }} className="p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2.5 rounded-[10px] bg-[var(--surface)] border border-[var(--line)] px-3 py-2.5">
              {brand.logo ? <img src={brand.logo} alt="" className="w-[28px] h-[28px] rounded-[7px] object-cover" /> : <span className="w-[28px] h-[28px] rounded-[7px] grid place-items-center text-[11px] font-bold text-white" style={{ background: 'var(--accent)' }}>{brandMonogram}</span>}
              <div><div className="font-bold text-[13px] leading-none" style={{ color: 'var(--ink)' }}>{brand.agencyName}</div><div className="text-[10.5px] mt-0.5" style={{ color: 'var(--muted)' }}>{editFace === 'social' ? 'Social · ReportBeacon' : 'Powered by ReportBeacon'}</div></div>
            </div>
            <div className="flex items-center gap-2 rounded-[8px] px-2.5 py-2 text-[13px] font-semibold" style={{ background: 'var(--accent-weak)', color: 'var(--accent)' }}>
              <span className="w-4 h-4 rounded-[4px]" style={{ background: 'var(--accent)' }} /> Active nav item
            </div>
            <div className="grid grid-cols-2 gap-2">
              {['Reach', 'Engagement'].map((k) => (
                <div key={k} className="rounded-[9px] bg-[var(--surface)] border border-[var(--line)] p-2.5">
                  <div className="text-[9px] uppercase tracking-wide" style={{ color: 'var(--muted)' }}>{k}</div>
                  <div className="text-[15px] font-bold mono" style={{ color: 'var(--ink)' }}>{k === 'Reach' ? '164.9K' : '5.2%'}</div>
                </div>
              ))}
            </div>
            <button className="inline-flex items-center justify-center gap-2 text-[13px] font-semibold px-3.5 py-2 rounded-[8px] text-white w-fit" style={{ background: 'var(--accent)' }}>Primary action</button>
          </div>
        </div>
        <div className="text-[11.5px] text-[var(--muted)]">Switching between Performance and Social morphs the whole console to that face's palette.</div>
      </div>
    </Reveal>
  )
}
