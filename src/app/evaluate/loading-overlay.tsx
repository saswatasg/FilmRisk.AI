'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { Loader2, CheckCircle2, Circle } from 'lucide-react'

type StepStatus = 'pending' | 'active' | 'done'

interface Step {
  id: string
  label: string
  detail: string
}

interface Phase {
  id: string
  label: string
  steps: Step[]
}

const PHASES: Phase[] = [
  {
    id: 'dataset',
    label: 'Dataset Pipeline',
    steps: [
      { id: 'load', label: 'Loading film database', detail: '729 records spanning 2015\u20132025' },
      { id: 'parse', label: 'Parsing financial records', detail: 'Budget, box office, talent, genre' },
      { id: 'genre', label: 'Computing genre distributions', detail: 'Average gross multiples per genre' },
      { id: 'budget', label: 'Computing budget band stats', detail: 'Break-even rates by budget range' },
    ],
  },
  {
    id: 'scoring',
    label: 'Scoring Engine',
    steps: [
      { id: 'gviability', label: 'Genre Viability', detail: '18 thriller films \u2014 1.42x break-even avg' },
      { id: 'gbfit', label: 'Genre-Budget Fit', detail: '5 genre+budget combos \u2014 0.52x break-even' },
      { id: 'bfeasibility', label: 'Budget Feasibility', detail: '76 films in 30-60Cr band \u2014 0.79x break-even' },
      { id: 'tstrength', label: 'Talent Strength', detail: 'Director A + Actor D \u2014 weighted composite' },
      { id: 'psales', label: 'Pre-Sale Coverage', detail: 'Computing coverage ratio vs market ranges' },
      { id: 'season', label: 'Seasonality Impact', detail: '99 June releases \u2014 0.62x break-even avg' },
    ],
  },
  {
    id: 'ml',
    label: 'ML Inference',
    steps: [
      { id: 'gbm', label: 'GBM ensemble model', detail: '9-feature gradient boosted regression' },
      { id: 'bayes', label: 'Bayesian shrinkage', detail: 'Empirical Bayes toward prior means' },
      { id: 'blend', label: 'Score blending', detail: '60% component-based / 40% ML prediction' },
    ],
  },
  {
    id: 'risk',
    label: 'Risk Simulation',
    steps: [
      { id: 'mc', label: 'Monte Carlo path simulation', detail: '10,000 lognormal paths \u2014 sigma from sample size' },
      { id: 'sensi', label: 'Sensitivity analysis', detail: 'Top-5 score levers identified' },
      { id: 'factors', label: 'Risk factor diagnosis', detail: 'Weighted severity scoring across 10 dimensions' },
    ],
  },
  {
    id: 'report',
    label: 'Report',
    steps: [
      { id: 'compile', label: 'Compiling investment report', detail: 'Finalizing greenlight score, projections, and recommendations' },
    ],
  },
]

const DALITS = [
  'Dataset survivorship bias: 70% of films missing financial data \u2014 real market avg ~1.0x vs dataset 2.72x',
  'Historical Bollywood break-even rate across all budget bands: ~58%',
  'OTT rights now account for 40\u201360% of total pre-sale value (up from <20% pre-2018)',
  'Director track record predicts greenlight outcomes 1.4x better than lead actor alone',
  'Non-star-driven films claimed 3 of top 10 box office spots in 2025',
  'Week 1 multiplex split: ~41% to distributor after GST',
  'Satellite rights collapsed to ~10% of budget (down from 30\u201350% pre-pandemic)',
  'Genre-budget fit is the single most predictive component for films under \u20B950Cr',
  'Walk-forward validation: model tested on 619 films across 15 annual windows',
]

export function LoadingOverlay({ onComplete }: { onComplete: () => void }) {
  const [stepStates, setStepStates] = useState<Record<string, StepStatus>>(
    () => ({ [PHASES[0]!.steps[0]!.id]: 'active' })
  )
  const [progressPct, setProgressPct] = useState(2)
  const [elapsed, setElapsed] = useState(0)
  const [dalitIdx, setDalitIdx] = useState(0)
  const [estimatedTotal] = useState(() => 14000 + Math.random() * 11000)

  const allSteps = useMemo(() => PHASES.flatMap(p => p.steps), [])
  const totalSteps = allSteps.length
  const completedRef = useRef(0)

  useEffect(() => {
    completedRef.current = 0
    const startTime = Date.now()
    const stepInterval = estimatedTotal / totalSteps

    const dalitTimer = setInterval(() => {
      setDalitIdx(i => (i + 1) % DALITS.length)
    }, 6000)

    const interval = setInterval(() => {
      const idx = completedRef.current
      if (idx >= totalSteps) {
        const remaining = estimatedTotal - (Date.now() - startTime)
        setTimeout(() => {
          clearInterval(dalitTimer)
          onComplete()
        }, Math.max(remaining, 400))
        clearInterval(interval)
        return
      }

      const step = allSteps[idx]
      if (!step) { clearInterval(interval); return }

      setStepStates(prev => {
        const next = { ...prev }
        if (idx === 0) {
          next[step.id] = 'active'
        } else {
          const prevStep = allSteps[idx - 1]
          if (prevStep) next[prevStep.id] = 'done'
          next[step.id] = 'active'
        }
        return next
      })

      setProgressPct(Math.round(((idx) / totalSteps) * 100))
      setElapsed(Date.now() - startTime)
      completedRef.current++
    }, stepInterval)

    return () => { clearInterval(interval); clearInterval(dalitTimer) }
  }, [onComplete, allSteps, totalSteps])

  function getPhaseState(pi: number): 'future' | 'active' | 'past' {
    const completedCount = Object.values(stepStates).filter(s => s === 'done').length
    const activeStepId = Object.entries(stepStates).find(([, s]) => s === 'active')?.[0]

    let cumulative = 0
    for (let i = 0; i < PHASES.length; i++) {
      const phase = PHASES[i]
      if (!phase) continue
      const phaseSteps = phase.steps.map(s => s.id)
      if (i < pi) cumulative += phase.steps.length
      if (i === pi) {
        if (completedCount >= cumulative + phaseSteps.length) return 'past'
        if (phaseSteps.includes(activeStepId ?? '') || completedCount >= cumulative) return 'active'
        return 'future'
      }
    }
    return 'future'
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm">
      <div className="w-full max-w-lg px-6">
        <div className="mb-8 text-center">
          <h2 className="text-lg font-semibold text-white/90">Analyzing Project</h2>
          <p className="mt-1 text-xs text-white/30">
            {totalSteps} analysis steps &middot; {(elapsed / 1000).toFixed(1)}s elapsed
            {estimatedTotal > 0 && <span> &middot; target ~{(estimatedTotal / 1000).toFixed(0)}s</span>}
          </p>
        </div>

        <div className="space-y-4">
          {PHASES.map((phase, pi) => {
            const ps = getPhaseState(pi)
            return (
              <div key={phase.id} className={`transition-all duration-500 ${
                ps === 'future' ? 'opacity-20' : ps === 'past' ? 'opacity-60' : 'opacity-100'
              }`}>
                <div className="mb-1.5 flex items-center gap-2">
                  <div className={`relative flex size-2 items-center justify-center transition-all duration-500 ${
                    ps === 'past'
                      ? 'text-emerald-500'
                      : ps === 'active'
                        ? 'text-emerald-400'
                        : 'text-white/20'
                  }`}>
                    <div className={`size-2 rounded-full ${
                      ps === 'past' ? 'bg-emerald-500' : ps === 'active'
                        ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]' : 'bg-white/20'
                    }`} />
                    {ps === 'active' && (
                      <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/30" />
                    )}
                  </div>
                  <span className={`text-[10px] font-semibold uppercase tracking-wider ${
                    ps === 'past' ? 'text-emerald-400/80' : 'text-white/50'
                  }`}>
                    {phase.label}
                  </span>
                  {ps === 'past' && <CheckCircle2 className="size-2.5 text-emerald-500/70" />}
                </div>

                <div className="ml-4 space-y-0.5 border-l border-white/5 pl-3">
                  {phase.steps.map(step => {
                    const status = stepStates[step.id] ?? 'pending'
                    return (
                      <div
                        key={step.id}
                        className={`flex items-center gap-2 py-0.5 transition-all duration-500 ${
                          status === 'active' ? 'translate-x-0.5' : ''
                        }`}
                      >
                        {status === 'done' ? (
                          <CheckCircle2 className="size-3 shrink-0 text-emerald-500/80" />
                        ) : status === 'active' ? (
                          <Loader2 className="size-3 shrink-0 animate-spin text-emerald-400" />
                        ) : (
                          <Circle className="size-3 shrink-0 text-white/8" />
                        )}
                        <span className={`text-xs transition-all duration-300 ${
                          status === 'done' ? 'text-white/50' : status === 'active' ? 'text-white/80' : 'text-white/15'
                        }`}>
                          {step.label}
                        </span>
                        {status === 'active' && (
                          <span className="ml-auto shrink-0 whitespace-nowrap text-[9px] text-white/30">
                            {step.detail}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-8">
          <div className="relative h-1 w-full overflow-hidden rounded-full bg-white/5">
            <div className="absolute inset-0 animate-shimmer" />
            <div
              className="relative h-full rounded-full bg-gradient-to-r from-emerald-700 via-emerald-400 to-emerald-600 transition-all duration-500 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-[9px] text-white/20">
            <span>Initializing</span>
            <span>{progressPct}%</span>
            <span>Finalizing</span>
          </div>
        </div>

        <div className="mt-6 h-10 overflow-hidden rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
          <p className="animate-slide-up text-[9px] leading-relaxed text-white/20" key={dalitIdx}>
            {DALITS[dalitIdx]!}
          </p>
        </div>
      </div>
    </div>
  )
}
