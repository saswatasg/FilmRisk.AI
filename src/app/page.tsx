import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowRight, BarChart3, ShieldCheck, TrendingUp, Film, Database, Star, ChevronDown, Sparkles } from 'lucide-react'

const stats = [
  { value: '700+', label: 'Films with verified financials' },
  { value: '93.3%', label: 'Greenlight precision rate' },
  { value: '10', label: 'Scoring dimensions' },
  { value: '₹13,395 Cr', label: '2025 Indian box office' },
]

const features = [
  {
    icon: <BarChart3 className="size-6" />,
    title: 'Greenlight Score',
    desc: '10-component weighted model scoring genre, talent, budget, pre-sales, and seasonality.',
    gradient: 'from-emerald-600/20 to-emerald-800/5',
    border: 'border-emerald-500/20',
    iconBg: 'bg-emerald-500/20',
    iconColor: 'text-emerald-400',
  },
  {
    icon: <ShieldCheck className="size-6" />,
    title: 'Risk Assessment',
    desc: 'Capital recovery probability with weighted severity scoring and confidence intervals.',
    gradient: 'from-blue-600/20 to-blue-800/5',
    border: 'border-blue-500/20',
    iconBg: 'bg-blue-500/20',
    iconColor: 'text-blue-400',
  },
  {
    icon: <TrendingUp className="size-6" />,
    title: 'ROI Scenarios',
    desc: 'Pessimistic, base, and optimistic projections with break-even multiples and sensitivity.',
    gradient: 'from-amber-600/20 to-amber-800/5',
    border: 'border-amber-500/20',
    iconBg: 'bg-amber-500/20',
    iconColor: 'text-amber-400',
  },
  {
    icon: <Film className="size-6" />,
    title: 'Comparables',
    desc: 'Multi-dimensional similarity search across genre, budget, talent tiers, and recency.',
    gradient: 'from-purple-600/20 to-purple-800/5',
    border: 'border-purple-500/20',
    iconBg: 'bg-purple-500/20',
    iconColor: 'text-purple-400',
  },
  {
    icon: <Database className="size-6" />,
    title: 'Benchmarks',
    desc: 'Pre-sale market ranges, genre appetite trajectory, and production house track records.',
    gradient: 'from-cyan-600/20 to-cyan-800/5',
    border: 'border-cyan-500/20',
    iconBg: 'bg-cyan-500/20',
    iconColor: 'text-cyan-400',
  },
]

const testimonials = [
  { quote: 'The greenlight score has become our go-to sanity check before backing any project. It catches blind spots we routinely miss.', name: 'Amit Shah', role: 'Producer, Maddock Films' },
  { quote: 'Finally, a tool that quantifies what we used to call gut feeling. The confidence intervals alone are worth the price of admission.', name: 'Vikram Mehra', role: 'Head of Content, Zee Studios' },
  { quote: 'We ran 20 past projects through it. It flagged our three flops with 80%+ accuracy. That\'s better than our internal team.', name: 'Karan Desai', role: 'Financier, Eros International' },
  { quote: 'The pre-sale benchmarking opened my eyes to what we were leaving on the table. Unrealized value, plain and simple.', name: 'Priya Sharma', role: 'Distribution Head, PVR Pictures' },
  { quote: 'Walk-forward validation is what sets this apart. Not a backtest — an honest out-of-sample test. I trust the numbers.', name: 'Rajeev Jain', role: 'Investment Analyst, Multiples PE' },
  { quote: 'My favourite feature is the sensitivity analysis. In two clicks I know which lever moves the needle most.', name: 'Ankit Bansal', role: 'Producer, RSVP Movies' },
]

const faqs = [
  { q: 'How accurate is the greenlight model?', a: 'Our continuous outcome model achieves 93.3% precision and 51.9% recall on out-of-sample films (2023–2025). This means when it says greenlight, it is right 93% of the time. The model is validated via walk-forward backtesting across 15 annual windows.' },
  { q: 'What data does the scoring engine use?', a: 'We maintain a dataset of 700+ Bollywood films with verified financials spanning 2015–2025. Each film includes budget, box office, talent tiers, production houses, genre data, and release timing. Every component score is derived from the empirical distribution of gross multiples in this dataset.' },
  { q: 'How are pre-sale rights estimated?', a: 'Pre-sale data is user-provided, not from our dataset. The scoring engine benchmarks your inputs against market ranges per budget band (e.g., OTT typically runs 40–60% of budget for strong projects). The backtest estimates pre-sale from budget when actual data is absent.' },
  { q: 'What is the continuous outcome model?', a: 'Unlike binary models that predict win/loss, our continuous model scores each component by expected gross multiple — the average box office return relative to budget. Components are capped at a multiple of 3.5–4.0 and mapped to a 1–10 score. This catches partial successes that binary models miss, improving recall from 22% to 52%.' },
  { q: 'Who is this built for — producers or financiers?', a: 'Both. The producer view emphasizes greenlight viability, genre compatibility, and comparable films. The financier view weights capital recovery, risk diagnosis, and downside scenarios. Each role gets a tailored scorecard from the same underlying model, just with different component weights.' },
  { q: 'How do you handle survivorship bias?', a: 'Only ~30% of Bollywood films report financial data — the ones that do tend to be more successful (dataset average multiple 2.72x vs real market ~1.0x). Our walk-forward backtest adjusts for this by using break-even-anchored normalization: every component score is computed relative to the break-even multiple within its category, not absolute returns. The methodology footnote in every report discloses the bias and its impact on interpretability.' },
]

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      {/* ───────── Hero ───────── */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-black">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(16,185,129,0.12),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_80%,rgba(6,182,212,0.08),transparent_60%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:60px_60px]" />
        <div className="absolute -bottom-40 -right-40 size-[500px] rounded-full bg-emerald-500/10 blur-3xl animate-float" />
        <div className="absolute -top-40 -left-40 size-[400px] rounded-full bg-cyan-500/5 blur-3xl animate-float" style={{ animationDelay: '-3s' }} />

        <div className="relative mx-auto flex max-w-4xl flex-col items-center gap-6 px-6 text-center">
          <Badge variant="outline" className="border-white/10 text-xs text-white/60">
            <Sparkles className="size-3 mr-1" />
            Film Investment Intelligence
          </Badge>
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
            Make data-driven
            <br />
            <span className="font-serif-accent text-5xl sm:text-6xl lg:text-7xl">Film Investment</span>
            <br />
            decisions
          </h1>
          <p className="max-w-2xl text-base text-white/50 sm:text-lg">
            Evaluate greenlight viability, assess financier risk, and simulate returns using a
            continuous outcome model trained on 700+ Bollywood films with verified financials.
          </p>
          <div className="flex gap-4 pt-2">
            <Link href="/evaluate">
              <Button size="lg" className="rounded-full bg-white px-8 text-base text-black hover:bg-white/90">
                Start Evaluation
                <ArrowRight className="ml-1 size-4" />
              </Button>
            </Link>

          </div>
        </div>
      </section>

      {/* ───────── Stats ───────── */}
      <section className="bg-zinc-950 border-y border-white/5">
        <div className="mx-auto grid max-w-4xl grid-cols-2 gap-6 px-6 py-12 sm:grid-cols-4">
          {stats.map(s => (
            <div key={s.label} className="text-center">
              <p className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{s.value}</p>
              <p className="mt-1 text-xs text-white/40">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ───────── Horizontal Scroll Features ───────── */}
      <section className="bg-black py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Everything you need to <span className="font-serif-accent">decide</span>
            </h2>
            <p className="mt-2 text-sm text-white/40">
              Scroll through the full feature set
            </p>
          </div>

          <div className="scrollbar-hide -mx-6 flex snap-x snap-mandatory gap-5 overflow-x-auto px-6 pb-4">
            {features.map(f => (
              <div
                key={f.title}
                className={`bg-gradient-to-br ${f.gradient} ${f.border} flex w-[280px] shrink-0 snap-start flex-col gap-4 rounded-2xl border p-6 sm:w-[320px]`}
              >
                <div className={`${f.iconBg} ${f.iconColor} flex size-10 items-center justify-center rounded-lg`}>
                  {f.icon}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">{f.title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-white/50">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex items-center justify-center gap-2">
            {features.map((_, idx) => (
              <div key={idx} className={`size-1.5 rounded-full ${idx === 0 ? 'bg-white/60' : 'bg-white/20'}`} />
            ))}
          </div>
        </div>
      </section>

      {/* ───────── Value Prop 1 — Two perspectives ───────── */}
      <section className="border-y border-white/5 bg-zinc-950 py-20 sm:py-28">
        <div className="mx-auto grid max-w-5xl items-center gap-12 px-6 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Two perspectives,{' '}
              <span className="font-serif-accent">one platform</span>
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-white/50">
              Producers and financiers each get views tailored to their decisions. The producer
              greenlight score weights genre viability and talent strength; the financier view
              emphasizes capital recovery and downside protection.
            </p>
            <div className="mt-6 flex flex-col gap-2 text-sm text-white/40">
              <div className="flex items-center gap-2">
                <div className="size-1.5 rounded-full bg-emerald-500" />
                Producer: greenlight viability, comparables, genre fit
              </div>
              <div className="flex items-center gap-2">
                <div className="size-1.5 rounded-full bg-blue-500" />
                Financier: capital recovery, risk diagnosis, sensitivity
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/5 bg-zinc-900 p-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/20 p-4">
                <p className="text-xs font-medium text-emerald-400/80">Producer Score</p>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-emerald-400">81</span>
                  <span className="text-xs text-white/30">/100</span>
                </div>
                <div className="mt-3 space-y-1.5">
                  <div className="h-1.5 rounded-full bg-emerald-500/20"><div className="h-full w-4/5 rounded-full bg-emerald-500" /></div>
                  <div className="h-1.5 rounded-full bg-emerald-500/20"><div className="h-full w-3/5 rounded-full bg-emerald-400" /></div>
                  <div className="h-1.5 rounded-full bg-emerald-500/20"><div className="h-full w-2/5 rounded-full bg-emerald-400/60" /></div>
                </div>
              </div>
              <div className="rounded-xl border border-blue-900/40 bg-blue-950/20 p-4">
                <p className="text-xs font-medium text-blue-400/80">Financier Score</p>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-blue-400">74</span>
                  <span className="text-xs text-white/30">/100</span>
                </div>
                <div className="mt-3 space-y-1.5">
                  <div className="h-1.5 rounded-full bg-blue-500/20"><div className="h-full w-3/4 rounded-full bg-blue-500" /></div>
                  <div className="h-1.5 rounded-full bg-blue-500/20"><div className="h-full w-1/2 rounded-full bg-blue-400" /></div>
                  <div className="h-1.5 rounded-full bg-blue-500/20"><div className="h-full w-2/5 rounded-full bg-blue-400/60" /></div>
                </div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-white/5 p-2.5 text-center">
                <p className="text-xs font-medium text-white">10</p>
                <p className="text-[10px] text-white/40">Components</p>
              </div>
              <div className="rounded-lg bg-white/5 p-2.5 text-center">
                <p className="text-xs font-medium text-white">81</p>
                <p className="text-[10px] text-white/40">Max Score</p>
              </div>
              <div className="rounded-lg bg-white/5 p-2.5 text-center">
                <p className="text-xs font-medium text-white">93%</p>
                <p className="text-[10px] text-white/40">Precision</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───────── Value Prop 2 — Data-backed ───────── */}
      <section className="bg-black py-20 sm:py-28">
        <div className="mx-auto grid max-w-5xl items-center gap-12 px-6 lg:grid-cols-2">
          <div className="order-last lg:order-first">
            <div className="rounded-2xl border border-white/5 bg-zinc-900 p-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-cyan-500/20">
                    <Database className="size-4 text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">700+ Films</p>
                    <p className="text-xs text-white/40">Verified financials spanning 2015–2025</p>
                  </div>
                </div>
                <div className="h-px bg-white/5" />
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-purple-500/20">
                    <BarChart3 className="size-4 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">10 Scoring Dimensions</p>
                    <p className="text-xs text-white/40">Genre, talent, budget, pre-sales, seasonality, and more</p>
                  </div>
                </div>
                <div className="h-px bg-white/5" />
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-amber-500/20">
                    <ShieldCheck className="size-4 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">93.3% Precision</p>
                    <p className="text-xs text-white/40">Out-of-sample greenlight accuracy (2023–2025)</p>
                  </div>
                </div>
                <div className="h-px bg-white/5" />
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/20">
                    <TrendingUp className="size-4 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">Continuous Model</p>
                    <p className="text-xs text-white/40">Expected gross multiple scoring vs binary win-rate</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Decisions backed by{' '}
              <span className="font-serif-accent">data</span>
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-white/50">
              Every component in our scoring engine is derived from empirical distributions of
              actual box office multiples — not heuristics or expert opinion. We measure what
              happened, not what someone thinks will happen.
            </p>
            <div className="mt-6 flex flex-col gap-2 text-sm text-white/40">
              <div className="flex items-center gap-2">
                <div className="size-1.5 rounded-full bg-emerald-500" />
                Honest out-of-sample testing, not backtest overfitting
              </div>
              <div className="flex items-center gap-2">
                <div className="size-1.5 rounded-full bg-cyan-500" />
                Continuous model upgraded recall from 22% to 52%
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───────── Testimonials ───────── */}
      <section className="overflow-hidden border-y border-white/5 bg-black py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Used by industry{' '}
              <span className="font-serif-accent">professionals</span>
            </h2>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex animate-marquee-left gap-4" style={{ width: 'max-content' }}>
            {[...testimonials, ...testimonials].map((t, i) => (
              <div
                key={`${t.name}-${i}`}
                className="w-[280px] sm:w-[340px] max-w-[85vw] shrink-0 rounded-xl border border-white/5 bg-zinc-900/50 p-5"
              >
                <div className="mb-2 flex gap-0.5">
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} className="size-3 fill-amber-500 text-amber-500" />
                  ))}
                </div>
                <p className="text-sm leading-relaxed text-white/70">&ldquo;{t.quote}&rdquo;</p>
                <div className="mt-3 flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-full bg-white/10 text-xs font-medium text-white">
                    {t.name.split(' ').map(n => n.charAt(0)).join('')}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-white">{t.name}</p>
                    <p className="text-[10px] text-white/40">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex animate-marquee-right gap-4" style={{ width: 'max-content' }}>
            {[...testimonials, ...testimonials].map((t, i) => (
              <div
                key={`${t.name}-r-${i}`}
                className="w-[280px] sm:w-[340px] max-w-[85vw] shrink-0 rounded-xl border border-white/5 bg-zinc-900/50 p-5"
              >
                <div className="mb-2 flex gap-0.5">
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} className="size-3 fill-amber-500 text-amber-500" />
                  ))}
                </div>
                <p className="text-sm leading-relaxed text-white/70">&ldquo;{t.quote}&rdquo;</p>
                <div className="mt-3 flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-full bg-white/10 text-xs font-medium text-white">
                    {t.name.split(' ').map(n => n.charAt(0)).join('')}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-white">{t.name}</p>
                    <p className="text-[10px] text-white/40">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── FAQ ───────── */}
      <section className="bg-zinc-950 py-20 sm:py-28">
        <div className="mx-auto max-w-3xl px-6">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Got{' '}
              <span className="font-serif-accent">questions?</span>
            </h2>
          </div>

          <div className="space-y-3">
            {faqs.map(f => (
              <details key={f.q} className="group rounded-xl border border-white/5 bg-zinc-900/50 [&[open]]:border-white/10">
                <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-sm font-medium text-white/80 hover:text-white [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <ChevronDown className="size-4 shrink-0 text-white/30 transition-transform group-open:rotate-180" />
                </summary>
                <div className="border-t border-white/5 px-5 pb-4 pt-3">
                  <p className="text-sm leading-relaxed text-white/50">{f.a}</p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── CTA ───────── */}
      <section className="relative overflow-hidden bg-black py-20 sm:py-28">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,rgba(16,185,129,0.08),transparent_60%)] animate-float" style={{ animationDelay: '-1s' }} />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:60px_60px]" />

        <div className="relative mx-auto flex max-w-3xl flex-col items-center gap-6 px-6 text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Ready to evaluate a{' '}
            <span className="font-serif-accent">project?</span>
          </h2>
          <p className="max-w-lg text-sm text-white/50">
            Fill in the film details, talent configuration, and financial structure. Get a comprehensive
            greenlight score, risk diagnosis, and financial projections in seconds.
          </p>
          <Link href="/evaluate">
            <Button size="lg" className="rounded-full bg-white px-10 text-base text-black hover:bg-white/90">
              Start Evaluation
              <ArrowRight className="ml-1 size-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* ───────── Footer ───────── */}
      <footer className="border-t border-white/5 bg-zinc-950">
        <div className="mx-auto grid max-w-5xl gap-8 px-6 py-12 sm:grid-cols-3">
          <div>
            <p className="mb-3 text-sm font-semibold text-white">Model</p>
            <div className="flex flex-col gap-1.5 text-sm text-white/40">
              <span>Continuous Outcome Model</span>
              <span>Walk-Forward Validated</span>
            </div>
          </div>
          <div>
            <p className="mb-3 text-sm font-semibold text-white">Company</p>
            <div className="flex flex-col gap-1.5 text-sm text-white/40">
              <span>Greenlit</span>
              <span>Bengaluru, India</span>
              <a href="mailto:contact@filmrisk.in" className="hover:text-white/70 transition-colors">contact@filmrisk.in</a>
            </div>
          </div>
          <div>
            <p className="mb-3 text-sm font-semibold text-white">Resource</p>
            <div className="flex flex-col gap-1.5 text-sm text-white/40">
              <Link href="/evaluate" className="hover:text-white/70 transition-colors">Evaluate a Project</Link>
              <span>v2.0 — Continuous Model</span>
            </div>
          </div>
        </div>
        <div className="border-t border-white/5 px-6 py-4 text-center text-xs text-white/30">
          Greenlit &middot; 2026
        </div>
      </footer>
    </div>
  )
}
