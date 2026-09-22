/**
 * ReportBeacon landing page. Public marketing entry at "/", leading into the
 * live demo at "/app".
 *
 * Structure follows what converts for agency-reporting software: one question
 * answered above the fold, the Looker Studio problem named early (every
 * prospect already lives there), outcomes before features, white-label given
 * its own section because it is a top-three buying criterion, an explicit
 * comparison, then objections handled in an FAQ before the call is asked for.
 *
 * CTA discipline matters here: pages carrying several competing calls to
 * action convert materially worse than single-action pages. So the demo is the
 * only ask until the reader has seen the proof, and "book a call" appears once
 * the page has earned it. No invented testimonials, logos or customer counts -
 * there are no customers yet, and a cold prospect who checks would find that
 * out. The demo doing what it says is the proof on offer.
 */
import { motion } from 'framer-motion'
import { Link } from 'react-router'
import {
  ArrowRight, LayoutGrid, BellRing, Wallet, FileText, CalendarClock, Palette,
  Sun, Moon, Check, Play, X, Plug, SlidersHorizontal, Send,
} from 'lucide-react'
import { useApp } from '@/context/app'
import { Logo } from '@/components/Logo'
import { PlatformLogo } from '@/components/social/PlatformLogo'
import type { SocialPlatformId } from '@/lib/social'

const BOOK_A_CALL = 'https://www.tinashebenson.com/contact'
const EASE = [0.16, 1, 0.3, 1] as const
const SOCIAL_BLUE = '#2563eb'

/**
 * Every CTA carries ?demo=owner so the prospect lands inside the console rather
 * than on the sign-in form. The hero promises "no signup, no email" - a login
 * wall between that promise and the product is where a cold visitor leaves.
 */
const DEMO_ENTRY = '/app?demo=owner'
const SOCIAL_DEMO = '/app/social?demo=owner'

const SOCIAL_PLATFORMS: { id: SocialPlatformId; name: string; note: string }[] = [
  { id: 'instagram', name: 'Instagram', note: 'Reach & engagement' },
  { id: 'facebook', name: 'Facebook', note: 'Pages & posts' },
  { id: 'tiktok', name: 'TikTok', note: 'Video views' },
  { id: 'linkedin', name: 'LinkedIn', note: 'Company page' },
]

const PLATFORMS = [
  'Google Ads', 'Meta Ads', 'Google Analytics 4', 'Google Business Profile',
  'SEMrush', 'LinkedIn Ads', 'TikTok Ads', 'Local Services Ads',
]

/** Each row is a real, checkable difference - not a strawman. */
const COMPARISON: { label: string; them: string; us: string }[] = [
  { label: 'Non-Google platforms', them: 'Third-party connectors, billed monthly', us: 'Built into your instance' },
  { label: 'Your branding', them: 'Vendor footer on every report', us: 'Your logo, colours and domain' },
  { label: 'Adding a client', them: 'Rebuild and maintain a new report', us: 'Add the account' },
  { label: 'Sending the report', them: 'Someone remembers to do it', us: 'Weekly or monthly, on its own' },
  { label: 'Client access', them: 'Share a link and hope', us: 'Read-only seat, scoped to them' },
  { label: 'Margin', them: 'Same view for everyone', us: 'Owner sees it, account managers do not' },
]

const FAQ: { q: string; a: string }[] = [
  {
    q: 'Is this a product I subscribe to, or something you build for me?',
    a: 'A build. The demo shows the shape of it, then it gets wired to your platforms and fitted to the metrics and clients you actually manage. You are not squeezing your agency into someone else\'s template, and you are not sharing a roadmap with thousands of other users.',
  },
  {
    q: 'What is actually in the demo right now?',
    a: 'Sample data, end to end. Every number you see is invented so the console can be explored without connecting anything. Click through it properly - switch seats, open an account, build a report. What you are judging is whether the thing works the way your agency does.',
  },
  {
    q: 'We use a platform that is not on your list. Does that kill it?',
    a: 'Usually not. The list is what comes up most; the build is scoped around whatever you actually report on. If something genuinely has no usable API, you will be told that on the call rather than after you have paid.',
  },
  {
    q: 'Who holds the data?',
    a: 'You do. It runs against your own platform connections in your own instance. Nothing is pooled with other agencies and nothing is resold.',
  },
  {
    q: 'How long does it take?',
    a: 'It depends on how many platforms and how much of your reporting is bespoke. That is the main thing the first call is for - scoping it honestly rather than quoting a number that later moves.',
  },
  {
    q: 'What does it cost?',
    a: 'Scoped per agency, because client count and platform mix change the work substantially. You get a real number on the first call, not a follow-up email a week later.',
  },
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
      {/* Nav - one action only, so it does not compete with the hero */}
      <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--plane)_82%,transparent)] backdrop-blur">
        <div className="mx-auto max-w-[1120px] px-5 h-[60px] flex items-center gap-3">
          <Logo size={30} />
          <span className="font-bold text-[16px] tracking-[-0.01em]">ReportBeacon</span>
          <div className="flex-1" />
          <a href="#compare" className="hidden md:inline-flex items-center text-[13.5px] font-medium px-3 py-2 rounded-[9px] text-[var(--ink-2)] hover:text-[var(--ink)] transition-colors">Why not Looker Studio</a>
          <a href="#faq" className="hidden md:inline-flex items-center text-[13.5px] font-medium px-3 py-2 rounded-[9px] text-[var(--ink-2)] hover:text-[var(--ink)] transition-colors">Questions</a>
          <button onClick={toggleTheme} aria-label="Toggle theme" className="grid place-items-center w-9 h-9 rounded-[8px] text-[var(--ink-2)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)] transition-colors">
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <Link to={DEMO_ENTRY} className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold px-4 py-2 rounded-[9px] bg-[var(--accent)] text-white hover:opacity-90 transition-opacity">
            Open the demo <ArrowRight size={15} />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-[1120px] px-5 pt-16 md:pt-24 pb-10 text-center">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }}>
          <span className="inline-flex items-center gap-2 text-[12px] font-semibold px-3 py-1.5 rounded-full border border-[var(--line-2)] bg-[var(--surface)] text-[var(--ink-2)]">
            <span className="w-[7px] h-[7px] rounded-full bg-[var(--st-good)]" /> For agencies running 10-50 client accounts
          </span>
          <h1 className="mt-6 text-[38px] md:text-[56px] font-bold tracking-[-0.03em] leading-[1.05] max-w-[860px] mx-auto" style={{ textWrap: 'balance' } as any}>
            Stop rebuilding the same client report every month
          </h1>
          <p className="mt-5 text-[16px] md:text-[18px] text-[var(--ink-2)] max-w-[660px] mx-auto leading-relaxed">
            One console for the ad, social and search platforms your agency already runs, carrying your brand instead of a vendor's. The client report builds off the same numbers, so the first week of the month stops disappearing into exports and slide decks.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3">
            <Link to={DEMO_ENTRY} className="inline-flex items-center gap-2 text-[16px] font-semibold px-7 py-3.5 rounded-[11px] bg-[var(--accent)] text-white hover:opacity-90 transition-opacity shadow-[var(--shadow-pop)]">
              <Play size={17} /> Open the live demo
            </Link>
            <p className="text-[13px] text-[var(--muted)]">No signup, no email. Sample data throughout &mdash; nothing you click is saved.</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.15 }}
          className="mt-14 md:mt-16"
        >
          <BrowserFrame src={shot} />
        </motion.div>
      </section>

      {/* Problem - named specifically, because every prospect is already living it */}
      <Rise>
        <section className="mx-auto max-w-[1120px] px-5 py-14 md:py-20">
          <div className="max-w-[720px] mx-auto text-center">
            <span className="text-[11.5px] font-semibold uppercase tracking-[0.09em] text-[var(--muted)]">The first week of every month</span>
            <h2 className="mt-3 text-[28px] md:text-[36px] font-bold tracking-[-0.025em]" style={{ textWrap: 'balance' } as any}>
              Reporting is the work nobody scoped and everybody pays for
            </h2>
            <p className="mt-4 text-[15.5px] md:text-[16px] text-[var(--ink-2)] leading-relaxed">
              Most agencies land on Looker Studio because it is free, then find out what it costs. It is native to Google and nothing else, so every non-Google platform needs a paid connector. It puts a vendor footer on work you are charging a client for. Nothing sends itself. And every new client means building and then maintaining another report by hand.
            </p>
          </div>
          <div className="mt-10 grid sm:grid-cols-3 gap-4 max-w-[860px] mx-auto">
            {[
              { n: 'Connectors', t: 'Billed monthly, per platform, forever, just to see Meta next to Google.' },
              { n: 'Someone’s week', t: 'Exports, tidy-ups and a deck rebuilt from scratch for every client.' },
              { n: 'Their brand', t: 'A vendor footer at the bottom of a report with your name on it.' },
            ].map((c) => (
              <div key={c.n} className="rounded-[14px] border border-[var(--line)] bg-[var(--surface)] p-5">
                <div className="text-[13px] font-bold tracking-[-0.01em] mb-1.5">{c.n}</div>
                <p className="text-[13.5px] text-[var(--ink-2)] leading-relaxed">{c.t}</p>
              </div>
            ))}
          </div>
        </section>
      </Rise>

      {/* Platform row */}
      <Rise>
        <section className="mx-auto max-w-[1120px] px-5 pb-6">
          <p className="text-center text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)] mb-4">Built to sit on the platforms you already report on</p>
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
            {PLATFORMS.map((p) => (
              <span key={p} className="text-[13.5px] font-medium px-3.5 py-1.5 rounded-full bg-[var(--surface)] border border-[var(--line)] text-[var(--ink-2)]">{p}</span>
            ))}
            <span className="text-[13.5px] font-medium px-1.5 py-1.5 text-[var(--muted)]">and whatever else you run</span>
          </div>
        </section>
      </Rise>

      {/* How it works */}
      <section className="mx-auto max-w-[1120px] px-5 py-12 md:py-16">
        <Rise>
          <div className="text-center max-w-[620px] mx-auto mb-11">
            <h2 className="text-[28px] md:text-[34px] font-bold tracking-[-0.02em]">How a build actually goes</h2>
            <p className="mt-3 text-[15px] text-[var(--ink-2)]">Three steps, and you are not doing the middle one.</p>
          </div>
        </Rise>
        <div className="grid md:grid-cols-3 gap-5">
          <Step n="01" icon={<Plug size={19} />} title="Your platforms get connected" delay={0}>
            The accounts you already manage, wired into one console. You grant access once instead of maintaining a connector bill.
          </Step>
          <Step n="02" icon={<SlidersHorizontal size={19} />} title="It gets shaped around your reporting" delay={0.07}>
            Your metrics, your client list, your brand on the console and on every report. Not a template you bend your agency to fit.
          </Step>
          <Step n="03" icon={<Send size={19} />} title="Reports go out without you" delay={0.14}>
            Put each client on a weekly or monthly schedule. The report builds off live numbers and sends itself, carrying your name.
          </Step>
        </div>
      </section>

      {/* Outcomes */}
      <section className="mx-auto max-w-[1120px] px-5 py-12 md:py-16">
        <Rise>
          <div className="text-center max-w-[620px] mx-auto mb-12">
            <h2 className="text-[28px] md:text-[34px] font-bold tracking-[-0.02em]">What changes day to day</h2>
          </div>
        </Rise>
        <div className="grid md:grid-cols-2 gap-5">
          <Feature icon={<LayoutGrid size={20} />} title="The whole roster on one screen" delay={0}>
            Every account in one table: health, leads, cost per lead, and how spend is pacing against budget. Sort it, search it, open any account for the full picture.
          </Feature>
          <Feature icon={<BellRing size={20} />} title="You hear it before the client does" delay={0.06}>
            A lead source that dropped, a response time slipping past target, spend running ahead of budget. It surfaces on the first screen instead of in an angry email.
          </Feature>
          <Feature icon={<Wallet size={20} />} title="Budget calls with the maths attached" delay={0.12}>
            Where to shift spend to bring cost per lead down, and the numbers behind each recommendation. Use the built-in engine or connect your own model through OpenRouter.
          </Feature>
          <Feature icon={<FileText size={20} />} title="A client-ready report in a click" delay={0.18}>
            Any account becomes a clean report on the real reporting dates, carrying the metrics that client actually cares about. Export to PDF or send it straight out.
          </Feature>
          <Feature icon={<CalendarClock size={20} />} title="Reports that send themselves" delay={0.24}>
            Weekly or monthly, per client, automatic. This is the one that gives you the first week of the month back.
          </Feature>
          <Feature icon={<Palette size={20} />} title="Seats that match who people are" delay={0.3}>
            The owner sees margin across the agency. Account managers see their accounts and not the margin. Clients get a read-only view scoped to them.
          </Feature>
        </div>
      </section>

      {/* White label - its own section, because agencies buy on this */}
      <Rise>
        <section className="mx-auto max-w-[1120px] px-5 py-4">
          <div className="rounded-[18px] border border-[var(--line)] bg-[var(--surface)] p-8 md:p-12 shadow-[var(--shadow)]">
            <div className="grid md:grid-cols-[1fr_1fr] gap-8 md:gap-12 items-center">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-[0.09em] text-[var(--accent)]">White label, properly</span>
                <h2 className="mt-2.5 text-[26px] md:text-[32px] font-bold tracking-[-0.02em]">Your name on it, not ours</h2>
                <p className="mt-3 text-[15px] text-[var(--ink-2)] leading-relaxed">
                  White label usually means a logo slot and a vendor footer you cannot remove. Here it means the console, the reports, the scheduled emails and the client's login all carry your agency, with nothing pointing back at a tool your client could go and buy themselves.
                </p>
              </div>
              <ul className="grid gap-2.5">
                {[
                  'Your logo and colour across the console',
                  'Reports that carry your agency, not a vendor mark',
                  'Scheduled emails sent as you',
                  'A client login that looks like yours',
                  'No footer your client can click away from you',
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2.5 text-[14.5px] text-[var(--ink-2)]">
                    <Check size={17} className="mt-[2px] shrink-0" style={{ color: 'var(--good)' }} /> {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </Rise>

      {/* Comparison */}
      <Rise>
        <section id="compare" className="mx-auto max-w-[1120px] px-5 py-14 md:py-20 scroll-mt-[76px]">
          <div className="text-center max-w-[620px] mx-auto mb-10">
            <h2 className="text-[28px] md:text-[34px] font-bold tracking-[-0.02em]">If you are on Looker Studio now</h2>
            <p className="mt-3 text-[15px] text-[var(--ink-2)]">It is a capable tool. These are the places agencies outgrow it.</p>
          </div>
          {/* Three columns only where they fit. At phone width the same content
              stacks per row, because a 3-column table at 390px wraps every cell
              to five lines and stops being readable. */}
          <div className="hidden md:block max-w-[860px] mx-auto rounded-[16px] border border-[var(--line)] bg-[var(--surface)] overflow-hidden shadow-[var(--shadow)]">
            <div className="grid grid-cols-[1.1fr_1fr_1fr] gap-0 border-b border-[var(--line)] bg-[var(--surface-2)]">
              <div className="p-4 text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">&nbsp;</div>
              <div className="p-4 text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">Looker Studio</div>
              <div className="p-4 text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--accent)]">ReportBeacon</div>
            </div>
            {COMPARISON.map((r, i) => (
              <div key={r.label} className={`grid grid-cols-[1.1fr_1fr_1fr] gap-0 ${i < COMPARISON.length - 1 ? 'border-b border-[var(--line)]' : ''}`}>
                <div className="p-4 text-[14px] font-semibold">{r.label}</div>
                <div className="p-4 text-[13.5px] text-[var(--ink-2)] flex items-start gap-2">
                  <X size={15} className="mt-[2px] shrink-0" style={{ color: 'var(--bad)' }} />
                  <span>{r.them}</span>
                </div>
                <div className="p-4 text-[13.5px] text-[var(--ink-2)] flex items-start gap-2">
                  <Check size={15} className="mt-[2px] shrink-0" style={{ color: 'var(--good)' }} />
                  <span>{r.us}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="md:hidden grid gap-3">
            {COMPARISON.map((r) => (
              <div key={r.label} className="rounded-[14px] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow)]">
                <div className="text-[14px] font-bold tracking-[-0.01em] mb-3">{r.label}</div>
                <div className="grid gap-2.5">
                  <div className="flex items-start gap-2.5">
                    <X size={15} className="mt-[3px] shrink-0" style={{ color: 'var(--bad)' }} />
                    <p className="text-[13.5px] leading-snug text-[var(--ink-2)]">
                      <span className="font-semibold text-[var(--ink)]">Looker Studio</span> &mdash; {r.them}
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Check size={15} className="mt-[3px] shrink-0" style={{ color: 'var(--good)' }} />
                    <p className="text-[13.5px] leading-snug text-[var(--ink-2)]">
                      <span className="font-semibold text-[var(--ink)]">ReportBeacon</span> &mdash; {r.us}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </Rise>

      {/* Social band */}
      <Rise>
        <section className="mx-auto max-w-[1120px] px-5 py-4">
          <div className="rounded-[18px] border border-[var(--line)] bg-[var(--surface)] p-8 md:p-12 shadow-[var(--shadow)] overflow-hidden">
            <div className="grid md:grid-cols-[1.05fr_1fr] gap-8 md:gap-12 items-center">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-[0.09em] mono" style={{ color: SOCIAL_BLUE }}>Social, in the same console</span>
                <h2 className="mt-2.5 text-[26px] md:text-[32px] font-bold tracking-[-0.02em]">Run the social side too, not just paid</h2>
                <p className="mt-3 text-[15px] text-[var(--ink-2)] leading-relaxed max-w-[520px]">
                  Instagram, Facebook, TikTok and LinkedIn, side by side with the ad accounts. Reach and engagement across the roster, post performance, best time to post, and a client-ready report that carries your brand. Flip to the social face and the whole console shifts to a blue identity of its own.
                </p>
                <div className="mt-6">
                  <Link to={SOCIAL_DEMO} className="inline-flex items-center gap-2 text-[15px] font-semibold px-5 py-3 rounded-[10px] text-white hover:opacity-90 transition-opacity" style={{ background: SOCIAL_BLUE }}>
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

      {/* Demo band */}
      <Rise>
        <section className="mx-auto max-w-[1120px] px-5 py-10 md:py-14">
          <div className="rounded-[18px] border border-[var(--line)] bg-[var(--surface)] p-8 md:p-12 text-center shadow-[var(--shadow)]">
            <h2 className="text-[26px] md:text-[32px] font-bold tracking-[-0.02em]">Judge it by using it</h2>
            <p className="mt-3 text-[15px] text-[var(--ink-2)] max-w-[580px] mx-auto leading-relaxed">
              Switch between the owner and manager seats and watch what each one is allowed to see. Drill into an account. Build a report. It runs on sample numbers, so click anything &mdash; nothing is saved beyond your own browser.
            </p>
            <div className="mt-7">
              <Link to={DEMO_ENTRY} className="inline-flex items-center gap-2 text-[16px] font-semibold px-7 py-3.5 rounded-[11px] bg-[var(--accent)] text-white hover:opacity-90 transition-opacity">
                Open the live demo <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </section>
      </Rise>

      {/* Who is behind it - the real objection for a build at this price */}
      <Rise>
        <section className="mx-auto max-w-[1120px] px-5 py-10 md:py-14">
          <div className="max-w-[760px] mx-auto flex flex-col sm:flex-row items-center sm:items-start gap-6 sm:gap-8 text-center sm:text-left">
            <img
              src="/tinashe.png"
              alt="Tinashe Benson"
              width={96}
              height={96}
              className="w-[96px] h-[96px] rounded-full shrink-0"
              loading="lazy"
            />
            <div>
              <h2 className="text-[22px] md:text-[26px] font-bold tracking-[-0.02em]">Who builds it</h2>
              <p className="mt-3 text-[15px] text-[var(--ink-2)] leading-relaxed">
                I am Tinashe Benson, and I build these on my own rather than running them through a sales team. That has an obvious implication worth saying out loud: you are trusting one person with a build, so the work is scoped in stages and you see something running early rather than paying up front for a promise. The demo on this page is the same codebase your instance starts from &mdash; it is the best evidence I can give you before we have spoken.
              </p>
              <a href={BOOK_A_CALL} className="mt-4 inline-flex items-center gap-1.5 text-[14px] font-semibold text-[var(--accent)]">
                More about me <ArrowRight size={14} />
              </a>
            </div>
          </div>
        </section>
      </Rise>

      {/* FAQ */}
      <Rise>
        <section id="faq" className="mx-auto max-w-[1120px] px-5 py-12 md:py-16 scroll-mt-[76px]">
          <div className="text-center max-w-[620px] mx-auto mb-10">
            <h2 className="text-[28px] md:text-[34px] font-bold tracking-[-0.02em]">Before you book anything</h2>
          </div>
          <div className="max-w-[760px] mx-auto grid gap-3">
            {FAQ.map((f) => (
              <details key={f.q} className="group rounded-[14px] border border-[var(--line)] bg-[var(--surface)] px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex items-center gap-3 cursor-pointer list-none text-[15px] font-semibold tracking-[-0.01em]">
                  <span className="flex-1">{f.q}</span>
                  <span className="shrink-0 text-[var(--muted)] transition-transform group-open:rotate-45 text-[20px] leading-none">+</span>
                </summary>
                <p className="mt-3 text-[14.5px] text-[var(--ink-2)] leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </Rise>

      {/* Final CTA - the call is asked for once, at the end */}
      <Rise>
        <section className="mx-auto max-w-[1120px] px-5 py-16 md:py-24 text-center">
          <h2 className="text-[30px] md:text-[40px] font-bold tracking-[-0.025em] max-w-[680px] mx-auto" style={{ textWrap: 'balance' } as any}>
            Want this wired to your own accounts?
          </h2>
          <p className="mt-4 text-[16px] text-[var(--ink-2)] max-w-[580px] mx-auto leading-relaxed">
            The demo runs on sample numbers. The real build connects to your platforms and is shaped around the clients and metrics you actually manage. One call to scope it and you will know what yours looks like and what it costs.
          </p>
          <ul className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13.5px] text-[var(--ink-2)]">
            {['Connected to your live platforms', 'Your metrics and branding', 'Reports your clients recognise'].map((t) => (
              <li key={t} className="inline-flex items-center gap-2"><Check size={15} style={{ color: 'var(--good)' }} /> {t}</li>
            ))}
          </ul>
          <div className="mt-8">
            <a href={BOOK_A_CALL} className="inline-flex items-center gap-2 text-[16px] font-semibold px-7 py-3.5 rounded-[11px] bg-[var(--accent)] text-white hover:opacity-90 transition-opacity shadow-[var(--shadow-pop)]">
              Book a call <ArrowRight size={16} />
            </a>
            <p className="mt-3 text-[13px] text-[var(--muted)]">
              Or <Link to={DEMO_ENTRY} className="underline underline-offset-2 hover:text-[var(--ink-2)]">keep clicking around the demo</Link> first.
            </p>
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
          <span className="text-[12.5px] text-[var(--muted)]">
            A demo by <a href="https://www.tinashebenson.com" className="underline underline-offset-2 hover:text-[var(--ink-2)]">Tinashe Benson</a>. Sample data, no live accounts.
          </span>
          <div className="sm:ml-auto flex items-center gap-4 text-[12.5px]">
            <a href={BOOK_A_CALL} className="font-semibold text-[var(--accent)] inline-flex items-center gap-1">Book a call <ArrowRight size={13} /></a>
          </div>
        </div>
      </footer>
    </div>
  )
}

function Step({ n, icon, title, children, delay }: { n: string; icon: React.ReactNode; title: string; children: React.ReactNode; delay: number }) {
  return (
    <Rise delay={delay}>
      <div className="h-full rounded-[16px] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-[var(--shadow)]">
        <div className="flex items-center gap-3 mb-4">
          <span className="inline-grid place-items-center w-10 h-10 rounded-[11px]" style={{ background: 'var(--accent-weak)', color: 'var(--accent)' }}>{icon}</span>
          <span className="text-[12px] font-bold mono text-[var(--muted)]">{n}</span>
        </div>
        <h3 className="text-[16.5px] font-bold tracking-[-0.01em] mb-2">{title}</h3>
        <p className="text-[14px] text-[var(--ink-2)] leading-relaxed">{children}</p>
      </div>
    </Rise>
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
