'use client'

import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, ChevronDown, ArrowUpRight } from 'lucide-react'
import { countRange } from '@/lib/display-ranges'
import { authHeaders } from '@/lib/client-auth'
import type { EvaluationInput, EvaluationResult } from '@/lib/types'
import {
  FLOW_STORAGE_KEY, FLOW_DEFAULTS, GENRES_20, PRODUCTION_HOUSES_21, MONTHS_12,
  BUDGET_PROD_PCT, BUDGET_PA_PCT, BUDGET_CONTINGENCY, BUDGET_FINANCE_PCT,
  PRESALE_PCT, r1,
} from '@/lib/evaluate-defaults'

type TierInfo = { label: string; desc: string; films: number; medianBudgetCr: number | null; hitRatePct: number | null }
type TierRef = { actor: Record<string, TierInfo>; director: Record<string, TierInfo> }

function tierLine(role: 'actor' | 'director', tier: string, tierInfo: TierRef | null) {
  const t = tierInfo?.[role]?.[tier]
  if (!t || t.films === 0) return 'No track record in our data — scored by rank proxy'
  return `Typically ₹${t.medianBudgetCr}Cr films · ${countRange(t.films)} in data`
}

function WhyAsk({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-[13px] leading-relaxed text-[#8f8f8f]"><span className="text-white">Why we ask — </span>{children}</p>
}

function ScreenTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <h2 className="text-[26px] font-medium leading-[1.3] tracking-[0.2px] text-white sm:text-[32px]">{children}</h2>
      {hint && <p className="mt-2 text-sm text-[#969696]">{hint}</p>}
    </div>
  )
}

const SCREENS = [
  { id: 'title', label: 'The project' },
  { id: 'genre', label: 'Genre' },
  { id: 'format', label: 'Format' },
  { id: 'concept', label: 'Concept' },
  { id: 'director', label: 'Director' },
  { id: 'cast', label: 'Cast' },
  { id: 'budget', label: 'Budget' },
  { id: 'presales', label: 'Pre-sales' },
  { id: 'release', label: 'Release' },
  { id: 'review', label: 'Review' },
] as const

const CHIP = 'rounded-none border px-4 py-3 text-left text-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'
const CHIP_IDLE = 'border-[#303030] bg-transparent text-[#969696] hover:border-[#8f8f8f] hover:text-white'
const CHIP_ACTIVE = 'border-white/80 bg-white/[0.04] text-white'

export function EvaluateFlow({ onSubmit, loading, initialInput, purchaseNote }: {
  onSubmit: (input: EvaluationInput) => void
  loading: boolean
  initialInput?: EvaluationInput
  purchaseNote?: string | null
}) {
  const [tierInfo, setTierInfo] = useState<TierRef | null>(null)
  useEffect(() => { fetch('/api/reference').then(r => r.json()).then(setTierInfo).catch(() => {}) }, [])
  const [screen, setScreen] = useState<number>(() => {
    if (typeof window === 'undefined') return 0
    try {
      const saved = sessionStorage.getItem(FLOW_STORAGE_KEY)
      if (saved) return Math.min(JSON.parse(saved).screen ?? 0, SCREENS.length - 1)
    } catch { /* ignore */ }
    return 0
  })
  const [input, setInput] = useState<EvaluationInput>(() => {
    const base = { ...FLOW_DEFAULTS, ...(initialInput ?? {}) }
    if (typeof window === 'undefined') return base
    try {
      const saved = sessionStorage.getItem(FLOW_STORAGE_KEY)
      if (saved && !initialInput) {
        const parsed = JSON.parse(saved)
        if (parsed.input) return { ...FLOW_DEFAULTS, ...parsed.input }
      }
    } catch { /* ignore */ }
    return base
  })
  const [dir, setDir] = useState(1)
  const [budgetExpanded, setBudgetExpanded] = useState(false)
  const [preSalesExpanded, setPreSalesExpanded] = useState(false)
  const [budgetError, setBudgetError] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ verdict: string; score: number; pct: number; ci: number } | null>(null)
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const previewSeq = useRef(0)

  const totalQuestions = SCREENS.length - 1

  useEffect(() => {
    try { sessionStorage.setItem(FLOW_STORAGE_KEY, JSON.stringify({ input, screen })) } catch { /* ignore */ }
  }, [input, screen])

  useEffect(() => () => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current)
    if (previewTimer.current) clearTimeout(previewTimer.current)
  }, [])

  const goTo = useCallback((n: number) => {
    setDir(n > screen ? 1 : -1)
    setScreen(Math.max(0, Math.min(SCREENS.length - 1, n)))
    setBudgetError(null)
  }, [screen])

  const goNext = useCallback(() => {
    if (screen === 6 && !(input.totalBudgetCr > 0)) {
      setBudgetError('Enter a budget to continue — everything else has a safe default.')
      return
    }
    if (screen >= SCREENS.length - 1) return
    goTo(screen + 1)
  }, [screen, input.totalBudgetCr, goTo])

  const goBack = useCallback(() => { if (screen > 0) goTo(screen - 1) }, [screen, goTo])

  const autoAdvance = useCallback(() => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current)
    advanceTimer.current = setTimeout(() => goNext(), 300)
  }, [goNext])

  /* Keyboard: Enter continues, Escape goes back */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null
      const tag = el?.tagName
      if (e.key === 'Enter' && tag !== 'TEXTAREA' && tag !== 'SELECT' && !el?.closest('[data-slot="slider-thumb"]')) {
        e.preventDefault()
        if (screen === SCREENS.length - 1) {
          if (input.totalBudgetCr > 0 && !loading) submit()
        } else goNext()
      } else if (e.key === 'Escape') {
        goBack()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, input.totalBudgetCr, loading, goNext, goBack])

  /* Live preview: debounced full evaluation once a budget exists.
     Render guards on budget>0, so no state reset is needed when it drops. */
  const hasBudget = input.totalBudgetCr > 0
  useEffect(() => {
    if (!hasBudget) return
    if (previewTimer.current) clearTimeout(previewTimer.current)
    const seq = ++previewSeq.current
    previewTimer.current = setTimeout(async () => {
      try {
        const headers = authHeaders()
        if (!headers.Authorization) return
        const res = await fetch('/api/evaluate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...headers },
          body: JSON.stringify({ ...input, preview: true }),
        })
        if (!res.ok) return
        const data: EvaluationResult = await res.json()
        if (previewSeq.current !== seq) return
        setPreview({
          verdict: data.greenlight.verdict,
          score: data.greenlight.adjustedScore,
          pct: data.greenlight.realMarketPct,
          ci: data.greenlight.confidenceInterval.upper,
        })
      } catch { /* preview is best-effort; the real run happens on submit */ }
    }, 900)
    return () => { if (previewTimer.current) clearTimeout(previewTimer.current) }
  }, [input, hasBudget])

  function update<K extends keyof EvaluationInput>(key: K, value: EvaluationInput[K]) {
    setInput(prev => ({ ...prev, [key]: value }))
    setBudgetError(null)
  }

  function handleTotalBudget(value: number) {
    if (!budgetExpanded) {
      setInput(prev => ({
        ...prev,
        totalBudgetCr: value,
        productionBudgetCr: r1(value * BUDGET_PROD_PCT),
        pAndABudgetCr: r1(value * BUDGET_PA_PCT),
        contingencyPercent: BUDGET_CONTINGENCY,
        financingCostCr: r1(value * BUDGET_FINANCE_PCT),
      }))
    } else {
      setInput(prev => ({ ...prev, totalBudgetCr: value }))
    }
    setBudgetError(null)
  }


  function submit() {
    if (!(input.totalBudgetCr > 0)) {
      goTo(6)
      setBudgetError('Enter a budget to continue — everything else has a safe default.')
      return
    }
    onSubmit(input)
  }

  const totalPreSales = useMemo(() => r1(
    input.ottRightsCr + input.satelliteRightsCr + input.musicRightsCr +
    input.overseasRightsCr + input.brandRevenueCr
  ), [input.ottRightsCr, input.satelliteRightsCr, input.musicRightsCr, input.overseasRightsCr, input.brandRevenueCr])
  const coveragePct = input.totalBudgetCr > 0 ? Math.round((totalPreSales / input.totalBudgetCr) * 100) : 0

  const verdictLabel = preview ? (preview.verdict === 'greenlight' ? 'Greenlight' : preview.verdict === 'conditional' ? 'Conditional' : "Don't invest") : null

  return (
    <div className="w-full">
      <div aria-live="polite" className="sr-only">{loading ? 'Scoring your film project...' : ''}</div>

      {/* Sticky progress + live preview */}
      <div className="sticky top-16 z-30 -mx-4 border-b border-[#303030] bg-[#181818]/95 px-4 backdrop-blur">
        <div className="h-px w-full bg-[#303030]" role="progressbar"
          aria-label="Evaluation progress"
          aria-valuemin={1} aria-valuemax={SCREENS.length} aria-valuenow={screen + 1}
          aria-valuetext={screen < totalQuestions ? `Question ${screen + 1} of ${totalQuestions}` : 'Review'}>
          <div
            className="h-full bg-white/70 transition-all duration-400 ease-out"
            style={{ width: `${Math.round(((screen + 1) / SCREENS.length) * 100)}%` }}
          />
        </div>
        <div className="mx-auto flex max-w-2xl items-center justify-between py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[1.1px] text-[#8f8f8f]">
            {screen < totalQuestions ? <>Question {screen + 1} of {totalQuestions} <span className="ml-2 normal-case tracking-normal text-[#8f8f8f]">· {SCREENS[screen]!.label}</span></> : 'Review'}
          </p>
          {preview && hasBudget && screen < totalQuestions ? (
            <p className="text-[11px] uppercase tracking-[1.1px] text-[#8f8f8f]">
              Live preview · <span className="text-white">{verdictLabel} · P{preview.pct}</span>
            </p>
          ) : (
            <p className="hidden text-[11px] uppercase tracking-[1.1px] text-[#8f8f8f] sm:block">Unanswered questions use typical values</p>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 pb-16 pt-10 sm:pt-14">
        <div key={screen} className="animate-step-in" style={{ ['--step-dir' as string]: dir }}>

          {/* ── 0 · Title ── */}
          {screen === 0 && (
            <div>
              <ScreenTitle hint="Optional — skip it and we'll call it Untitled.">What should we call this project?</ScreenTitle>
              <Input
                autoFocus
                value={input.filmTitle ?? ''}
                onChange={e => update('filmTitle', e.target.value)}
                placeholder="Untitled Project"
                className="mt-8 h-14 rounded-[4px] border-[#303030] bg-[#181818] text-lg text-white"
              />
              <WhyAsk>Just a label for your memorandum. Nothing is scored off the name.</WhyAsk>
            </div>
          )}

          {/* ── 1 · Genre ── */}
          {screen === 1 && (
            <div>
              <ScreenTitle hint="One tap selects — sub-genre below is optional.">What kind of film is it?</ScreenTitle>
              <div className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {GENRES_20.map(g => {
                  const active = input.primaryGenre === g
                  return (
                    <button
                      key={g}
                      type="button"
                      onClick={() => { update('primaryGenre', g); autoAdvance() }}
                      className={`${CHIP} ${active ? CHIP_ACTIVE : CHIP_IDLE}`}
                    >
                      {g}
                    </button>
                  )
                })}
              </div>
              <div className="mt-6 max-w-xs">
                <Label className="text-[11px] font-semibold uppercase tracking-[1.1px] text-[#8f8f8f]">Sub-genre (optional)</Label>
                <Select value={input.secondaryGenre} onValueChange={v => update('secondaryGenre', v ?? '')}>
                  <SelectTrigger className="mt-2 w-full rounded-[4px] border-[#303030] bg-[#181818]">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {GENRES_20.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <WhyAsk>Genre decides which slice of history judges you — an action film is measured against action films, not dramas.</WhyAsk>
            </div>
          )}

          {/* ── 2 · Format ── */}
          {screen === 2 && (
            <div>
              <ScreenTitle hint="One tap selects.">Original story or sequel?</ScreenTitle>
              <div className="mt-8 grid gap-2 sm:grid-cols-2">
                {[
                  { v: false, t: 'Original', d: 'A standalone story, judged on its own premise.' },
                  { v: true, t: 'Sequel / Franchise', d: 'Built-in audience awareness the model credits.' },
                ].map(o => {
                  const active = input.sequelFlag === o.v
                  return (
                    <button
                      key={o.t}
                      type="button"
                      onClick={() => { update('sequelFlag', o.v); autoAdvance() }}
                      className={`${CHIP} p-5 ${active ? CHIP_ACTIVE : CHIP_IDLE}`}
                    >
                      <span className="block text-[16px] font-medium">{o.t}</span>
                      <span className="mt-1 block text-[13px] text-[#8f8f8f]">{o.d}</span>
                    </button>
                  )
                })}
              </div>
              <div className="mt-6">
                <Label className="text-[11px] font-semibold uppercase tracking-[1.1px] text-[#8f8f8f]">Logline (optional)</Label>
                <Textarea
                  value={input.logline ?? ''}
                  onChange={e => update('logline', e.target.value)}
                  placeholder="Two sentences on the premise and the hook."
                  rows={2}
                  className="mt-2 rounded-[4px] border-[#303030] bg-[#181818] text-white"
                />
              </div>
              <WhyAsk>Sequels carry built-in awareness. The logline is for your memorandum — the score never reads it.</WhyAsk>
            </div>
          )}

          {/* ── 3 · Concept ── */}
          {screen === 3 && (
            <div>
              <ScreenTitle hint="Two honest ratings. No database of script quality exists — you are the only source.">How strong is the concept?</ScreenTitle>
              <div className="mt-8 space-y-8">
                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-white">Concept clarity</Label>
                    <span className="text-sm font-medium tabular-nums text-white">{input.conceptClarity}/10</span>
                  </div>
                  <Slider min={1} max={10} value={[input.conceptClarity]}
                    onValueChange={v => update('conceptClarity', Array.isArray(v) ? v[0]! : v)} className="mt-3" />
                  <div className="mt-1 flex justify-between text-[11px] text-[#8f8f8f]"><span>Vague</span><span>Crystal</span></div>
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-white">Originality</Label>
                    <span className="text-sm font-medium tabular-nums text-white">{input.novelty}/10</span>
                  </div>
                  <Slider min={1} max={10} value={[input.novelty]}
                    onValueChange={v => update('novelty', Array.isArray(v) ? v[0]! : v)} className="mt-3" />
                  <div className="mt-1 flex justify-between text-[11px] text-[#8f8f8f]"><span>Formulaic</span><span>Breakthrough</span></div>
                </div>
              </div>
              <WhyAsk>Be honest here — the score trusts these ratings completely, and inflating them only inflates your own memorandum.</WhyAsk>
            </div>
          )}

          {/* ── 4 · Director tier ── */}
          {screen === 4 && (
            <div>
              <ScreenTitle hint="Names don't matter — only the band counts. One tap selects.">Who&apos;s directing?</ScreenTitle>
              <div className="mt-8 space-y-2">
                {['S', 'A', 'B', 'C', 'D'].map(t => {
                  const active = input.directorTier === t
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => { update('directorTier', t); autoAdvance() }}
                      className={`${CHIP} flex w-full items-center gap-4 p-4 ${active ? CHIP_ACTIVE : CHIP_IDLE}`}
                    >
                      <span className="w-8 text-center text-[26px] font-medium tabular-nums text-white">{t}</span>
                      <span className="min-w-0 flex-1 text-left">
                        <span className="block text-sm text-white">{tierInfo?.director[t]?.desc.split(' — ')[0] ?? t}</span>
                        <span className="mt-0.5 block text-xs text-[#8f8f8f]">{tierLine('director', t, tierInfo)}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
              <WhyAsk>Talent is the largest scoring component — and a director&apos;s record predicts returns better than the lead actor&apos;s. Reference bands are computed from our data, not opinion.</WhyAsk>
            </div>
          )}

          {/* ── 5 · Actor tier ── */}
          {screen === 5 && (
            <div>
              <ScreenTitle hint="Same bands, same honesty. One tap selects.">Who&apos;s headlining?</ScreenTitle>
              <div className="mt-8 space-y-2">
                {['S', 'A', 'B', 'C', 'D'].map(t => {
                  const active = input.actorTier === t
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => { update('actorTier', t); autoAdvance() }}
                      className={`${CHIP} flex w-full items-center gap-4 p-4 ${active ? CHIP_ACTIVE : CHIP_IDLE}`}
                    >
                      <span className="w-8 text-center text-[26px] font-medium tabular-nums text-white">{t}</span>
                      <span className="min-w-0 flex-1 text-left">
                        <span className="block text-sm text-white">{tierInfo?.actor[t]?.desc.split(' — ')[0] ?? t}</span>
                        <span className="mt-0.5 block text-xs text-[#8f8f8f]">{tierLine('actor', t, tierInfo)}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
              <WhyAsk>Star power opens films; it doesn&apos;t save them. The band sets the expectation — the rest of the score does the judging.</WhyAsk>
            </div>
          )}

          {/* ── 6 · Budget ── */}
          {screen === 6 && (
            <div>
              <ScreenTitle hint="A single number. Everything else on this screen is optional detail.">What&apos;s the total budget?</ScreenTitle>
              <div className="mt-8 flex items-baseline gap-2 border-b border-[#303030] pb-3">
                <span className="text-4xl text-[#8f8f8f]">₹</span>
                <input
                  type="number" min={0} step={0.5}
                  value={input.totalBudgetCr}
                  onChange={e => handleTotalBudget(parseFloat(e.target.value) || 0)}
                  className="w-full bg-transparent text-5xl font-medium tabular-nums text-white outline-none placeholder:text-[#444]"
                  placeholder="30"
                  aria-label="Total budget in crore rupees"
                />
                <span className="shrink-0 text-sm text-[#8f8f8f]">Cr</span>
              </div>
              {budgetError && <p className="mt-2 text-[13px] text-[#f13a2c]">{budgetError}</p>}
              <button
                type="button"
                onClick={() => setBudgetExpanded(v => !v)}
                className="mt-4 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[1.1px] text-[#8f8f8f] hover:text-white"
              >
                Break it down {budgetExpanded ? '−' : '+'}
                <ChevronDown className={`size-3 transition-transform ${budgetExpanded ? 'rotate-180' : ''}`} />
              </button>
              {budgetExpanded && (
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {[
                    { k: 'productionBudgetCr' as const, l: 'Production (₹ Cr)' },
                    { k: 'pAndABudgetCr' as const, l: 'P&A (₹ Cr)' },
                    { k: 'contingencyPercent' as const, l: 'Contingency (%)' },
                    { k: 'financingCostCr' as const, l: 'Financing (₹ Cr)' },
                  ].map(f => (
                    <div key={f.k}>
                      <Label className="text-[11px] uppercase tracking-[1.1px] text-[#8f8f8f]">{f.l}</Label>
                      <Input type="number" min={0} step={0.5} value={input[f.k]}
                        onChange={e => update(f.k, parseFloat(e.target.value) || 0)}
                        className="mt-1 h-12 rounded-[4px] border-[#303030] bg-[#181818]" />
                    </div>
                  ))}
                </div>
              )}
              <WhyAsk>Budget is our #1 predictor — it sets the break-even bar every other component is measured against. The breakdown only refines production viability.</WhyAsk>
            </div>
          )}

          {/* ── 7 · Pre-sales ── */}
          {screen === 7 && (
            <div>
              <ScreenTitle hint="Your numbers, not ours. Start with the total — break it down only if you want to.">What&apos;s already sold?</ScreenTitle>
              <div className="mt-8 flex items-baseline gap-2 border-b border-[#303030] pb-3">
                <span className="text-4xl text-[#8f8f8f]">₹</span>
                <input
                  type="number" min={0} step={0.5}
                  value={totalPreSales}
                  onChange={e => {
                    const v = parseFloat(e.target.value) || 0
                    if (!preSalesExpanded) {
                      setInput(prev => ({
                        ...prev,
                        ottRightsCr: r1(v * PRESALE_PCT.ott),
                        satelliteRightsCr: r1(v * PRESALE_PCT.satellite),
                        musicRightsCr: r1(v * PRESALE_PCT.music),
                        overseasRightsCr: r1(v * PRESALE_PCT.overseas),
                        brandRevenueCr: r1(v * PRESALE_PCT.brand),
                      }))
                    }
                  }}
                  className="w-full bg-transparent text-5xl font-medium tabular-nums text-white outline-none placeholder:text-[#444]"
                  placeholder="0"
                  aria-label="Total pre-sold revenue in crore rupees"
                />
                <span className="shrink-0 text-sm text-[#8f8f8f]">Cr</span>
              </div>
              {input.totalBudgetCr > 0 && (
                <div className="mt-4">
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="tabular-nums text-white">{coveragePct}% of budget covered</span>
                    <span className={coveragePct < 50 ? 'text-[#f13a2c]' : 'text-white'}>
                      {coveragePct < 50 ? 'Below market range' : coveragePct < 100 ? 'Within range' : 'Above range'}
                    </span>
                  </div>
                  <div className="mt-2 h-px w-full bg-[#303030]">
                    <div className="h-full bg-white/70 transition-all duration-500" style={{ width: `${Math.min(coveragePct, 100)}%` }} />
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={() => setPreSalesExpanded(v => !v)}
                className="mt-4 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[1.1px] text-[#8f8f8f] hover:text-white"
              >
                Break it down {preSalesExpanded ? '−' : '+'}
                <ChevronDown className={`size-3 transition-transform ${preSalesExpanded ? 'rotate-180' : ''}`} />
              </button>
              {preSalesExpanded && (
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {[
                    { k: 'ottRightsCr' as const, l: 'OTT / Digital' },
                    { k: 'satelliteRightsCr' as const, l: 'Satellite' },
                    { k: 'musicRightsCr' as const, l: 'Music' },
                    { k: 'overseasRightsCr' as const, l: 'Overseas' },
                    { k: 'brandRevenueCr' as const, l: 'Brand' },
                  ].map(f => (
                    <div key={f.k}>
                      <Label className="text-[11px] uppercase tracking-[1.1px] text-[#8f8f8f]">{f.l} (₹ Cr)</Label>
                      <Input type="number" min={0} step={0.5} value={input[f.k]}
                        onChange={e => setInput(prev => ({ ...prev, [f.k]: parseFloat(e.target.value) || 0 }))}
                        className="mt-1 h-12 rounded-[4px] border-[#303030] bg-[#181818]" />
                    </div>
                  ))}
                </div>
              )}
              <WhyAsk>Pre-sale coverage is the financier&apos;s first question. These are your deal values — the score benchmarks them against market ranges but never invents them.</WhyAsk>
            </div>
          )}

          {/* ── 8 · Release ── */}
          {screen === 8 && (
            <div>
              <ScreenTitle hint="When it lands, what surrounds it, and whose banner it carries.">When does it release?</ScreenTitle>
              <p className="mt-8 text-[11px] font-semibold uppercase tracking-[1.1px] text-[#8f8f8f]">Release month</p>
              <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
                {MONTHS_12.map(m => {
                  const active = input.releaseMonth === m.value
                  return (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => update('releaseMonth', m.value)}
                      className={`rounded-none border py-3 text-[13px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${active ? 'border-white/80 text-white' : 'border-[#303030] text-[#969696] hover:border-[#8f8f8f] hover:text-white'}`}
                    >
                      {m.label}
                    </button>
                  )
                })}
              </div>
              <p className="mt-8 text-[11px] font-semibold uppercase tracking-[1.1px] text-[#8f8f8f]">Market window</p>
              <div className="mt-3 space-y-2">
                {[
                  { v: 'strong' as const, t: 'Strong', d: 'Holiday or high-demand corridor.' },
                  { v: 'neutral' as const, t: 'Neutral', d: 'An ordinary release window.' },
                  { v: 'weak' as const, t: 'Weak', d: 'Crowded or low-demand corridor.' },
                ].map(o => {
                  const active = input.marketTiming === o.v
                  return (
                    <button
                      key={o.v}
                      type="button"
                      onClick={() => { update('marketTiming', o.v); autoAdvance() }}
                      className={`${CHIP} flex w-full items-center gap-3 p-4 ${active ? CHIP_ACTIVE : CHIP_IDLE}`}
                    >
                      <span className="text-sm font-medium text-white">{o.t}</span>
                      <span className="text-[13px] text-[#8f8f8f]">{o.d}</span>
                    </button>
                  )
                })}
              </div>
              <div className="mt-8">
                <Label className="text-[11px] font-semibold uppercase tracking-[1.1px] text-[#8f8f8f]">Production house (optional)</Label>
                <Select value={input.productionHouse} onValueChange={v => update('productionHouse', v ?? '')}>
                  <SelectTrigger className="mt-2 w-full rounded-[4px] border-[#303030] bg-[#181818]">
                    <SelectValue placeholder="None / Independent" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRODUCTION_HOUSES_21.map(h => <SelectItem key={h} value={h}>{h || 'None / Independent'}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <WhyAsk>Timing moves the score through seasonality and window strength. A tracked house adds its own track record; independents are judged on the film alone.</WhyAsk>
            </div>
          )}

          {/* ── 9 · Review ── */}
          {screen === 9 && (
            <div>
              <ScreenTitle hint="Everything you told us. Change anything before we score it.">Ready to score?</ScreenTitle>
              <dl className="mt-8 divide-y divide-[#303030] border-y border-[#303030]">
                {[
                  { l: 'Project', v: input.filmTitle?.trim() ? input.filmTitle : 'Untitled Project', go: 0 },
                  { l: 'Genre', v: input.secondaryGenre ? `${input.primaryGenre} · ${input.secondaryGenre}` : input.primaryGenre, go: 1 },
                  { l: 'Format', v: `${input.sequelFlag ? 'Sequel' : 'Original'}${input.logline?.trim() ? ` — “${input.logline.trim().slice(0, 60)}${input.logline.trim().length > 60 ? '…' : ''}”` : ''}`, go: 2 },
                  { l: 'Concept', v: `Clarity ${input.conceptClarity}/10 · Originality ${input.novelty}/10`, go: 3 },
                  { l: 'Director', v: `${input.directorTier} tier — ${tierInfo?.director[input.directorTier]?.desc.split(' — ')[0] ?? input.directorTier}`, go: 4 },
                  { l: 'Cast', v: `${input.actorTier} tier — ${tierInfo?.actor[input.actorTier]?.desc.split(' — ')[0] ?? input.actorTier}`, go: 5 },
                  { l: 'Budget', v: `₹${input.totalBudgetCr}Cr`, go: 6 },
                  { l: 'Pre-sales', v: `₹${totalPreSales}Cr (${coveragePct}% of budget)`, go: 7 },
                  {
                    l: 'Release',
                    v: `${MONTHS_12.find(m => m.value === input.releaseMonth)?.label} · ${input.marketTiming}${input.productionHouse ? ` · ${input.productionHouse}` : ''}`,
                    go: 8,
                  },
                ].map(r => (
                  <div key={r.l} className="flex items-baseline justify-between gap-4 py-3">
                    <dt className="shrink-0 text-[11px] font-semibold uppercase tracking-[1.1px] text-[#8f8f8f]">{r.l}</dt>
                    <dd className="min-w-0 flex-1 truncate text-right text-sm text-white">{r.v}</dd>
                    <button type="button" onClick={() => goTo(r.go)}
                      className="shrink-0 text-[11px] font-semibold uppercase tracking-[1.1px] text-[#8f8f8f] hover:text-white">
                      Edit
                    </button>
                  </div>
                ))}
              </dl>
              <div className="mt-6 border border-[#303030] p-5">
                <p className="text-[13px] leading-relaxed text-[#969696]">
                  Scores are ranked against twenty-five years of outcomes — never against opinion.
                  Our full film-by-film record is available under diligence.
                  <Link href="/#record"
                    className="ml-1 inline-flex items-center gap-0.5 text-white hover:underline">
                    How we test <ArrowUpRight className="size-3" />
                  </Link>
                </p>
              </div>
              <Button
                size="lg"
                onClick={submit}
                disabled={loading || !(input.totalBudgetCr > 0)}
                className="mt-8 h-12 w-full rounded-none bg-[#da291c] px-8 text-[14px] font-bold uppercase tracking-[1.4px] text-white hover:bg-[#b01e0a] disabled:opacity-40"
              >
                {loading ? 'Scoring…' : 'Score this film'}
              </Button>
              {purchaseNote && (
                <p className="mt-3 text-center text-[13px] leading-relaxed text-[#8f8f8f]">{purchaseNote}</p>
              )}
            </div>
          )}
        </div>

        {/* Nav */}
        {screen < SCREENS.length - 1 && (
          <div className="mt-10 flex items-center justify-between">
            {screen > 0 ? (
              <button type="button" onClick={goBack}
                className="inline-flex items-center gap-1.5 rounded-sm px-1 py-2 text-[11px] font-semibold uppercase tracking-[1.1px] text-[#8f8f8f] hover:text-white focus-visible:outline-2 focus-visible:outline-white">
                <ArrowLeft className="size-3.5" /> Back
              </button>
            ) : <span />}
            <button type="button" onClick={goNext}
              className="inline-flex items-center gap-1.5 border border-white/25 px-8 py-3 text-[14px] font-bold uppercase tracking-[1.4px] text-white transition-colors hover:border-white/60">
              Continue <ArrowRight className="size-4" />
            </button>
          </div>
        )}
        <p className="mt-6 text-center text-[11px] text-[#8f8f8f]">
          Press <span className="border border-[#303030] px-1.5 py-0.5 text-white">Enter</span> to continue
          <span className="mx-2">·</span>
          <span className="border border-[#303030] px-1.5 py-0.5 text-white">Esc</span> to go back
        </p>
      </div>
    </div>
  )
}
