/** Branding (admin): white-label the console and reports. Each face
 *  (Performance / Social) gets its own identity — a navigation colour that
 *  paints the sidebar and chrome, and a highlight colour for buttons, active
 *  items and charts. The dashboard content stays clean white either way, so
 *  the two faces read apart at a glance. Changes apply live across the app. */
import { useState } from 'react'
import { toast } from 'sonner'
import { Upload, Trash2, Check, Ban } from 'lucide-react'
import { useApp, type Face } from '@/context/app'
import { useWorkspace, type WorkspaceMode } from '@/context/workspace'
import { Card, Button, SectionTitle, Segmented } from '@/components/ui/kit'
import { Reveal } from '@/components/ui/disclosure'
import { useLogoTone, logoPlate } from '@/lib/useLogoTone'
import { useTrimmedLogo } from '@/lib/logo'

const MODE_HINT: Record<WorkspaceMode, string> = {
  performance: 'Ads, SEO and lead-gen reporting only.',
  social: 'Social media reporting only.',
  both: 'Both, with a Performance / Social switch in the top bar.',
}
// Navigation colours. Neutral (null) keeps the clean default rail.
const BASES: { value: string | null; label: string }[] = [
  { value: null, label: 'Neutral' },
  { value: '#1d4ed8', label: 'Blue' }, { value: '#7c3aed', label: 'Violet' },
  { value: '#0ca678', label: 'Teal' }, { value: '#e64980', label: 'Rose' },
  { value: '#0f172a', label: 'Ink' }, { value: '#0891b2', label: 'Cyan' },
  { value: '#ea580c', label: 'Orange' }, { value: '#475569', label: 'Slate' },
]
const ACCENTS = ['#4a3aa7', '#3b82f6', '#2563eb', '#0d9488', '#16a34a', '#dc2626', '#db2777', '#7c3aed', '#f59f00', '#0ea5e9']

// Theme anchors for the live preview.
function anchors(light: boolean) {
  return light
    ? { surface: '#ffffff', plane: '#f7f8fa', ink: '#101828', muted: '#98a2b3', line: '#e7e9ee' }
    : { surface: '#16181d', plane: '#0c0d10', ink: '#f2f4f7', muted: '#737a88', line: '#262a31' }
}
// The nav strip: a brand base gives a deep, brand-tinted rail (off-white text);
// null keeps it neutral. Mirrors applyFace in the Shell.
function navStyle(base: string | null, light: boolean): React.CSSProperties {
  const a = anchors(light)
  if (!base) return { background: a.surface, color: a.ink, borderColor: a.line }
  const top = light ? `color-mix(in srgb, ${base} 40%, #0a1020)` : `color-mix(in srgb, ${base} 52%, #0b1226)`
  const bottom = light ? `color-mix(in srgb, ${base} 30%, #0a1020)` : `color-mix(in srgb, ${base} 42%, #0b1226)`
  return { backgroundImage: `linear-gradient(180deg, ${top}, ${bottom})`, color: 'rgba(255,255,255,0.94)', borderColor: 'rgba(255,255,255,0.09)' }
}

export default function Branding() {
  const { theme } = useApp()
  const { isAdmin, brand, brandMonogram, setBrand, setPalette, mode, setMode } = useWorkspace()
  const [editFace, setEditFace] = useState<Face>('social')
  const light = theme === 'light'
  const logoTone = useLogoTone(brand.logo)
  const logoSrc = useTrimmedLogo(brand.logo) ?? brand.logo ?? undefined

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
  const a = anchors(light)
  const nav = navStyle(pal.base, light)
  const onBrand = !!pal.base
  // The active item is the one saturated element: a bright brand pill.
  const activeItem: React.CSSProperties = onBrand
    ? { background: pal.base!, color: '#fff', boxShadow: '0 2px 10px rgba(0,0,0,0.18)' }
    : { background: `color-mix(in srgb, ${pal.accent} 14%, transparent)`, color: pal.accent }
  const mutedOnNav = onBrand ? 'rgba(255,255,255,0.54)' : a.muted
  const badge: React.CSSProperties = brand.logo
    ? { background: '#fff' }
    : onBrand ? { background: pal.base!, color: '#fff' } : { background: pal.accent, color: '#fff' }

  return (
    <Reveal className="grid lg:grid-cols-[1fr_380px] gap-6 max-w-[1000px]">
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
            <span className="w-16 h-16 rounded-[10px] grid place-items-center border border-[var(--line)] overflow-hidden flex-none" style={{ background: brand.logo ? logoPlate(logoTone) : 'var(--surface-2)' }}>
              {brand.logo
                ? <img src={logoSrc} alt="" className="max-w-[54px] max-h-[54px] object-contain" />
                : <span className="text-[15px] font-bold text-white w-10 h-10 rounded-[8px] grid place-items-center" style={{ background: 'var(--accent)' }}>{brandMonogram}</span>}
            </span>
            <div className="flex flex-col gap-2">
              <label className="inline-flex">
                <span className="inline-flex items-center gap-2 text-[13px] font-semibold px-3.5 py-2 rounded-[8px] border border-[var(--line-2)] bg-[var(--surface)] hover:bg-[var(--surface-2)] cursor-pointer transition-colors"><Upload size={15} /> Upload logo</span>
                <input type="file" accept="image/*" onChange={onLogo} className="hidden" />
              </label>
              {brand.logo && <Button onClick={() => setBrand({ logo: null })}><Trash2 size={15} /> Remove</Button>}
            </div>
          </div>
          <div className="text-[11.5px] text-[var(--muted)] mt-2.5">PNG or SVG under 400 KB. Shown at its natural proportions, so wide wordmarks and square icons both sit right. Shared across both faces.</div>
        </Card>

        <Card className="p-5">
          <SectionTitle>Palette</SectionTitle>
          <Segmented value={editFace} onChange={setEditFace} className="w-full mb-4"
            options={[{ value: 'performance', label: 'Performance' }, { value: 'social', label: 'Social' }]} />

          <label className="eyebrow">Navigation colour</label>
          <div className="text-[11px] text-[var(--muted)] mb-2.5">Paints the {editFace} sidebar and nav. The dashboard itself stays white.</div>
          <div className="flex flex-wrap items-center gap-2 mb-5">
            {BASES.map((b) => (
              <button key={b.label} onClick={() => setPalette(editFace, { base: b.value })} title={b.label} aria-label={b.label}
                className="w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 grid place-items-center"
                style={{ background: b.value ?? 'var(--surface)', borderColor: isBase(b.value) ? 'var(--ink)' : 'var(--line-2)' }}>
                {b.value === null && <Ban size={14} className="text-[var(--muted)]" />}
                {b.value !== null && isBase(b.value) && <Check size={15} className="text-white" />}
              </button>
            ))}
            <label className="w-8 h-8 rounded-full border border-dashed border-[var(--line-2)] grid place-items-center cursor-pointer relative overflow-hidden" title="Custom navigation colour">
              <span className="text-[11px] text-[var(--muted)]">+</span>
              <input type="color" value={pal.base ?? '#1d4ed8'} onChange={(e) => setPalette(editFace, { base: e.target.value })} className="absolute inset-0 opacity-0 cursor-pointer" />
            </label>
          </div>

          <label className="eyebrow">Highlight colour</label>
          <div className="text-[11px] text-[var(--muted)] mb-2.5">Buttons, active items, links, and the chart lines.</div>
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

      {/* Live preview: a mini console — branded nav, white content. */}
      <div className="flex flex-col gap-3">
        <div className="eyebrow">Live preview · {editFace}</div>
        <div className="rounded-[14px] border overflow-hidden shadow-[var(--shadow-pop)]" style={{ borderColor: a.line }}>
          <div className="flex" style={{ background: a.plane, height: 248 }}>
            {/* Nav rail */}
            <div className="w-[104px] p-2.5 flex flex-col gap-1.5 border-r" style={nav}>
              <div className="flex items-center gap-1.5 mb-1">
                {brand.logo ? (
                  <img src={logoSrc} alt={brand.agencyName} className="h-[30px] w-auto max-w-[96px] object-contain mx-auto" />
                ) : (
                  <>
                    <span className="w-[22px] h-[22px] rounded-[6px] grid place-items-center text-[10px] font-bold flex-none" style={badge}>{brandMonogram}</span>
                    <span className="text-[10px] font-bold truncate">{brand.agencyName}</span>
                  </>
                )}
              </div>
              <div className="rounded-[6px] px-2 py-1.5 text-[10.5px] font-semibold" style={activeItem}>Overview</div>
              {['Reports', 'Insights'].map((t) => <div key={t} className="rounded-[6px] px-2 py-1.5 text-[10.5px]" style={{ color: mutedOnNav }}>{t}</div>)}
            </div>
            {/* Content */}
            <div className="flex-1 p-3 flex flex-col gap-2.5 min-w-0">
              <div className="text-[12px] font-bold" style={{ color: a.ink }}>Overview</div>
              <div className="grid grid-cols-2 gap-2">
                {[['Reach', '164.9K'], ['Engagement', '5.2%']].map(([k, v]) => (
                  <div key={k} className="rounded-[8px] border p-2" style={{ background: a.surface, borderColor: a.line }}>
                    <div className="text-[8.5px] uppercase tracking-wide" style={{ color: a.muted }}>{k}</div>
                    <div className="text-[14px] font-bold mono" style={{ color: a.ink }}>{v}</div>
                  </div>
                ))}
              </div>
              <div className="rounded-[8px] border p-2 flex-1 flex flex-col" style={{ background: a.surface, borderColor: a.line }}>
                <div className="text-[8.5px] uppercase tracking-wide mb-1" style={{ color: a.muted }}>Trend</div>
                <svg viewBox="0 0 120 40" preserveAspectRatio="none" className="w-full flex-1">
                  <defs><linearGradient id="pvg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={pal.accent} stopOpacity={0.28} /><stop offset="1" stopColor={pal.accent} stopOpacity={0} /></linearGradient></defs>
                  <path d="M0 32 L20 26 L40 28 L60 16 L80 20 L100 9 L120 12 L120 40 L0 40 Z" fill="url(#pvg)" />
                  <path d="M0 32 L20 26 L40 28 L60 16 L80 20 L100 9 L120 12" fill="none" stroke={pal.accent} strokeWidth={2} />
                </svg>
              </div>
              <button className="inline-flex items-center justify-center text-[11px] font-semibold px-3 py-1.5 rounded-[7px] text-white w-fit" style={{ background: pal.accent }}>Export report</button>
            </div>
          </div>
        </div>
        <div className="text-[11.5px] text-[var(--muted)]">Switching between Performance and Social morphs the nav and highlights to that face. The content area stays white.</div>
      </div>
    </Reveal>
  )
}
