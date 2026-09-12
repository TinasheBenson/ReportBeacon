/**
 * ReportBeacon landing page. Public marketing entry at "/", leading into the
 * live demo at "/app". Sample-data disclaimer and a book-a-call CTA throughout.
 */
import { motion } from 'framer-motion'
import { Link } from 'react-router'
import {
  ArrowRight, LayoutGrid, BellRing, Wallet, FileText, CalendarClock, Palette, Sun, Moon, Check, Play,
} from 'lucide-react'
import { useApp } from '@/context/app'
import { Logo } from '@/components/Logo'
import { PlatformLogo } from '@/components/social/PlatformLogo'
import type { SocialPlatformId } from '@/lib/social'

const BOOK_A_CALL = 'https://www.tinashebenson.com/contact'
const EASE = [0.16, 1, 0.3, 1] as const
// The Social face preview uses the same blue identity the console shows.
const SOCIAL_BLUE = '#2563eb'
const SOCIAL_PLATFORMS: { id: SocialPlatformId; name: string; note: string }[] = [
  { id: 'instagram', name: 'Instagram', note: 'Reach & engagement' },
  { id: 'facebook', name: 'Facebook', note: 'Pages & posts' },
  { id: 'tiktok', name: 'TikTok', note: 'Video views' },
  { id: 'linkedin', name: 'LinkedIn', note: 'Company page' },
]

function Rise({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.55, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  )
}

export default function Landing() {
  const { theme, toggleTheme } = useApp()
  const shot = theme === 'dark' ? '/preview-dark.png' : '/preview-light.png'

  return (
    <div className="min-h-screen bg-[var(--plane)] text-[var(--ink)] overflow-x-clip">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--plane)_82%,transparent)] backdrop-blur">
        <div className="mx-auto max-w-[1120px] px-5 h-[60px] flex items-center gap-3">
          <Logo size={30} />
          <span className="font-bold text-[16px] tracking-[-0.01em]">ReportBeacon</span>
          <div className="flex-1" />
          <button onClick={toggleTheme} aria-label="Toggle theme" className="grid place-items-center w-9 h-9 rounded-[8px] text-[var(--ink-2)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)] transition-colors">
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <a href={BOOK_A_CALL} className="hidden sm:inline-flex items-center text-[13.5px] font-semibold px-3.5 py-2 rounded-[9px] text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors">Book a call</a>
          <Link to="/app" className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold px-4 py-2 rounded-[9px] bg-[var(--accent)] text-white hover:opacity-90 transition-opacity">
            Open the demo <ArrowRight size={15} />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-[1120px] px-5 pt-16 md:pt-24 pb-10 text-center">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }}>
          <span className="inline-flex items-center gap-2 text-[12px] font-semibold px-3 py-1.5 rounded-full border border-[var(--line-2)] bg-[var(--surface)] text-[var(--ink-2)]">
            <span className="w-[7px] h-[7px] rounded-full bg-[var(--st-good)]" /> Interactive demo, live now
          </span>
          <h1 className="mt-6 text-[38px] md:text-[56px] font-bold tracking-[-0.03em] leading-[1.05] max-w-[820px] mx-auto" style={{ textWrap: 'balance' } as any}>
            Every client account you run, on one screen
          </h1>
          <p className="mt-5 text-[16px] md:text-[18px] text-[var(--ink-2)] max-w-[640px] mx-auto leading-relaxed">
            ReportBeacon brings the ad, social, SEO and analytics platforms your agency already runs into one console. Every metric you pull together for a client report, in one place, so your team stops stitching screenshots from a dozen tabs.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/app" className="inline-flex items-center gap-2 text-[15px] font-semibold px-5 py-3 rounded-[10px] bg-[var(--accent)] text-white hover:opacity-90 transition-opacity">
              <Play size={16} /> Open the live demo
            </Link>
            <a href={BOOK_A_CALL} className="inline-flex items-center gap-2 text-[15px] font-semibold px-5 py-3 rounded-[10px] bg-[var(--surface)] border border-[var(--line-2)] text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors">
              Book a call
            </a>
          </div>
          <p className="mt-4 text-[13px] text-[var(--muted)]">Sample data throughout. Built to fit your accounts, your metrics, and your brand.</p>
        </motion.div>

        {/* Screenshot */}
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.15 }}
          className="mt-14 md:mt-16"
        >
          <BrowserFrame src={shot} />
        </motion.div>
      </section>

      {/* Platform row */}
      <Rise>
        <section className="mx-auto max-w-[1120px] px-5 py-8">
          <p className="text-center text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)] mb-4">Connect the platforms you report on</p>
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
            {['Google Ads', 'Meta Ads', 'Google Analytics 4', 'Google Business Profile', 'SEMrush', 'LinkedIn Ads', 'TikTok Ads', 'Local Services Ads'].map((p) => (
              <span key={p} className="text-[13.5px] font-medium px-3.5 py-1.5 rounded-full bg-[var(--surface)] border border-[var(--line)] text-[var(--ink-2)]">{p}</span>
            ))}
            <span className="text-[13.5px] font-medium px-1.5 py-1.5 text-[var(--muted)]">and more</span>
          </div>
        </section>
      </Rise>

      {/* Features */}
      <section className="mx-auto max-w-[1120px] px-5 py-12 md:py-16">
        <Rise>
          <div className="text-center max-w-[600px] mx-auto mb-12">
            <h2 className="text-[28px] md:text-[34px] font-bold tracking-[-0.02em]">What it does</h2>
            <p className="mt-3 text-[15px] text-[var(--ink-2)]">Everything an agency needs to run marketing for a roster of clients, in one place.</p>
          </div>
        </Rise>
        <div className="grid md:grid-cols-2 gap-5">
          <Feature icon={<LayoutGrid size={20} />} title="See the whole roster at a glance" delay={0}>
            Every account in one table: health, leads, cost per lead, and how spend is pacing against budget. Sort it, search it, and open any account for the full picture.
          </Feature>
          <Feature icon={<BellRing size={20} />} title="Catch problems before the client calls" delay={0.06}>
            It flags what needs attention today. A lead source that dropped, a response time slipping past target, spend running ahead of budget. You see it on the first screen.
          </Feature>
          <Feature icon={<Wallet size={20} />} title="Budget moves, with the math" delay={0.12}>
            It recommends where to shift spend to bring cost per lead down, and shows the numbers behind each call. Use the built-in engine, or connect your own model through OpenRouter.
          </Feature>
          <Feature icon={<FileText size={20} />} title="Client-ready reports in a click" delay={0.18}>
            Turn any account into a clean report with the real reporting dates and the metrics that client cares about. Export to PDF for review, or send it straight over.
          </Feature>
          <Feature icon={<CalendarClock size={20} />} title="Reports that send themselves" delay={0.24}>
            Put a client on a weekly or monthly schedule and the report goes out on its own. Your team stops rebuilding the same deck by hand every month.
          </Feature>
          <Feature icon={<Palette size={20} />} title="Your agency's brand, start to finish" delay={0.3}>
            Your name, colour, and logo across the console and every report. Each manager signs in to their own accounts; the owner sees the whole agency.
          </Feature>
        </div>
      </section>

      {/* Social band */}
      <Rise>
        <section className="mx-auto max-w-[1120px] px-5 py-4">
          <div className="rounded-[18px] border border-[var(--line)] bg-[var(--surface)] p-8 md:p-12 shadow-[var(--shadow)] overflow-hidden">
            <div className="grid md:grid-cols-[1.05fr_1fr] gap-8 md:gap-12 items-center">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-[0.09em] mono" style={{ color: SOCIAL_BLUE }}>Social, in the same console</span>
                <h2 className="mt-2.5 text-[26px] md:text-[32px] font-bold tracking-[-0.02em]">Run the social side too, not just paid</h2>
                <p className="mt-3 text-[15px] text-[var(--ink-2)] leading-relaxed max-w-[520px]">
                  Instagram, Facebook, TikTok and LinkedIn, side by side with the ad accounts. Reach and engagement across the roster, post performance, best time to post, and a client-ready report that carries the brand. Flip to the social face and the whole console shifts to a blue identity of its own.
                </p>
                <div className="mt-6">
                  <Link to="/app/social" className="inline-flex items-center gap-2 text-[15px] font-semibold px-5 py-3 rounded-[10px] text-white hover:opacity-90 transition-opacity" style={{ background: SOCIAL_BLUE }}>
                    <Play size={16} /> Open the social demo
                  </Link>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {SOCIAL_PLATFORMS.map((p) => (
                  <div key={p.id} className="flex items-center gap-2.5 rounded-[12px] border border-[var(--line)] bg-[var(--surface-2)] px-3.5 py-3">
                    <PlatformLogo platform={p.id} size={30} />
                    <div className="min-w-0">
                      <div className="text-[13.5px] font-semibold leading-tight">{p.name}</div>
                      <div className="text-[11.5px] text-[var(--muted)]">{p.note}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </Rise>

      {/* Try it band */}
      <Rise>
        <section className="mx-auto max-w-[1120px] px-5 py-4">
          <div className="rounded-[18px] border border-[var(--line)] bg-[var(--surface)] p-8 md:p-12 text-center shadow-[var(--shadow)]">
            <h2 className="text-[26px] md:text-[32px] font-bold tracking-[-0.02em]">Try it yourself</h2>
            <p className="mt-3 text-[15px] text-[var(--ink-2)] max-w-[560px] mx-auto">
              Switch between the owner and manager seats, drill into an account, build a report, or plug in your own model key. Nothing you do is saved anywhere but your own browser.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link to="/app" className="inline-flex items-center gap-2 text-[15px] font-semibold px-5 py-3 rounded-[10px] bg-[var(--accent)] text-white hover:opacity-90 transition-opacity">
                Open the demo <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </section>
      </Rise>

      {/* Final CTA */}
      <Rise>
        <section className="mx-auto max-w-[1120px] px-5 py-16 md:py-24 text-center">
          <h2 className="text-[30px] md:text-[40px] font-bold tracking-[-0.025em] max-w-[640px] mx-auto" style={{ textWrap: 'balance' } as any}>
            Want a version wired to your own accounts?
          </h2>
          <p className="mt-4 text-[16px] text-[var(--ink-2)] max-w-[560px] mx-auto">
            This demo runs on sample numbers. The real build connects to your platforms and is shaped around the metrics and clients you actually manage. Book a call and we will map out what yours looks like.
          </p>
          <ul className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13.5px] text-[var(--ink-2)]">
            {['Connected to your live platforms', 'Your metrics and branding', 'Reports your clients recognise'].map((t) => (
              <li key={t} className="inline-flex items-center gap-2"><Check size={15} style={{ color: 'var(--good)' }} /> {t}</li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a href={BOOK_A_CALL} className="inline-flex items-center gap-2 text-[15px] font-semibold px-6 py-3 rounded-[10px] bg-[var(--accent)] text-white hover:opacity-90 transition-opacity">
              Book a call <ArrowRight size={16} />
            </a>
            <Link to="/app" className="inline-flex items-center gap-2 text-[15px] font-semibold px-5 py-3 rounded-[10px] bg-[var(--surface)] border border-[var(--line-2)] hover:bg-[var(--surface-2)] transition-colors">
              Open the demo
            </Link>
          </div>
        </section>
      </Rise>

      {/* Footer */}
      <footer className="border-t border-[var(--line)]">
        <div className="mx-auto max-w-[1120px] px-5 py-8 flex flex-col sm:flex-row items-center gap-4">
          <div className="flex items-center gap-2.5">
            <Logo size={26} />
            <span className="font-bold text-[14px]">ReportBeacon</span>
          </div>
          <span className="text-[12.5px] text-[var(--muted)]">A demo by <a href="https://www.tinashebenson.com" className="underline underline-offset-2 hover:text-[var(--ink-2)]">Tinashe Benson</a>. Sample data, no live accounts.</span>
          <div className="sm:ml-auto flex items-center gap-4 text-[12.5px]">
            <a href={BOOK_A_CALL} className="font-semibold text-[var(--accent)] inline-flex items-center gap-1">Book a call <ArrowRight size={13} /></a>
          </div>
        </div>
      </footer>
    </div>
  )
}

function Feature({ icon, title, children, delay }: { icon: React.ReactNode; title: string; children: React.ReactNode; delay: number }) {
  return (
    <Rise delay={delay}>
      <div className="h-full rounded-[16px] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-[var(--shadow)] transition-transform hover:-translate-y-1 hover:shadow-[var(--shadow-pop)]">
        <span className="inline-grid place-items-center w-11 h-11 rounded-[11px] mb-4" style={{ background: 'var(--accent-weak)', color: 'var(--accent)' }}>{icon}</span>
        <h3 className="text-[17px] font-bold tracking-[-0.01em] mb-2">{title}</h3>
        <p className="text-[14px] text-[var(--ink-2)] leading-relaxed">{children}</p>
      </div>
    </Rise>
  )
}

function BrowserFrame({ src }: { src: string }) {
  return (
    <div className="mx-auto max-w-[960px] rounded-[14px] border border-[var(--line-2)] bg-[var(--surface)] shadow-[0_30px_80px_-24px_rgba(16,24,40,0.35)] overflow-hidden">
      <div className="flex items-center gap-2 px-4 h-10 border-b border-[var(--line)] bg-[var(--surface-2)]">
        <span className="w-3 h-3 rounded-full" style={{ background: '#ec6a5e' }} />
        <span className="w-3 h-3 rounded-full" style={{ background: '#f4bf4f' }} />
        <span className="w-3 h-3 rounded-full" style={{ background: '#61c554' }} />
        <span className="ml-3 text-[12px] text-[var(--muted)] mono">demo.tinashebenson.com/app</span>
      </div>
      <img src={src} alt="ReportBeacon portfolio dashboard showing account health, leads, cost per lead and spend pacing" className="block w-full" loading="eager" />
    </div>
  )
}
