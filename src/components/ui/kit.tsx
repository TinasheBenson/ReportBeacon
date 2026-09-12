/** ReportBeacon UI kit. Flat, high-contrast primitives built on the tokens. */
import type { ReactNode } from 'react'
import { pctAbs } from '@/lib/format'
import type { Health, Severity, SourceStatus } from '@/lib/data'
import { HEALTH_LABEL } from '@/lib/data'

export const SERIES = ['var(--s-blue)', 'var(--s-orange)', 'var(--s-aqua)']

export function Card({ children, className = '', as: As = 'div', ...rest }: { children: ReactNode; className?: string; as?: any; [k: string]: any }) {
  return (
    <As
      className={`bg-[var(--surface)] border border-[var(--line)] rounded-[11px] shadow-[var(--shadow)] ${className}`}
      {...rest}
    >
      {children}
    </As>
  )
}

export function Button({
  children, variant = 'default', className = '', ...rest
}: { children: ReactNode; variant?: 'default' | 'primary' | 'ghost'; className?: string; [k: string]: any }) {
  const base = 'inline-flex items-center gap-2 font-semibold text-[13px] rounded-[8px] px-3.5 py-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
  const styles = {
    default: 'bg-[var(--surface)] text-[var(--ink)] border border-[var(--line-2)] hover:bg-[var(--surface-2)]',
    primary: 'bg-[var(--ink)] text-[var(--surface)] border border-[var(--ink)] hover:opacity-90',
    ghost: 'text-[var(--ink-2)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]',
  }[variant]
  return <button type="button" className={`${base} ${styles} ${className}`} {...rest}>{children}</button>
}

export function IconButton({ children, label, chrome = false, className = '', ...rest }: { children: ReactNode; label: string; chrome?: boolean; className?: string; [k: string]: any }) {
  const tone = chrome
    ? 'border-[var(--chrome-line-2)] bg-[var(--chrome-hover)] text-[var(--chrome-ink-2)] hover:text-[var(--chrome-ink)] hover:bg-[var(--chrome-active-bg)]'
    : 'border-[var(--line-2)] bg-[var(--surface)] text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)]'
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`grid place-items-center w-[34px] h-[34px] rounded-[8px] border transition-colors ${tone} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}

export interface SegOption<T extends string> { value: T; label: ReactNode }

export function Segmented<T extends string>({ options, value, onChange, size = 'md', className = '' }: {
  options: SegOption<T>[]; value: T; onChange: (v: T) => void; size?: 'sm' | 'md'; className?: string
}) {
  const pad = size === 'sm' ? 'px-2.5 py-1 text-[12px]' : 'px-3 py-1.5 text-[12.5px]'
  return (
    <div className={`inline-flex bg-[var(--surface-2)] border border-[var(--line)] rounded-[9px] p-[3px] gap-[2px] ${className}`} role="tablist">
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.value)}
            className={`${pad} font-medium rounded-[6px] leading-tight transition-colors whitespace-nowrap ${
              on ? 'bg-[var(--surface)] text-[var(--ink)] font-semibold shadow-[var(--shadow)]' : 'text-[var(--ink-2)] hover:text-[var(--ink)]'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      className={`relative w-[40px] h-[23px] rounded-full transition-colors flex-none ${on ? 'bg-[var(--accent)]' : 'bg-[var(--line-2)]'}`}>
      <span className={`absolute top-[2px] left-[2px] w-[19px] h-[19px] rounded-full bg-white shadow transition-transform ${on ? 'translate-x-[17px]' : ''}`} />
    </button>
  )
}

export function Delta({ value, lowerIsBetter = false, className = '' }: { value: number; lowerIsBetter?: boolean; className?: string }) {
  const flat = Math.abs(value) < 0.1
  const good = lowerIsBetter ? value < 0 : value > 0
  const color = flat ? 'text-[var(--muted)]' : good ? 'text-[var(--good)]' : 'text-[var(--bad)]'
  const arrow = value > 0.1 ? '▲' : value < -0.1 ? '▼' : '▬'
  return (
    <span className={`mono text-[11.5px] font-semibold inline-flex items-center gap-1 ${color} ${className}`}>
      <span className="text-[8px]">{arrow}</span>{pctAbs(value)}
    </span>
  )
}

const HEALTH_COLOR: Record<Health, string> = { good: 'var(--st-good)', watch: 'var(--st-warn)', risk: 'var(--st-serious)' }
const HEALTH_TEXT: Record<Health, string> = { good: 'var(--good)', watch: 'var(--st-warn)', risk: 'var(--st-serious)' }

export function HealthBadge({ health }: { health: Health }) {
  return (
    <span className="inline-flex items-center gap-2 text-[12px] font-semibold" style={{ color: HEALTH_TEXT[health] }}>
      <span className="w-2 h-2 rounded-full flex-none" style={{ background: HEALTH_COLOR[health] }} />
      {HEALTH_LABEL[health]}
    </span>
  )
}

const SEV_COLOR: Record<Severity, string> = { serious: 'var(--st-serious)', warning: 'var(--st-warn)', info: 'var(--muted)' }

export function SeverityDot({ severity }: { severity: Severity }) {
  return (
    <span className="w-2 h-2 rounded-full flex-none" style={{ background: SEV_COLOR[severity], boxShadow: `0 0 0 3px color-mix(in srgb, ${SEV_COLOR[severity]} 18%, transparent)` }} />
  )
}

export function Chip({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'warn' | 'serious' }) {
  const map = {
    neutral: 'text-[var(--ink-2)] border-[var(--line-2)]',
    warn: 'text-[var(--st-warn)] border-[color-mix(in_srgb,var(--st-warn)_34%,transparent)] bg-[color-mix(in_srgb,var(--st-warn)_10%,transparent)]',
    serious: 'text-[var(--st-serious)] border-[color-mix(in_srgb,var(--st-serious)_34%,transparent)] bg-[color-mix(in_srgb,var(--st-serious)_10%,transparent)]',
  }[tone]
  return <span className={`text-[10.5px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${map}`}>{children}</span>
}

const SRC_COLOR: Record<SourceStatus, string> = { live: 'var(--st-good)', syncing: 'var(--st-warn)', attention: 'var(--st-critical)' }

export function SourceDots({ sources }: { sources: Record<string, SourceStatus> }) {
  return (
    <div className="flex gap-[5px]">
      {Object.entries(sources).map(([k, s]) => (
        <span key={k} className="w-[9px] h-[9px] rounded-full" style={{ background: SRC_COLOR[s] }} title={`${k}: ${s}`} />
      ))}
    </div>
  )
}

/** Compact inline sparkline (SVG). Glanceable, no hover layer by design. */
export function Sparkline({ data, color = 'var(--s-blue)', width = 104, height = 30 }: { data: number[]; color?: string; width?: number; height?: number }) {
  const pad = 3
  const min = Math.min(...data), max = Math.max(...data), rng = max - min || 1
  const step = (width - pad * 2) / (data.length - 1)
  const pts = data.map((v, i) => [pad + i * step, height - pad - ((v - min) / rng) * (height - pad * 2)] as const)
  const line = pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
  const area = `${pad},${height - pad} ${line} ${width - pad},${height - pad}`
  const end = pts[pts.length - 1]
  const gid = 'sp' + Math.abs(data[0] * 97 + data.length).toFixed(0)
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" className="block">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity={0.22} />
          <stop offset="1" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${gid})`} />
      <polyline points={line} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={end[0].toFixed(1)} cy={end[1].toFixed(1)} r={2.6} fill={color} />
    </svg>
  )
}

export function PacingBar({ pct, spendLabel }: { pct: number; spendLabel: string }) {
  const color = pct > 110 ? 'var(--st-serious)' : pct > 100 ? 'var(--st-warn)' : 'var(--s-blue)'
  return (
    <div className="w-[120px]">
      <div className="h-[7px] rounded-full bg-[var(--line)] overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: color }} />
      </div>
      <div className="mono text-[11px] text-[var(--ink-2)] mt-1 flex justify-between">
        <span>{spendLabel}</span><span>{pct}%</span>
      </div>
    </div>
  )
}

export function Stat({ label, value, delta, lowerIsBetter, note, children }: {
  label: string; value: ReactNode; delta?: number; lowerIsBetter?: boolean; note?: ReactNode; children?: ReactNode
}) {
  return (
    <Card className="p-4 flex flex-col gap-1.5">
      <span className="eyebrow">{label}</span>
      <span className="mono text-[26px] font-semibold leading-none tracking-[-0.02em] text-[var(--ink)]">{value}</span>
      {(delta !== undefined || note) && (
        <div className="flex items-center gap-2">
          {delta !== undefined && <Delta value={delta} lowerIsBetter={lowerIsBetter} />}
          {note && <span className="text-[11.5px] text-[var(--muted)]">{note}</span>}
        </div>
      )}
      {children}
    </Card>
  )
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <h2 className="text-[14.5px] font-bold tracking-[-0.01em]">{children}</h2>
      {right && <div className="ml-auto flex items-center gap-2">{right}</div>}
    </div>
  )
}

export function Skeleton({ className = '', h = 16, w }: { className?: string; h?: number; w?: number | string }) {
  return <div className={`skeleton ${className}`} style={{ height: h, width: w }} />
}

export function KpiSkeleton() {
  return (
    <Card className="p-4 flex flex-col gap-3">
      <Skeleton h={10} w="55%" />
      <Skeleton h={24} w="45%" />
      <Skeleton h={10} w="70%" />
    </Card>
  )
}

export function TableSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <Card className="p-4 flex flex-col gap-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton h={32} w={32} className="rounded-[8px]" />
          <Skeleton h={14} w="26%" />
          <div className="flex-1" />
          <Skeleton h={14} w={60} />
          <Skeleton h={14} w={60} />
          <Skeleton h={14} w={80} />
        </div>
      ))}
    </Card>
  )
}

const PRIORITY_COLOR: Record<string, string> = { high: 'var(--st-serious)', medium: 'var(--st-warn)', low: 'var(--muted)' }
export function PriorityDot({ priority }: { priority: 'high' | 'medium' | 'low' }) {
  return <span className="w-2 h-2 rounded-full flex-none" style={{ background: PRIORITY_COLOR[priority] }} />
}
