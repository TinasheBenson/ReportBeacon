/** Branding (admin): white-label the console and reports with the agency's
 *  name, colour and logo. Changes apply live across the app. */
import { toast } from 'sonner'
import { Upload, Trash2, Check } from 'lucide-react'
import { useWorkspace, type WorkspaceMode } from '@/context/workspace'
import { Card, Button, SectionTitle, Segmented } from '@/components/ui/kit'
import { Reveal } from '@/components/ui/disclosure'

const PRESETS = ['#4a3aa7', '#2563eb', '#0d9488', '#16a34a', '#d97706', '#dc2626', '#db2777', '#7c3aed', '#334155', '#101828']
const MODE_HINT: Record<WorkspaceMode, string> = {
  performance: 'Ads, SEO and lead-gen reporting only.',
  social: 'Social media reporting only.',
  both: 'Both, with a Performance / Social switch in the top bar.',
}

export default function Branding() {
  const { isAdmin, brand, brandMonogram, setBrand, mode, setMode } = useWorkspace()

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
          <SectionTitle>Agency brand</SectionTitle>
          <label className="eyebrow">Agency name</label>
          <input
            value={brand.agencyName}
            onChange={(e) => setBrand({ agencyName: e.target.value })}
            className="w-full mt-2 mb-5 bg-[var(--surface-2)] border border-[var(--line-2)] rounded-[8px] px-3 py-2 text-[13px] text-[var(--ink)] focus:outline-none focus:border-[var(--accent)]"
          />

          <label className="eyebrow">Brand colour</label>
          <div className="flex flex-wrap items-center gap-2 mt-2.5 mb-2">
            {PRESETS.map((c) => (
              <button key={c} onClick={() => setBrand({ accent: c })} aria-label={c}
                className="w-8 h-8 rounded-full border-2 transition-transform hover:scale-110"
                style={{ background: c, borderColor: brand.accent.toLowerCase() === c ? 'var(--ink)' : 'transparent' }}>
                {brand.accent.toLowerCase() === c && <Check size={15} className="text-white mx-auto" />}
              </button>
            ))}
            <label className="w-8 h-8 rounded-full border border-dashed border-[var(--line-2)] grid place-items-center cursor-pointer relative overflow-hidden" title="Custom colour">
              <span className="text-[11px] text-[var(--muted)]">+</span>
              <input type="color" value={brand.accent} onChange={(e) => setBrand({ accent: e.target.value })} className="absolute inset-0 opacity-0 cursor-pointer" />
            </label>
          </div>
          <div className="text-[11.5px] text-[var(--muted)] mb-5">Recolours the console and the reports. Pick a colour with enough contrast on white.</div>

          <label className="eyebrow">Logo</label>
          <div className="flex items-center gap-3 mt-2.5">
            {brand.logo
              ? <img src={brand.logo} alt="" className="w-12 h-12 rounded-[10px] object-cover border border-[var(--line)]" />
              : <span className="w-12 h-12 rounded-[10px] grid place-items-center text-[15px] font-bold text-white" style={{ background: brand.accent }}>{brandMonogram}</span>}
            <label className="inline-flex">
              <span className="inline-flex items-center gap-2 text-[13px] font-semibold px-3.5 py-2 rounded-[8px] border border-[var(--line-2)] bg-[var(--surface)] hover:bg-[var(--surface-2)] cursor-pointer transition-colors"><Upload size={15} /> Upload logo</span>
              <input type="file" accept="image/*" onChange={onLogo} className="hidden" />
            </label>
            {brand.logo && <Button onClick={() => setBrand({ logo: null })}><Trash2 size={15} /> Remove</Button>}
          </div>
          <div className="text-[11.5px] text-[var(--muted)] mt-2">PNG or SVG, under 400 KB. Falls back to a monogram from the agency name.</div>
        </Card>
      </div>

      {/* Live preview */}
      <div className="flex flex-col gap-3">
        <div className="eyebrow">Live preview</div>
        <Card className="p-0 overflow-hidden">
          {/* rail lockup */}
          <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-[var(--line)]">
            {brand.logo
              ? <img src={brand.logo} alt="" className="w-[30px] h-[30px] rounded-[8px] object-cover" />
              : <span className="w-[30px] h-[30px] rounded-[8px] grid place-items-center text-[12px] font-bold text-white" style={{ background: brand.accent }}>{brandMonogram}</span>}
            <div>
              <div className="font-bold text-[13.5px] leading-none">{brand.agencyName}</div>
              <div className="text-[11px] text-[var(--muted)] mt-0.5">Powered by ReportBeacon</div>
            </div>
          </div>
          {/* nav + button */}
          <div className="p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2 rounded-[8px] px-2.5 py-2 text-[13px] font-semibold" style={{ background: 'var(--accent-weak)', color: brand.accent }}>
              <span className="w-4 h-4 rounded-[4px]" style={{ background: brand.accent }} /> Active nav item
            </div>
            <button className="inline-flex items-center justify-center gap-2 text-[13px] font-semibold px-3.5 py-2 rounded-[8px] text-white w-fit" style={{ background: brand.accent }}>Primary action</button>
          </div>
          {/* report header */}
          <div className="border-t border-[var(--line)]">
            <div className="h-1.5" style={{ background: brand.accent }} />
            <div className="p-4">
              <div className="flex items-center gap-2 text-[11px] font-semibold text-[var(--ink-2)] mb-2">
                {brand.logo
                  ? <img src={brand.logo} alt="" className="w-5 h-5 rounded-[5px] object-cover" />
                  : <span className="w-5 h-5 rounded-[5px] grid place-items-center text-[9px] font-bold text-white" style={{ background: brand.accent }}>{brandMonogram}</span>}
                {brand.agencyName}
              </div>
              <div className="text-[16px] font-bold">Performance report</div>
              <div className="text-[11.5px] text-[var(--muted)]">Prepared for a client · Aug 2026</div>
            </div>
          </div>
        </Card>
        <div className="text-[11.5px] text-[var(--muted)]">This is what your team and your clients' reports will carry.</div>
      </div>
    </Reveal>
  )
}
