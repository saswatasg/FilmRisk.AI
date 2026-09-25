import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Reveal } from './reveal'
import { ArrowUpRight } from 'lucide-react'

const scope = [
  { v: '2,454', l: 'Bollywood films, 2001–2025' },
  { v: '729', l: 'With verified budgets and grosses' },
  { v: '658', l: 'Films tested out-of-sample' },
  { v: '14', l: 'Rolling validation folds' },
]

const faqs = [
  {
    q: 'What do I receive at the end?',
    a: 'Everything listed in the section above, as a single one-page PDF you can hand to a partner — including the split between what came from the dataset and what came from your own assumptions.',
  },
  {
    q: 'What does it need from me?',
    a: 'The project details, your expected pre-sale deals by category, and your honest ratings of the concept. These exist nowhere in our data, so they are yours to supply — and the report is built to show how far your inputs move the score.',
  },
  {
    q: 'How do you handle the fact that most films never publish numbers?',
    a: 'Openly. Only about three in ten films report financials, and the ones that do skew successful. We judge every film against the break-even economics of its own era, and every report carries the caveat. Survivorship bias is disclosed, not corrected away.',
  },
  {
    q: 'Who is it for?',
    a: 'Producers weighing a greenlight and financiers weighing capital at risk. Same model, two scorecards: the producer view weights viability and comparables; the financier view weights recovery probability, downside scenarios, and risk diagnosis.',
  },
]

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      {/* ── Cinematic hero ── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0" aria-hidden>
          <div className="absolute inset-0 bg-[#181818]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(255,255,255,0.09),transparent_55%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_100%,rgba(218,41,28,0.10),transparent_50%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_55%,#181818_100%)]" />
        </div>
        <div className="relative mx-auto w-full max-w-[1280px] px-6 pb-24 pt-24 sm:pb-32 sm:pt-32">
          <Reveal>
            <p className="text-[11px] font-semibold uppercase tracking-[1.1px] text-[#8f8f8f]">
              Film investment intelligence
            </p>
            <h1 className="mt-6 max-w-3xl text-[48px] font-medium leading-[1.05] tracking-[-1.6px] text-white sm:text-[88px]">
              Know whether a film pays, before it shoots.
            </h1>
            <p className="mt-6 max-w-xl text-[16px] leading-relaxed text-[#969696]">
              Greenlit scores a project against twenty-five years of Bollywood outcomes —
              genre, talent, budget, pre-sales, timing — and returns a memorandum you can
              argue with: verdict, outcome ranges, comparables, risk factors, and the levers
              that move the score.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Link href="/evaluate">
                <Button className="h-12 rounded-none bg-[#da291c] px-8 text-[14px] font-bold uppercase tracking-[1.4px] text-white transition-all duration-200 hover:bg-[#b01e0a] hover:shadow-[0_0_28px_rgba(218,41,28,0.35)] active:bg-[#b01e0a]">
                  Evaluate a project
                </Button>
              </Link>
              <a
                href="#standard"
                className="inline-flex h-12 items-center border border-white/40 px-8 text-[14px] font-bold uppercase tracking-[1.4px] text-white transition-colors hover:border-white"
              >
                The standard
              </a>
            </div>
           </Reveal>
          <Reveal delay={150}>
          <dl className="mt-16 grid grid-cols-2 gap-x-6 gap-y-12 border-t border-[#303030] pt-12 sm:grid-cols-4">
            {scope.map(s => (
              <div key={s.l} className="flex flex-col">
                <dt className="order-2 mt-3 block text-[13px] leading-relaxed text-[#969696]">{s.l}</dt>
                <dd className="order-1 text-[56px] font-bold leading-none tabular-nums tracking-[-1.12px] text-white">{s.v}</dd>
              </div>
            ))}
          </dl>
          </Reveal>
        </div>
      </section>

      {/* ── The standard ── */}
      <section id="standard" className="bg-white text-[#181818]" aria-label="The standard">
        <div className="mx-auto max-w-[1280px] px-6 py-24">
          <p className="text-[11px] font-semibold uppercase tracking-[1.1px] text-[#666]">The standard</p>
          <h2 className="mt-4 max-w-2xl text-[40px] font-medium leading-[1.2] tracking-[-0.36px] sm:text-[52px]">
            Institutional-grade film underwriting.
          </h2>
          <div className="mt-14 grid gap-px bg-[#303030] sm:grid-cols-3">
            {[
              { n: '01', t: 'Out-of-sample by construction', d: 'Every claim on this page is a prediction made before the outcome was known — never fitted to the films it is later asked to judge.' },
              { n: '02', t: 'Financial-grade output', d: 'A memorandum, not a number. Ten scoring dimensions, each traced to its source, each printed with a sample size.' },
              { n: '03', t: 'Nothing overclaimed', d: 'Every number ships with an interval, and what the data cannot tell you is stated on the report itself — not buried in a footnote.' },
            ].map((s, i) => (
              <Reveal key={s.n} delay={i * 110}>
              <div className="bg-[#181818] p-8 transition-colors duration-300 hover:bg-[#202020]">
                <p className="flex items-center gap-2 text-[13px] font-semibold tabular-nums text-white"><span className="inline-block size-1.5 bg-[#da291c]" aria-hidden />{s.n}</p>
                <h3 className="mt-4 text-[19px] font-bold leading-snug text-white">{s.t}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-[#969696]">{s.d}</p>
              </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── The memorandum ── */}
      <section className="border-t border-[#303030]" aria-label="What you receive">
        <div className="mx-auto max-w-[1280px] px-6 py-24">
          <p className="text-[11px] font-semibold uppercase tracking-[1.1px] text-[#8f8f8f]">The memorandum</p>
          <h2 className="mt-4 max-w-2xl text-[40px] font-medium leading-[1.2] tracking-[-0.36px] sm:text-[52px]">
            One report you can hand a partner.
          </h2>
          <div className="mt-14 grid gap-10 sm:grid-cols-2">
            {[
              { l: 'Verdict', d: 'Greenlight, conditional, or do not invest — with the diagnosed risk level stated alongside.' },
              { l: 'Market percentile', d: 'Where your project sits in the empirical distribution of scored films.' },
              { l: 'Outcome ranges', d: 'Simulated 10,000-path projections instead of a single point estimate.' },
              { l: 'Risk diagnosis', d: 'Every factor pulling the score down, with severity and what-if sensitivity.' },
              { l: 'Comparables', d: 'Historically similar films with what actually happened to them — your project among its peers.' },
              { l: 'Levers', d: 'Which inputs move the needle and by how much — what to test before you commit.' },
            ].map((m, i) => (
              <Reveal key={m.l} delay={i * 80}>
              <div className="flex gap-4">
                <span className="shrink-0 size-1.5 bg-[#da291c]" />
                <div>
                  <p className="text-[16px] font-medium text-white">{m.l}</p>
                  <p className="mt-1 text-[15px] leading-relaxed text-[#969696]">{m.d}</p>
                </div>
              </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── The evidence ── */}
      <section id="record" className="bg-white text-[#181818]" aria-label="The evidence">
        <div className="mx-auto max-w-[1280px] px-6 py-24">
          <p className="text-[11px] font-semibold uppercase tracking-[1.1px] text-[#666]">The evidence</p>
          <h2 className="mt-4 max-w-2xl text-[40px] font-medium leading-[1.2] tracking-[-0.36px] sm:text-[52px]">
            Trained on the past. Judged only on the future.
          </h2>
          <div className="mt-12 divide-y divide-[#d2d2d2] border-y border-[#d2d2d2]">
            {[
              { t: 'Walk-forward validation', d: 'The model trains strictly on films released before each test year — never on the films it judges. Repeated across fourteen rolling folds, retrained from scratch every time.' },
              { t: 'Naive baselines alongside', d: 'Every internal benchmark sits next to always-say-no and band-average predictors, so we know exactly where the model adds value and where it does not.' },
              { t: 'Film-by-film record', d: 'A frozen holdout of recent releases with predicted verdict versus actual outcome for every film — the raw record behind every claim on this page.' },
              { t: 'Uncertainty on everything', d: 'Confidence intervals on every score, outcome ranges instead of point estimates, sample sizes printed next to every component.' },
            ].map((r, i) => (
              <Reveal key={r.t} delay={i * 90}>
              <div className="grid gap-2 py-8 sm:grid-cols-[280px_1fr] sm:gap-8">
                <p className="text-[17px] font-medium text-[#181818]">{r.t}</p>
                <p className="max-w-2xl text-[15px] leading-relaxed text-[#444]">{r.d}</p>
              </div>
              </Reveal>
            ))}
          </div>
          <div className="mt-16 border-t border-[#303030] pt-12">
            <p className="text-[11px] font-semibold uppercase tracking-[1.1px] text-[#8f8f8f]">Limits</p>
            <ul className="mt-6 max-w-2xl space-y-6">
              {[
                'It does not know your story. Your concept ratings are the only story signal the model ever sees, and it trusts them completely.',
                'It has no pre-sale database. Deal values are only as good as the numbers you enter, and optimism in your inputs shows up in the score.',
                'Regime changes fool it. The pandemic years and the recovery broke historical patterns. Any structural shift will do the same.',
                'On raw point prediction it trails a naive band average. Its edge is ranking and finding winners — not point estimates.',
              ].map(li => (
                <li key={li.slice(0, 28)} className="flex gap-4 text-[15px] leading-relaxed text-[#969696]">
                  <span className="mt-2 size-1 shrink-0 bg-[#da291c]" />
                  {li}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="border-t border-[#303030]" aria-label="Questions">
        <div className="mx-auto max-w-[1280px] px-6 py-24">
          <p className="text-[11px] font-semibold uppercase tracking-[1.1px] text-[#8f8f8f]">Questions</p>
          <div className="mt-8 divide-y divide-[#303030] border-y border-[#303030]">
            {faqs.map(f => (
              <details key={f.q} className="group py-7">
                <summary className="flex cursor-pointer list-none items-baseline justify-between gap-6 [&::-webkit-details-marker]:hidden">
                  <span className="text-[19px] font-medium text-white transition-colors group-hover:text-white">{f.q}</span>
                  <span className="shrink-0 text-xl text-[#8f8f8f] transition-transform duration-300 group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-[#969696]">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── Diligence close ── */}
      <section className="border-t border-[#303030]">
        <div className="mx-auto max-w-[1280px] px-6 py-24 text-center sm:py-32">
          <p className="text-[11px] font-semibold uppercase tracking-[1.1px] text-[#8f8f8f]">Diligence</p>
          <h2 className="mx-auto mt-4 max-w-2xl text-[48px] font-medium leading-[1.2] tracking-[-0.36px] text-white sm:text-[56px] sm:leading-[1.1] sm:tracking-[-1.12px]">
            Don&apos;t trust the score. Check the record.
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-[16px] leading-relaxed text-[#969696]">
            Every prediction we have ever published internally sits in a film-by-film record
            with outcomes attached. Ask for it before you trust us.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link href="/evaluate">
              <Button className="h-12 rounded-none bg-[#da291c] px-8 text-[14px] font-bold uppercase tracking-[1.4px] text-white hover:bg-[#b01e0a]">
                Evaluate a project
              </Button>
            </Link>
            <a
              href="#record"
              className="inline-flex h-12 items-center gap-1 border border-white/40 px-8 text-[14px] font-bold uppercase tracking-[1.4px] text-white transition-colors hover:border-white"
            >
              How we test <ArrowUpRight className="size-4" />
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-[#303030]">
        <div className="mx-auto grid max-w-[1280px] gap-10 px-6 py-16 sm:grid-cols-4">
          <div>
            <p className="flex items-center gap-2.5 text-[13px] font-semibold uppercase tracking-[0.65px] text-white">
              <span className="inline-block size-2.5 bg-[#da291c]" aria-hidden /> Greenlit
            </p>
            <p className="mt-4 max-w-xs text-[13px] leading-relaxed text-[#969696]">
              Pre-release film investment scoring, validated out-of-sample.
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[1.1px] text-[#8f8f8f]">Product</p>
            <div className="mt-4 flex flex-col gap-2.5 text-[13px] text-[#969696]">
              <Link href="/evaluate" className="transition-colors hover:text-white">Evaluate a project</Link>
            </div>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[1.1px] text-[#8f8f8f]">Method</p>
            <div className="mt-4 flex flex-col gap-2.5 text-[13px] text-[#969696]">
              <a href="#standard" className="transition-colors hover:text-white">The standard</a>
              <a href="#record" className="transition-colors hover:text-white">The evidence</a>
            </div>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[1.1px] text-[#8f8f8f]">Contact</p>
            <div className="mt-4 flex flex-col gap-2.5 text-[13px] text-[#969696]">
              <a href="mailto:saswatasg@gmail.com" className="transition-colors hover:text-white">saswatasg@gmail.com</a>
            </div>
          </div>
        </div>
        <div className="border-t border-[#303030]">
          <div className="mx-auto flex max-w-[1280px] items-center justify-between px-6 py-5 text-[12px] text-[#8f8f8f]">
            <span>Greenlit · MMXXVI</span>
            <span>Private preview</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
