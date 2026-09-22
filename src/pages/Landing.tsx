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
import { Link, useSearchParams } from 'react-router'
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
 * Message match for the cold-email traffic.
 *
 * The outbound sequence hooks on one specific, tactical thing - the ad
 * platforms disagreeing about who produced a lead - and describes what I build
 * as "reporting dashboards". This page argues the broader case: fragmentation,
 * a system rather than a dashboard. Both are true, but a visitor who arrives
 * expecting the first and reads the second decides they are in the wrong place
 * before the second line.
 *
 * Email 1 carries no link, so the URL is pasted by hand into a reply. That
 * makes a variant cheap: send ?from=email and the hero echoes the email it
 * came from. Everything below the hero is shared, so there is nothing to keep
 * in sync and no second page to maintain.
 */
const EMAIL_REF = 'email'

/** The console has no sign-in at all now, so these are plain links. */
const DEMO_ENTRY = '/app'
const SOCIAL_DEMO = '/app/social'

/**
 * Pricing. Edit these objects and the section below follows.
 *
 * The boundaries are set from the outbound list rather than guessed. Its median
 * is 17 staff and none of it is below 11, so Core spans 13-30 and catches about
 * nine in ten of them; an earlier ladder let that same median read itself into
 * the cheapest tier, which is the wrong way round when the middle tier is the
 * one most people pick. Starter exists for the 5-10 staff LinkedIn segment,
 * which otherwise arrives at a floor it cannot see itself in. Scale is a
 * ceiling that makes Core look reasonable more than it is a target.
 *
 * The design-partner rate is not published. A public low number becomes the
 * anchor for every later quote; it is offered by application instead, which is
 * what the smaller-agency outreach points at.
 */
const PRICING: {
  name: string; price: string; unit: string; fit: string; blurb: string;
  points: string[]; cta: string; featured?: boolean; anchor?: string
}[] = [
  {
    name: 'Starter',
    price: 'From $3,500',
    unit: 'one-off',
    fit: '5\u201312 staff',
    blurb: 'The core system for a smaller shop: every client in one place, your branding on it, reports that build themselves.',
    points: [
      'Your platforms connected and syncing',
      'One view across the whole roster',
      'Scheduled client reports, sent automatically',
      'Your branding throughout',
      'Yours to keep',
    ],
    cta: 'Book a call',
  },
  {
    // Deliberately where the modal prospect lands. The outbound list has a
    // median of 17 staff, so the boundaries are set to put roughly nine in ten
    // of them here rather than in the tier below - a middle tier is picked far
    // more often than either side, and it should not be the cheap one.
    name: 'Core',
    price: 'From $9,000',
    unit: 'one-off',
    fit: '13\u201330 staff',
    blurb: 'Everything in Starter, plus the layers that turn reporting into something your team decides from rather than reads.',
    points: [
      'Everything in Starter',
      'Manual reporting removed end to end',
      'AI insight layer: what needs attention, and why',
      'Deeper integrations, including CRM and internal data',
      'Role-based access: margin visible to you, not to the team',
      'Client-facing shareable views',
    ],
    cta: 'Book a call',
    featured: true,
  },
  {
    // The number is withheld here on purpose, but not entirely: a bare
    // "Contact us" wall tests worse than one carrying a starting anchor,
    // and this tier's real job is to make the middle one look reasonable.
    // Delete `anchor` to go fully blank.
    name: 'Scale',
    price: 'Custom',
    unit: '',
    anchor: 'Typically from $18,000',
    fit: '30+ staff, or multi-brand',
    blurb: 'For agencies with several brands or offices, bespoke data sources, and a real appetite for querying their own numbers.',
    points: [
      'Everything in Core',
      'Multiple brands, offices or regions',
      'Custom metrics and bespoke data sources',
      'AI interface: ask your data questions directly',
      'White-label domain and client logins',
    ],
    cta: 'Talk it through',
  },
]

/**
 * Support is not framed as optional, because it is not really optional:
 * OAuth tokens expire, Meta changes its API, Google deprecates fields. A build
 * left unmaintained quietly degrades, and saying otherwise oversells the
 * one-off. Optimisation genuinely is optional.
 */
const ONGOING = [
  {
    name: 'Support',
    price: 'From $400 / mo',
    tag: 'First 3 months included',
    note: 'Platforms re-authorised, API changes absorbed, breakages fixed. Continues after the included months unless you cancel.',
  },
  {
    name: 'Optimisation',
    price: 'From $1,200 / mo',
    tag: 'Optional',
    note: 'Ongoing changes as your roster, metrics and team shift. Plenty of agencies never need this.',
  },
]

/** Qualifying. Saying who this is not for protects the price before anyone asks. */
const FIT_YES = [
  'Agencies managing multiple client accounts',
  'Founders who want real visibility across the roster',
  'Teams tired of assembling reports by hand',
  'Anyone who needs margin visible to some people and not others',
]
const FIT_NO = [
  'Anyone shopping for the cheapest dashboard',
  'DIY setups looking for a template',
  'Single-client or in-house teams without a roster',
  'Anyone who needs it live next week',
]

/** The words owners actually use. Verbatim beats paraphrase here. */
const SOUNDS_FAMILIAR = [
  '\u201cWe\u2019re pulling reports manually every week.\u201d',
  '\u201cData is everywhere, nothing is clear.\u201d',
  '\u201cWe don\u2019t fully trust our numbers.\u201d',
]

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
    a: 'Starter opens at $3,500, Core at $9,000, and Scale is custom, typically from $18,000. Where you land depends on how many platforms and how much of your reporting is bespoke, so you get a firm figure on the first call rather than a follow-up email a week later.',
  },
  {
    q: 'Is it a subscription?',
    a: 'The build is a one-off and the result is yours. Support is the ongoing part: three months are included, then it continues monthly unless you cancel. That is not padding - platforms change their APIs and expire their tokens, and an unmaintained build goes stale. Optimisation on top of that is genuinely optional.',
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
  const [params] = useSearchParams()
  const fromEmail = params.get('from') === EMAIL_REF
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
          <a href="#pricing" className="hidden md:inline-flex items-center text-[13.5px] font-medium px-3 py-2 rounded-[9px] text-[var(--ink-2)] hover:text-[var(--ink)] transition-colors">Pricing</a>
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
            <span className="w-[7px] h-[7px] rounded-full bg-[var(--st-good)]" /> Built for agencies at 5&ndash;50 staff, running 10 or more client accounts
          </span>
          {fromEmail ? (
            <>
              <h1 className="mt-6 text-[36px] md:text-[52px] font-bold tracking-[-0.03em] leading-[1.06] max-w-[880px] mx-auto" style={{ textWrap: 'balance' } as any}>
                One cost per lead, across every platform you run
              </h1>
              <p className="mt-5 text-[16px] md:text-[18px] text-[var(--ink-2)] max-w-[680px] mx-auto leading-relaxed">
                This is the thing I emailed you about. Google Ads, Meta, Local Services and Google Business Profile stop disagreeing about who produced the lead, the client report builds off that same data, and margin stays visible to you and hidden from everyone else. Have a click around before we speak.
              </p>
            </>
          ) : (
            <>
              <h1 className="mt-6 text-[38px] md:text-[56px] font-bold tracking-[-0.03em] leading-[1.05] max-w-[860px] mx-auto" style={{ textWrap: 'balance' } as any}>
                Your reporting is fragmented.<br className="hidden sm:block" /> That&rsquo;s where the money leaks.
              </h1>
              <p className="mt-5 text-[16px] md:text-[18px] text-[var(--ink-2)] max-w-[660px] mx-auto leading-relaxed">
                Most agencies do not lack data. They lack one place to see it. We build the internal reporting system that pulls your platforms, your CRM and your spreadsheets into a single view your team actually works from &mdash; carrying your brand, not a vendor&rsquo;s.
              </p>
            </>
          )}
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
              The numbers sit in Meta, in Google, in your CRM, in a spreadsheet someone maintains by hand. Nothing shows what is actually happening across the roster, so decisions wait on someone assembling an answer. Most agencies land on Looker Studio because it is free, then find out what it costs: native to Google and nothing else, a paid connector for every other platform, a vendor footer on work you are charging for, and a rebuild for every new client.
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

      {/* The reframe. "Another dashboard" is the objection this has to beat. */}
      <Rise>
        <section className="mx-auto max-w-[1120px] px-5 pb-6">
          <div className="max-w-[760px] mx-auto rounded-[18px] border border-[var(--line)] bg-[var(--surface)] p-8 md:p-10 text-center shadow-[var(--shadow)]">
            <h2 className="text-[24px] md:text-[30px] font-bold tracking-[-0.02em]">Yes, it&rsquo;s a dashboard. That&rsquo;s the easy part.</h2>
            <p className="mt-3 text-[15.5px] text-[var(--ink-2)] leading-relaxed max-w-[600px] mx-auto">
              Anyone can put your numbers on a screen. The work is underneath: your sources wired together and syncing on their own, one definition of cost per lead that every platform agrees to, and access shaped around how your agency is actually structured. That is what stops reporting being a task and makes it something your team simply has.
            </p>
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

      {/* Pricing - after the comparison, so the number lands on someone who
          has already seen what it replaces. */}
      <Rise>
        <section id="pricing" className="mx-auto max-w-[1120px] px-5 py-14 md:py-20 scroll-mt-[76px]">
          <div className="text-center max-w-[620px] mx-auto mb-11">
            <h2 className="text-[28px] md:text-[34px] font-bold tracking-[-0.02em]">What it costs</h2>
            <p className="mt-3 text-[15px] text-[var(--ink-2)]">
              A build you own, not a seat licence you rent. The system itself is a one-off; only keeping it running is monthly.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-5 items-start">
            {PRICING.map((t) => (
              <div
                key={t.name}
                className={`h-full flex flex-col rounded-[16px] p-6 bg-[var(--surface)] shadow-[var(--shadow)] ${
                  t.featured
                    ? 'border-2 border-[var(--accent)] md:-mt-3 md:pb-8 shadow-[var(--shadow-pop)]'
                    : 'border border-[var(--line)]'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-[16px] font-bold tracking-[-0.01em]">{t.name}</h3>
                  {t.featured && (
                    <span className="text-[10.5px] font-bold uppercase tracking-[0.06em] px-2 py-0.5 rounded-full bg-[var(--accent-weak)] text-[var(--accent)]">
                      Most agencies
                    </span>
                  )}
                </div>
                <div className="mt-2 flex items-baseline gap-1.5 flex-wrap">
                  <span className="text-[30px] font-bold tracking-[-0.03em] leading-none">{t.price}</span>
                  {t.unit && <span className="text-[13px] text-[var(--muted)]">{t.unit}</span>}
                </div>
                {t.anchor && <div className="mt-1 text-[13px] text-[var(--muted)]">{t.anchor}</div>}
                <div className="mt-1.5 text-[12px] font-semibold text-[var(--accent)]">{t.fit}</div>
                <p className="mt-3 text-[13.5px] text-[var(--ink-2)] leading-relaxed">{t.blurb}</p>
                <ul className="mt-5 grid gap-2 flex-1">
                  {t.points.map((pt) => (
                    <li key={pt} className="flex items-start gap-2 text-[13.5px] text-[var(--ink-2)]">
                      <Check size={15} className="mt-[3px] shrink-0" style={{ color: 'var(--good)' }} /> {pt}
                    </li>
                  ))}
                </ul>
                <a
                  href={BOOK_A_CALL}
                  className={`mt-6 inline-flex items-center justify-center gap-2 text-[14.5px] font-semibold px-5 py-2.5 rounded-[10px] transition-opacity ${
                    t.featured
                      ? 'bg-[var(--accent)] text-white hover:opacity-90'
                      : 'bg-[var(--surface-2)] border border-[var(--line-2)] text-[var(--ink)] hover:bg-[var(--surface)]'
                  }`}
                >
                  {t.cta} <ArrowRight size={15} />
                </a>
              </div>
            ))}
          </div>
          <div className="mt-8 max-w-[760px] mx-auto rounded-[14px] border border-[var(--line)] bg-[var(--surface-2)] p-5">
            <div className="text-[12px] font-semibold uppercase tracking-[0.07em] text-[var(--muted)] mb-3">After it ships</div>
            <div className="grid sm:grid-cols-2 gap-4">
              {ONGOING.map((o) => (
                <div key={o.name}>
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-[14px] font-bold">{o.name}</span>
                    <span className="text-[13.5px] text-[var(--accent)] font-semibold">{o.price}</span>
                    <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-[var(--surface)] border border-[var(--line)] text-[var(--muted)]">{o.tag}</span>
                  </div>
                  <p className="mt-1 text-[13px] text-[var(--ink-2)] leading-relaxed">{o.note}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[12.5px] text-[var(--muted)]">Platforms change their APIs constantly. Support is what keeps a build working rather than slowly going stale.</p>
          </div>
          <p className="mt-6 text-center text-[13px] text-[var(--muted)] max-w-[620px] mx-auto">
            Every build is scoped on a call first. You get a firm number before anything starts, and the work is staged so you see it running rather than paying up front for a promise. Smaller agencies: a limited number of design-partner places exist at a reduced rate &mdash; ask on the call.
          </p>
        </section>
      </Rise>

      {/* Qualifying. Reads as confidence, and it protects the price. */}
      <Rise>
        <section className="mx-auto max-w-[1120px] px-5 py-12 md:py-16">
          <div className="grid md:grid-cols-2 gap-5 max-w-[860px] mx-auto">
            <div className="rounded-[16px] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-[var(--shadow)]">
              <h3 className="text-[16px] font-bold tracking-[-0.01em] mb-4">Who this is for</h3>
              <ul className="grid gap-2.5">
                {FIT_YES.map((t) => (
                  <li key={t} className="flex items-start gap-2.5 text-[14px] text-[var(--ink-2)]">
                    <Check size={16} className="mt-[3px] shrink-0" style={{ color: 'var(--good)' }} /> {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-[16px] border border-[var(--line)] bg-[var(--surface)] p-6 shadow-[var(--shadow)]">
              <h3 className="text-[16px] font-bold tracking-[-0.01em] mb-4">Who it is not for</h3>
              <ul className="grid gap-2.5">
                {FIT_NO.map((t) => (
                  <li key={t} className="flex items-start gap-2.5 text-[14px] text-[var(--ink-2)]">
                    <X size={16} className="mt-[3px] shrink-0" style={{ color: 'var(--bad)' }} /> {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-10 max-w-[760px] mx-auto text-center">
            <h3 className="text-[20px] md:text-[24px] font-bold tracking-[-0.02em]">If any of this sounds familiar</h3>
            <div className="mt-5 grid sm:grid-cols-3 gap-3">
              {SOUNDS_FAMILIAR.map((q) => (
                <blockquote key={q} className="rounded-[14px] border border-[var(--line)] bg-[var(--surface-2)] p-4 text-[14px] text-[var(--ink)] leading-snug italic">
                  {q}
                </blockquote>
              ))}
            </div>
            <p className="mt-5 text-[15px] text-[var(--ink-2)]">
              Then the answer is not another tool. It is a system.
            </p>
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
