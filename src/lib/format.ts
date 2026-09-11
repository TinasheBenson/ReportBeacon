/** Number formatting for the console. Compact and tabular-friendly. */

// A NaN or Infinity from an upstream divide-by-zero should read as "no value",
// never "$NaN" or "Infinity%" in a client-facing report. Coerce to 0 so the
// formatters always emit a real number.
function finite(n: number): number {
  return Number.isFinite(n) ? n : 0
}

export function money(n: number, dp = 0): string {
  return '$' + finite(n).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp })
}

export function money2(n: number): string {
  return '$' + finite(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** $37.7k style. */
export function moneyK(n: number): string {
  const v = finite(n)
  if (Math.abs(v) >= 1000) return '$' + (v / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 }) + 'k'
  return '$' + Math.round(v).toLocaleString('en-US')
}

export function compact(n: number): string {
  const v = finite(n)
  if (v >= 1000) return (v / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 }) + 'K'
  return v.toLocaleString('en-US')
}

export function num(n: number): string {
  return Math.round(finite(n)).toLocaleString('en-US')
}

/** Absolute percentage, no sign (direction is shown by the arrow/color). */
export function pctAbs(n: number, dp = 1): string {
  return Math.abs(finite(n)).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp }) + '%'
}

export function relTime(min: number): string {
  if (min < 1) return 'just now'
  if (min < 60) return `${Math.round(min)} min ago`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} hr ago`
  return `${Math.floor(h / 24)} d ago`
}
