/** A client's brand mark: shows the uploaded logo when present, otherwise the
 *  coloured monogram. Sizing/rounding/text-size come from `className` so it can
 *  drop straight into every place a client mark is rendered. */
import { useTrimmedLogo } from '@/lib/logo'

interface MarkClient { logo?: string | null; color: string; mark: string; name?: string }

export function ClientMark({ account, className = '', title }: { account: MarkClient; className?: string; title?: boolean }) {
  const logo = useTrimmedLogo(account.logo ?? null)
  if (logo) {
    return (
      <span className={`grid place-items-center flex-none overflow-hidden bg-white border border-[var(--line)] ${className}`} title={title ? account.name : undefined}>
        <img src={logo} alt={account.name ?? ''} className="w-full h-full object-contain p-[3px]" />
      </span>
    )
  }
  return (
    <span className={`grid place-items-center flex-none mono font-bold text-white ${className}`} style={{ background: account.color }} title={title ? account.name : undefined}>
      {account.mark}
    </span>
  )
}
