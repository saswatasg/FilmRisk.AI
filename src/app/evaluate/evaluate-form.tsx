'use client'

import { useState, useRef, useEffect, forwardRef, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import { ChevronLeft, ChevronRight, Loader2, Sparkles, ChevronDown } from 'lucide-react'
import type { EvaluationInput } from '@/lib/types'

const MONTHS = [
  { value: 1, label: 'Jan' }, { value: 2, label: 'Feb' }, { value: 3, label: 'Mar' },
  { value: 4, label: 'Apr' }, { value: 5, label: 'May' }, { value: 6, label: 'Jun' },
  { value: 7, label: 'Jul' }, { value: 8, label: 'Aug' }, { value: 9, label: 'Sep' },
  { value: 10, label: 'Oct' }, { value: 11, label: 'Nov' }, { value: 12, label: 'Dec' },
]

const GENRES = [
  'Action', 'Comedy', 'Drama', 'Romance', 'Thriller', 'Horror', 'Musical', 'Biopic',
  'Crime', 'Fantasy', 'Social', 'Mystery', 'Adventure', 'Animation', 'Sports', 'War',
]

const GENRE_SCORES: Record<string, { pctDiff: number; label: string; color: string }> = {
  Action: { pctDiff: 33, label: 'Above avg', color: 'text-emerald-400' },
  Comedy: { pctDiff: 24, label: 'Above avg', color: 'text-emerald-400' },
  Drama: { pctDiff: 0, label: 'Around avg', color: 'text-amber-400' },
  Romance: { pctDiff: -5, label: 'Around avg', color: 'text-amber-400' },
  Thriller: { pctDiff: 19, label: 'Above avg', color: 'text-emerald-400' },
  Horror: { pctDiff: -33, label: 'Below avg', color: 'text-white/40' },
  Musical: { pctDiff: -24, label: 'Below avg', color: 'text-white/40' },
  Biopic: { pctDiff: -10, label: 'Around avg', color: 'text-amber-400' },
  Crime: { pctDiff: -14, label: 'Below avg', color: 'text-white/40' },
  Fantasy: { pctDiff: 5, label: 'Around avg', color: 'text-amber-400' },
  Social: { pctDiff: -19, label: 'Below avg', color: 'text-white/40' },
  Mystery: { pctDiff: 0, label: 'Around avg', color: 'text-amber-400' },
  Adventure: { pctDiff: 14, label: 'Above avg', color: 'text-emerald-400' },
  Animation: { pctDiff: 29, label: 'Above avg', color: 'text-emerald-400' },
  Sports: { pctDiff: 10, label: 'Above avg', color: 'text-emerald-400' },
  War: { pctDiff: -29, label: 'Below avg', color: 'text-white/40' },
}

const TIERS = [
  { label: 'S', desc: 'Megastar', pctDiff: 40, sampleCount: 18, rankRange: '90\u2013100' },
  { label: 'A', desc: 'Top Tier', pctDiff: 7, sampleCount: 64, rankRange: '70\u201389' },
  { label: 'B', desc: 'Established', pctDiff: -23, sampleCount: 148, rankRange: '40\u201369' },
  { label: 'C', desc: 'Rising', pctDiff: -45, sampleCount: 196, rankRange: '20\u201339' },
  { label: 'D', desc: 'Newcomer', pctDiff: -60, sampleCount: 134, rankRange: '0\u201319' },
]

const BUDGET_BANDS = [
  { min: 0, max: 15, label: 'Low Budget', color: 'text-white/40' },
  { min: 15, max: 40, label: 'Medium Budget', color: 'text-amber-400' },
  { min: 40, max: 80, label: 'High Budget', color: 'text-emerald-400' },
  { min: 80, max: Infinity, label: 'Big Budget', color: 'text-emerald-400' },
]

const GENRE_BUDGET_RANGES: Record<string, { min: number; max: number }> = {
  Action: { min: 30, max: 100 }, Comedy: { min: 15, max: 60 }, Drama: { min: 10, max: 40 },
  Romance: { min: 10, max: 50 }, Thriller: { min: 15, max: 60 }, Horror: { min: 5, max: 25 },
  Musical: { min: 15, max: 50 }, Biopic: { min: 15, max: 60 }, Crime: { min: 10, max: 40 },
  Fantasy: { min: 40, max: 120 }, Social: { min: 8, max: 30 }, Mystery: { min: 10, max: 40 },
  Adventure: { min: 30, max: 100 }, Animation: { min: 40, max: 120 }, Sports: { min: 20, max: 80 },
  War: { min: 30, max: 80 },
}

const PRODUCTION_HOUSES = [
  '', 'Yash Raj Films', 'Dharma Productions', 'T-Series', 'Red Chillies Entertainment',
  'Maddock Films', 'Excel Entertainment', 'RSVP Movies', 'Viacom18 Studios',
  'PVR Pictures', 'Zee Studios', 'Pen Movies', 'Eros International',
  'Sony Pictures Networks', 'Fox Star Studios', 'Disney India',
  'UTV Motion Pictures', 'Balaji Motion Pictures', 'Tips Industries',
  'Lavender Films', 'Cine1 Studios', 'Nadiadwala Grandson',
]

const BUDGET_PROD_PCT = 0.60
const BUDGET_PA_PCT = 0.25
const BUDGET_CONTINGENCY = 10
const BUDGET_FINANCE_PCT = 0.05
const THEATRICAL_PCT = 40

const PRESALE_PCT: Record<string, number> = {
  ott: 0.50, satellite: 0.12, music: 0.15, overseas: 0.18, brand: 0.05,
}

const STEP_LABELS = ['Project', 'Concept', 'Talent', 'Finance', 'Release']

function r1(v: number) { return Math.round(v * 10) / 10 }

function defaultInput(): EvaluationInput {
  const budget = 30
  return {
    filmTitle: '', primaryGenre: 'Drama', secondaryGenre: '', sequelFlag: false,
    logline: '', conceptClarity: 6, novelty: 5,
    director: '', leadActor1: '', directorTier: 'C', actorTier: 'C',
    productionHouse: '',
    totalBudgetCr: budget,
    productionBudgetCr: r1(budget * BUDGET_PROD_PCT),
    pAndABudgetCr: r1(budget * BUDGET_PA_PCT),
    contingencyPercent: BUDGET_CONTINGENCY,
    financingCostCr: r1(budget * BUDGET_FINANCE_PCT),
    ottRightsCr: 0, satelliteRightsCr: 0, musicRightsCr: 0, overseasRightsCr: 0, brandRevenueCr: 0,
    theatricalSharePercent: THEATRICAL_PCT,
    marketTiming: 'neutral', releaseMonth: 6,
  }
}

export function EvaluateForm({ onSubmit, loading, initialInput }: {
  onSubmit: (input: EvaluationInput) => void
  loading: boolean
  initialInput?: EvaluationInput
}) {
  const STORAGE_KEY = 'greenlit-evaluate-form'
  const [step, setStep] = useState(() => {
    if (typeof window === 'undefined') return 0
    const saved = sessionStorage.getItem(STORAGE_KEY)
    if (!saved) return 0
    try {
      const parsed = JSON.parse(saved)
      return parsed.step ?? 0
    } catch { return 0 }
  })
  const [input, setInput] = useState<EvaluationInput>(() => {
    if (typeof window === 'undefined') return initialInput ?? defaultInput()
    const saved = sessionStorage.getItem(STORAGE_KEY)
    if (!saved) return initialInput ?? defaultInput()
    try {
      const parsed = JSON.parse(saved)
      return parsed.input ? { ...defaultInput(), ...parsed.input } : (initialInput ?? defaultInput())
    } catch { return initialInput ?? defaultInput() }
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ step, input }))
    } catch { /* storage full or unavailable */ }
  }, [step, input])
  const [budgetExpanded, setBudgetExpanded] = useState(false)
  const [preSalesExpanded, setPreSalesExpanded] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const totalSteps = 5
  const isLastStep = step === 4

  function validateStep(s: number): boolean {
    const next: Record<string, string> = {}
    if (s === 0) {
      if (!input.filmTitle.trim()) next.filmTitle = 'Film title is required'
    }
    if (s === 2) {
      if (!input.director.trim()) next.director = 'Director name is required'
      if (!input.leadActor1.trim()) next.leadActor1 = 'Lead actor name is required'
    }
    if (s === 3) {
      if (input.totalBudgetCr <= 0) next.totalBudgetCr = 'Total budget must be greater than 0'
      if (input.productionBudgetCr <= 0) next.productionBudgetCr = 'Production budget must be greater than 0'
    }
    if (s === 4) {
      if (!input.filmTitle.trim()) next.filmTitle = 'Film title is required'
      if (!input.director.trim()) next.director = 'Director name is required'
      if (!input.leadActor1.trim()) next.leadActor1 = 'Lead actor name is required'
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  function clearError(key: string) {
    setErrors(prev => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  const totalPreSales = useMemo(() => r1(
    input.ottRightsCr + input.satelliteRightsCr + input.musicRightsCr +
    input.overseasRightsCr + input.brandRevenueCr
  ), [input.ottRightsCr, input.satelliteRightsCr, input.musicRightsCr, input.overseasRightsCr, input.brandRevenueCr])

  const coveragePct = input.totalBudgetCr > 0
    ? Math.round((totalPreSales / input.totalBudgetCr) * 100)
    : 0

  useEffect(() => {
    if (step === 0 && inputRef.current) inputRef.current.focus()
    else if (step === 1 && textareaRef.current) textareaRef.current.focus()
  }, [step])

  function update<K extends keyof EvaluationInput>(key: K, value: EvaluationInput[K]) {
    setInput(prev => ({ ...prev, [key]: value }))
    clearError(key)
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
  }

  function handleTotalPreSales(value: number) {
    if (!preSalesExpanded) {
      const next = { ...input }
      next.ottRightsCr = r1(value * PRESALE_PCT.ott)
      next.satelliteRightsCr = r1(value * PRESALE_PCT.satellite)
      next.musicRightsCr = r1(value * PRESALE_PCT.music)
      next.overseasRightsCr = r1(value * PRESALE_PCT.overseas)
      next.brandRevenueCr = r1(value * PRESALE_PCT.brand)
      setInput(next)
    }
  }

  function handleRightsField(key: 'ottRightsCr' | 'satelliteRightsCr' | 'musicRightsCr' | 'overseasRightsCr' | 'brandRevenueCr', value: number) {
    setInput(prev => ({ ...prev, [key]: value }))
  }

  function toggleBudgetExpand() {
    if (budgetExpanded) {
      setBudgetExpanded(false)
      const v = input.totalBudgetCr
      setInput(prev => ({
        ...prev,
        productionBudgetCr: r1(v * BUDGET_PROD_PCT),
        pAndABudgetCr: r1(v * BUDGET_PA_PCT),
        contingencyPercent: BUDGET_CONTINGENCY,
        financingCostCr: r1(v * BUDGET_FINANCE_PCT),
      }))
    } else {
      setBudgetExpanded(true)
    }
  }

  function togglePreSalesExpand() {
    if (preSalesExpanded) {
      setPreSalesExpanded(false)
      const t = totalPreSales
      setInput(prev => ({
        ...prev,
        ottRightsCr: r1(t * PRESALE_PCT.ott),
        satelliteRightsCr: r1(t * PRESALE_PCT.satellite),
        musicRightsCr: r1(t * PRESALE_PCT.music),
        overseasRightsCr: r1(t * PRESALE_PCT.overseas),
        brandRevenueCr: r1(t * PRESALE_PCT.brand),
      }))
    } else {
      setPreSalesExpanded(true)
    }
  }

  function goNext() {
    const currentStep = isLastStep ? 4 : step
    if (!validateStep(currentStep)) return
    if (isLastStep) {
      try { sessionStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
      onSubmit(input)
      return
    }
    setStep(s => s + 1)
    setErrors({})
  }

  function goBack() {
    if (step <= 0) return
    setStep(s => s - 1)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      goNext()
    }
  }

  const band = BUDGET_BANDS.find(b => input.totalBudgetCr >= b.min && input.totalBudgetCr < b.max)
  const genreRange = GENRE_BUDGET_RANGES[input.primaryGenre]

  const marketOpts = useMemo(() => [
    { value: 'strong' as const, label: 'Strong', desc: '×1.15 · Holiday or high-demand' },
    { value: 'neutral' as const, label: 'Neutral', desc: '×1.00 · Average conditions' },
    { value: 'weak' as const, label: 'Weak', desc: '×0.90 · Crowded or low-demand' },
  ], [])

  return (
    <div className="relative w-full">
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {loading ? 'Evaluating your film project...' : ''}
      </div>
      <div className="fixed top-14 left-0 right-0 z-40">
        <div className="h-1 bg-zinc-900">
          <div
            className="h-full rounded-r-full bg-gradient-to-r from-amber-500 via-emerald-500 to-emerald-400 transition-all duration-500 ease-out"
            style={{ width: `${Math.max(((step + 1) / totalSteps) * 100, 5)}%` }}
          />
        </div>
      </div>

      <div className="relative mx-auto max-w-lg pt-16 pb-8">
        <div key={step} className="animate-step-in">
          <div className="mb-5 flex items-center gap-2 text-xs text-white/40">
            <span>{STEP_LABELS[step]}</span>
            <span className="text-white/20">&middot;</span>
            <span>Step {step + 1} of {totalSteps}</span>
          </div>

          <div className="rounded-2xl border border-white/5 bg-zinc-900/30 p-6 backdrop-blur-sm transition-all duration-300 hover:border-white/10">
            {step === 0 && <ProjectStep input={input} update={update} ref={inputRef} onKeyDown={handleKeyDown} errors={errors} />}
            {step === 1 && <ConceptStep input={input} update={update} ref={textareaRef} />}
            {step === 2 && <TalentStep input={input} update={update} errors={errors} />}
            {step === 3 && (
              <FinanceStep
                input={input}
                totalPreSales={totalPreSales}
                coveragePct={coveragePct}
                budgetExpanded={budgetExpanded}
                preSalesExpanded={preSalesExpanded}
                band={band}
                genreRange={genreRange}
                onTotalBudget={handleTotalBudget}
                onTotalPreSales={handleTotalPreSales}
                onRightsField={handleRightsField}
                onToggleBudget={toggleBudgetExpand}
                onTogglePreSales={togglePreSalesExpand}
                update={update}
              />
            )}
            {step === 4 && (
              <ReleaseStep
                input={input}
                update={update}
                marketOpts={marketOpts}
              />
            )}

            <div className="mt-4 space-y-1 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
              <p className="text-[10px] text-white/20 leading-relaxed">
                Reference values shown vs dataset median (gross multiple) or genre average.
                Only ~30% of films report financials \u2014 dataset avg 2.72\u00d7 vs real ~1.0\u00d7 (survivorship bias).
              </p>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between">
            {step > 0 ? (
              <button
                type="button"
                onClick={goBack}
                className="group flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm text-white/40 transition-all duration-200 hover:text-white/70 hover:bg-white/5 active:scale-95"
              >
                <ChevronLeft className="size-4 transition-transform group-hover:-translate-x-1" />
                Back
              </button>
            ) : (
              <div />
            )}

            <Button
              size="lg"
              onClick={goNext}
              disabled={loading}
              className={`rounded-full px-8 text-sm transition-all duration-300 ${
                isLastStep
                  ? 'bg-gradient-to-r from-amber-500 to-emerald-500 text-white shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 hover:scale-105 active:scale-95'
                  : 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 hover:scale-105 active:scale-95'
              }`}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" />
                  Analyzing...
                </span>
              ) : isLastStep ? (
                <>
                  <Sparkles className="size-4" />
                  Run Analysis
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="ml-1 size-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ───────── Step 1: Project ───────── */
const ProjectStep = forwardRef<HTMLInputElement, {
  input: EvaluationInput
  update: (key: keyof EvaluationInput, value: string | number | boolean) => void
  onKeyDown: (e: React.KeyboardEvent) => void
  errors?: Record<string, string>
}>(function ProjectStep({ input, update, onKeyDown, errors }, ref) {
  return (
    <div>
      <h2 className="text-xl font-medium text-white">
        Project <span className="font-serif-accent">Details</span>
      </h2>
      <p className="mt-1 text-sm text-white/40">Working title, genre, and franchise status</p>

      <div className="relative mt-4">
        <Input
          ref={ref}
          value={input.filmTitle}
          onChange={e => update('filmTitle', e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Film title"
          className={`h-12 pl-4 text-base ${errors?.filmTitle ? 'border-red-500/60 ring-1 ring-red-500/20' : ''}`}
        />
        {errors?.filmTitle && (
          <p className="mt-1 text-[11px] text-red-400">{errors.filmTitle}</p>
        )}
      </div>

      <p className="mt-5 mb-2 text-xs text-white/50">Primary Genre</p>
      <div className="grid grid-cols-4 gap-2">
        {GENRES.map(g => {
          const active = input.primaryGenre === g
          const gs = GENRE_SCORES[g]!
          return (
            <button
              key={g}
              type="button"
              onClick={() => update('primaryGenre', g)}
              className={`group relative flex flex-col items-center gap-0.5 rounded-xl border px-1 py-2.5 text-center text-xs transition-all duration-300 ${
                active
                  ? 'border-amber-400/50 bg-gradient-to-br from-amber-500/10 to-amber-600/5 text-amber-400 shadow-lg shadow-amber-500/10 ring-2 ring-amber-400/30'
                  : 'border-white/5 bg-zinc-900/50 text-white/50 hover:border-amber-500/20 hover:text-white/70'
              }`}
            >
              <span className="font-medium">{g}</span>
              <span className={`${gs.color} text-[9px]`}>
                {gs.pctDiff > 0 ? `+${gs.pctDiff}%` : gs.pctDiff === 0 ? '0%' : `${gs.pctDiff}%`}
              </span>
            </button>
          )
        })}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-xs text-white/50">Sub-genre (optional)</Label>
          <Select value={input.secondaryGenre} onValueChange={v => update('secondaryGenre', v ?? '')}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">None</SelectItem>
              {GENRES.map(g => (
                <SelectItem key={g} value={g}>{g}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-white/50">Franchise</Label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => update('sequelFlag', false)}
              className={`flex-1 rounded-lg border py-2 text-xs font-medium transition-all duration-200 ${
                !input.sequelFlag
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20'
                  : 'border-white/5 bg-zinc-900/50 text-white/40 hover:border-white/20 hover:text-white/60'
              }`}
            >
              Original
            </button>
            <button
              type="button"
              onClick={() => update('sequelFlag', true)}
              className={`flex-1 rounded-lg border py-2 text-xs font-medium transition-all duration-200 ${
                input.sequelFlag
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20'
                  : 'border-white/5 bg-zinc-900/50 text-white/40 hover:border-white/20 hover:text-white/60'
              }`}
            >
              Sequel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
})

/* ───────── Step 2: Concept ───────── */
const ConceptStep = forwardRef<HTMLTextAreaElement, {
  input: EvaluationInput
  update: (key: keyof EvaluationInput, value: string | number | boolean) => void
}>(function ConceptStep({ input, update }, ref) {
  return (
    <div>
      <h2 className="text-xl font-medium text-white">
        Concept <span className="font-serif-accent">Evaluation</span>
      </h2>
      <p className="mt-1 text-sm text-white/40">Premise, clarity, and originality (logline optional)</p>

      <div className="relative mt-4">
        <Textarea
          ref={ref}
          value={input.logline}
          onChange={e => update('logline', e.target.value)}
          placeholder="2-3 sentences describing the premise and audience hook (optional)"
          rows={3}
          className="text-sm"
        />
        <p className="mt-1 text-right text-[10px] text-white/20">{input.logline.length} characters</p>
      </div>

      <div className="mt-6 space-y-6">
        <div className="group/sliderblock">
          <div className="flex items-center justify-between">
            <Label className="text-sm text-white/60">Concept Clarity</Label>
            <span className="inline-flex items-center justify-center rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
              {input.conceptClarity}/10
            </span>
          </div>
          <Slider
            min={1} max={10}
            value={[input.conceptClarity]}
            onValueChange={v => update('conceptClarity', Array.isArray(v) ? v[0] : v)}
            className="mt-2"
          />
          <div className="mt-1 flex justify-between text-[10px] text-white/20">
            <span>Vague</span>
            <span>Moderate</span>
            <span>Crystal</span>
          </div>
        </div>

        <div className="group/sliderblock">
          <div className="flex items-center justify-between">
            <Label className="text-sm text-white/60">Originality</Label>
            <span className="inline-flex items-center justify-center rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
              {input.novelty}/10
            </span>
          </div>
          <Slider
            min={1} max={10}
            value={[input.novelty]}
            onValueChange={v => update('novelty', Array.isArray(v) ? v[0] : v)}
            className="mt-2"
          />
          <div className="mt-1 flex justify-between text-[10px] text-white/20">
            <span>Formulaic</span>
            <span>Fresh</span>
            <span>Breakthrough</span>
          </div>
        </div>
      </div>
    </div>
  )
})

/* ───────── Step 3: Talent ───────── */
function TalentStep({ input, update, errors }: {
  input: EvaluationInput
  update: (key: keyof EvaluationInput, value: string | number | boolean) => void
  errors?: Record<string, string>
}) {
  return (
    <div>
      <h2 className="text-xl font-medium text-white">
        Cast &amp; <span className="font-serif-accent">Talent</span>
      </h2>
      <p className="mt-1 text-sm text-white/40">Attached director and lead actor</p>

      <div className="mt-5 grid grid-cols-2 gap-5">
        <div className="space-y-3">
          <Label className="text-xs text-white/50">Director</Label>
          <Input
            value={input.director}
            onChange={e => update('director', e.target.value)}
            placeholder="Name"
            className={errors?.director ? 'border-red-500/60 ring-1 ring-red-500/20' : ''}
          />
          {errors?.director && (
            <p className="text-[11px] text-red-400">{errors.director}</p>
          )}
          <p className="text-[10px] text-white/25">Director has more predictive power than lead actor</p>
          <div className="flex flex-wrap gap-1">
            {TIERS.map(t => (
              <button
                key={t.label}
                type="button"
                onClick={() => update('directorTier', t.label)}
                className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-medium whitespace-nowrap transition-all duration-200 ${
                  input.directorTier === t.label
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400 shadow-sm shadow-emerald-500/10'
                    : 'border-white/5 bg-zinc-900/50 text-white/40 hover:border-white/20 hover:text-white/60'
                }`}
              >
                <span>{t.label}</span>
                <span className="text-[9px] text-white/30">{t.pctDiff > 0 ? `+${t.pctDiff}%` : `${t.pctDiff}%`}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <Label className="text-xs text-white/50">Lead Actor</Label>
          <Input
            value={input.leadActor1}
            onChange={e => update('leadActor1', e.target.value)}
            placeholder="Name"
            className={errors?.leadActor1 ? 'border-red-500/60 ring-1 ring-red-500/20' : ''}
          />
          {errors?.leadActor1 && (
            <p className="text-[11px] text-red-400">{errors.leadActor1}</p>
          )}
          <p className="text-[10px] text-white/25">Tier data from 560+ film dataset</p>
          <div className="flex flex-wrap gap-1">
            {TIERS.map(t => (
              <button
                key={t.label}
                type="button"
                onClick={() => update('actorTier', t.label)}
                className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-medium whitespace-nowrap transition-all duration-200 ${
                  input.actorTier === t.label
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400 shadow-sm shadow-emerald-500/10'
                    : 'border-white/5 bg-zinc-900/50 text-white/40 hover:border-white/20 hover:text-white/60'
                }`}
              >
                <span>{t.label}</span>
                <span className="text-[9px] text-white/30">{t.pctDiff > 0 ? `+${t.pctDiff}%` : `${t.pctDiff}%`}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ───────── Step 4: Finance ───────── */
function FinanceStep({
  input, totalPreSales, coveragePct, budgetExpanded, preSalesExpanded, band, genreRange,
  onTotalBudget, onTotalPreSales, onRightsField, onToggleBudget, onTogglePreSales, update,
}: {
  input: EvaluationInput
  totalPreSales: number
  coveragePct: number
  budgetExpanded: boolean
  preSalesExpanded: boolean
  band: { label: string; color: string } | undefined
  genreRange: { min: number; max: number } | undefined
  onTotalBudget: (v: number) => void
  onTotalPreSales: (v: number) => void
  onRightsField: (k: 'ottRightsCr' | 'satelliteRightsCr' | 'musicRightsCr' | 'overseasRightsCr' | 'brandRevenueCr', v: number) => void
  onToggleBudget: () => void
  onTogglePreSales: () => void
  update: (key: keyof EvaluationInput, value: string | number | boolean) => void
}) {
  const budgetPct = (v: number) => input.totalBudgetCr > 0 ? Math.round((v / input.totalBudgetCr) * 100) : 0

  const rightsLabels: { key: 'ottRightsCr' | 'satelliteRightsCr' | 'musicRightsCr' | 'overseasRightsCr' | 'brandRevenueCr'; label: string; hint: string; pct: number }[] = [
    { key: 'ottRightsCr', label: 'OTT / Digital', hint: '40\u201360% of budget', pct: 50 },
    { key: 'satelliteRightsCr', label: 'Satellite', hint: '~10% of budget', pct: 12 },
    { key: 'musicRightsCr', label: 'Music', hint: '10\u201320% of budget', pct: 15 },
    { key: 'overseasRightsCr', label: 'Overseas', hint: '10\u201325% of budget', pct: 18 },
    { key: 'brandRevenueCr', label: 'Brand', hint: '5\u201315% of budget', pct: 5 },
  ]

  return (
    <div>
      <h2 className="text-xl font-medium text-white">
        <span className="font-serif-accent">Financial</span> Plan
      </h2>
      <p className="mt-1 text-sm text-white/40">Total budget and pre-sold rights coverage</p>

      {/* Budget */}
      <div className="mt-5">
        <div className="flex items-end gap-3">
          <div className="flex-1 space-y-1.5">
            <Label className="text-xs text-white/50">Total Budget (₹ Cr)</Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-white/30">₹</span>
              <Input
                type="number" min={0} step={0.5}
                value={input.totalBudgetCr}
                onChange={e => onTotalBudget(parseFloat(e.target.value) || 0)}
                className="pl-7 h-12 text-base"
              />
            </div>
          </div>
          <div className="pb-1">
            <span className={`text-xs font-medium ${band?.color || 'text-white/40'}`}>{band?.label || '\u2014'}</span>
            {genreRange && (
              <p className="text-[10px] text-white/25">Typical: ₹{genreRange.min}\u2013₹{genreRange.max}Cr</p>
            )}
          </div>
        </div>

        {/* Budget waterfall */}
        {input.totalBudgetCr > 0 && (
          <div className="mt-4 rounded-xl border border-white/5 bg-zinc-900/30 p-3.5">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[10px] text-white/30 uppercase tracking-wider">Allocation</span>
              <button
                type="button"
                onClick={onToggleBudget}
                className="flex items-center gap-1 text-[10px] text-white/30 hover:text-white/50"
              >
                {budgetExpanded ? 'Auto-calc' : 'Customize'}
                <ChevronDown className={`size-3 transition-transform ${budgetExpanded ? 'rotate-180' : ''}`} />
              </button>
            </div>

            <div className="flex h-3 gap-0.5 overflow-hidden rounded-full">
              <div className="bg-emerald-600 transition-all duration-500" style={{ width: `${budgetPct(input.productionBudgetCr)}%` }} title="Production" />
              <div className="bg-amber-600 transition-all duration-500" style={{ width: `${budgetPct(input.pAndABudgetCr)}%` }} title="P&amp;A" />
              <div className="bg-red-600 transition-all duration-500" style={{ width: `${Math.min(input.contingencyPercent, 100)}%` }} title="Contingency" />
              <div className="bg-blue-600 transition-all duration-500" style={{ width: `${budgetPct(input.financingCostCr)}%` }} title="Financing" />
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px]">
              <span className="flex items-center gap-1 text-emerald-400"><span className="size-1.5 rounded-full bg-emerald-500" /> Production {budgetPct(input.productionBudgetCr)}%</span>
              <span className="flex items-center gap-1 text-amber-400"><span className="size-1.5 rounded-full bg-amber-500" /> P&amp;A {budgetPct(input.pAndABudgetCr)}%</span>
              <span className="flex items-center gap-1 text-red-400"><span className="size-1.5 rounded-full bg-red-500" /> Contingency {input.contingencyPercent}%</span>
              <span className="flex items-center gap-1 text-blue-400"><span className="size-1.5 rounded-full bg-blue-500" /> Financing {budgetPct(input.financingCostCr)}%</span>
            </div>

            {budgetExpanded && (
              <div className="mt-4 grid grid-cols-2 gap-3 pt-3 border-t border-white/5">
                <div className="space-y-1.5">
                  <Label className="text-[10px] text-white/40">Production (₹ Cr)</Label>
                  <Input type="number" min={0} step={0.5} value={input.productionBudgetCr}
                    onChange={e => update('productionBudgetCr', parseFloat(e.target.value) || 0)}
                    className="h-8 text-xs" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] text-white/40">P&amp;A (₹ Cr)</Label>
                  <Input type="number" min={0} step={0.5} value={input.pAndABudgetCr}
                    onChange={e => update('pAndABudgetCr', parseFloat(e.target.value) || 0)}
                    className="h-8 text-xs" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] text-white/40">Contingency (%)</Label>
                  <Input type="number" min={0} max={25} step={0.5} value={input.contingencyPercent}
                    onChange={e => update('contingencyPercent', parseFloat(e.target.value) || 0)}
                    className="h-8 text-xs" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] text-white/40">Financing Cost (₹ Cr)</Label>
                  <Input type="number" min={0} step={0.1} value={input.financingCostCr}
                    onChange={e => update('financingCostCr', parseFloat(e.target.value) || 0)}
                    className="h-8 text-xs" />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Pre-Sales */}
      <div className="mt-5">
        <div className="flex-1 space-y-1.5">
          <Label className="text-xs text-white/50">Total Pre-Sold Revenue (₹ Cr)</Label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-white/30">₹</span>
            <Input
              type="number" min={0} step={0.5}
              value={totalPreSales}
              onChange={e => onTotalPreSales(parseFloat(e.target.value) || 0)}
              disabled={preSalesExpanded}
              className="pl-7 h-12 text-base disabled:opacity-50"
            />
          </div>
        </div>

        {input.totalBudgetCr > 0 && (
          <div className="mt-3 rounded-xl border border-white/5 bg-zinc-900/30 p-3.5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-white/30 uppercase tracking-wider">Coverage</span>
              <button
                type="button"
                onClick={onTogglePreSales}
                className="flex items-center gap-1 text-[10px] text-white/30 hover:text-white/50"
              >
                {preSalesExpanded ? 'Auto-split' : 'Breakdown'}
                <ChevronDown className={`size-3 transition-transform ${preSalesExpanded ? 'rotate-180' : ''}`} />
              </button>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-white/60">{coveragePct}% of budget</span>
              <span className={
                coveragePct < 50 ? 'text-amber-400' : coveragePct < 100 ? 'text-emerald-400' : 'text-emerald-300'
              }>
                {coveragePct < 50 ? 'Below market range' : coveragePct < 100 ? 'Within range' : 'Above range'}
              </span>
            </div>
            <div className="mt-1.5 h-2 w-full rounded-full bg-white/5">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${
                  coveragePct < 50 ? 'from-amber-600 to-amber-400' : 'from-emerald-600 to-emerald-400'
                } transition-all duration-500`}
                style={{ width: `${Math.min(coveragePct, 100)}%` }}
              />
            </div>
            <p className="mt-1 text-[10px] text-white/25">Market: OTT 40\u201360% · Sat ~10% · Music 10\u201320% · OS 10\u201325% · Brand 5\u201315%</p>

            {preSalesExpanded && (
              <div className="mt-4 grid grid-cols-2 gap-3 pt-3 border-t border-white/5">
                {rightsLabels.map(r => {
                  const val = input[r.key]
                  const pct = input.totalBudgetCr > 0 ? Math.round((val / input.totalBudgetCr) * 100) : 0
                  return (
                    <div key={r.key} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label className="text-[10px] text-white/40">{r.label}</Label>
                        <span className="text-[9px] text-white/25">{pct}%</span>
                      </div>
                      <Input type="number" min={0} step={0.5} value={val}
                        onChange={e => onRightsField(r.key, parseFloat(e.target.value) || 0)}
                        className="h-8 text-xs" />
                      <p className="text-[9px] text-white/25">{r.hint}</p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ───────── Step 5: Release ───────── */
function ReleaseStep({ input, update, marketOpts }: {
  input: EvaluationInput
  update: (key: keyof EvaluationInput, value: string | number | boolean) => void
  marketOpts: readonly { readonly value: 'strong' | 'neutral' | 'weak'; readonly label: string; readonly desc: string }[]
}) {
  return (
    <div>
      <h2 className="text-xl font-medium text-white">
        Release &amp; <span className="font-serif-accent">Distribution</span>
      </h2>
      <p className="mt-1 text-sm text-white/40">Release timing, market window, and production house</p>

      <div className="mt-5 space-y-2">
        <Label className="text-xs text-white/50">Release Month</Label>
        <div className="grid grid-cols-4 gap-1.5">
          {MONTHS.map(m => {
            const active = input.releaseMonth === m.value
            return (
              <button
                key={m.value}
                type="button"
                onClick={() => update('releaseMonth', m.value)}
                className={`rounded-lg border py-1.5 text-[10px] transition-all duration-200 ${
                  active
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20'
                    : 'border-white/5 bg-zinc-900/50 text-white/40 hover:border-white/20 hover:text-white/60'
                }`}
              >
                {m.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-5 space-y-2">
        <Label className="text-xs text-white/50">Market Window</Label>
        <div className="flex flex-col gap-1.5">
          {marketOpts.map(opt => {
            const active = input.marketTiming === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => update('marketTiming', opt.value)}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-xs transition-all duration-200 ${
                  active
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20'
                    : 'border-white/5 bg-zinc-900/50 text-white/50 hover:border-white/20 hover:text-white/70'
                }`}
              >
                <span className="font-medium">{opt.label}</span>
                <span className="text-[10px] text-white/30">{opt.desc}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-5 space-y-2">
        <Label className="text-xs text-white/50">Production House (optional)</Label>
        <Select value={input.productionHouse} onValueChange={v => update('productionHouse', v ?? '')}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select or skip" />
          </SelectTrigger>
          <SelectContent>
            {PRODUCTION_HOUSES.map(h => (
              <SelectItem key={h} value={h}>{h || 'None / Independent'}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
