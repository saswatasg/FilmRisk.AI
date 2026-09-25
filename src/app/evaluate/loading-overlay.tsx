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
      { id: 'load', label: 'Loading film database', detail: '2,454 records · 2001–2025' },
      { id: 'parse', label: 'Parsing financial records', detail: 'Budget, box office, talent, genre' },
      { id: 'genre', label: 'Computing genre distributions', detail: 'Average gross multiples per genre' },
      { id: 'budget', label: 'Computing budget band stats', detail: 'Break-even rates by budget range' },
    ],
  },
  {
    id: 'scoring',
    label: 'Scoring Engine',
    steps: [
      { id: 'gviability', label: 'Genre Viability', detail: 'Genre track records vs break-even' },
      { id: 'gbfit', label: 'Genre-Budget Fit', detail: 'Genre and budget interactions' },
      { id: 'bfeasibility', label: 'Budget Feasibility', detail: 'Budget-band recovery rates' },
      { id: 'tstrength', label: 'Talent Strength', detail: 'Director and actor track records' },
      { id: 'psales', label: 'Pre-Sale Coverage', detail: 'Computing coverage ratio vs market ranges' },
      { id: 'season', label: 'Seasonality Impact', detail: 'Release-month recovery rates' },
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
      { id: 'sensi', label: 'Sensitivity analysis', detail: 'Material score levers identified' },
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

const FACTS = [
  'Dataset survivorship bias: 70% of films missing financial data \u2014 real market avg ~1.0x vs dataset median 1.21x',
  'Historical Bollywood break-even rate across all budget bands: ~58%',
  'OTT rights now account for 40\u201360% of total pre-sale value (up from <20% pre-2018)',
  'Director track record predicts greenlight outcomes 1.4x better than lead actor alone',
  'Non-star-driven films claimed 3 of top 10 box office spots in 2025',
  'Week 1 multiplex split: ~41% to distributor after GST',
  'Satellite rights collapsed to ~10% of budget (down from 30\u201350% pre-pandemic)',
  'Genre-budget fit is the single most predictive component for films under \u20B950Cr',
  'Walk-forward validation: model tested on 658 films across 14 rolling annual folds',
]

export function LoadingOverlay({ onComplete }: { onComplete: () => void }) {
  const [stepStates, setStepStates] = useState<Record<string, StepStatus>>(
    () => ({ [PHASES[0]!.steps[0]!.id]: 'active' })
  )
  const [progressPct, setProgressPct] = useState(2)
  const [elapsed, setElapsed] = useState(0)
  const [factIdx, setFactIdx] = useState(0)
  const [estimatedTotal] = useState(() => 14000 + Math.random() * 11000)

  const allSteps = useMemo(() => PHASES.flatMap(p => p.steps), [])
  const totalSteps = allSteps.length
  const completedRef = useRef(0)

  useEffect(() => {
    completedRef.current = 0
    const startTime = Date.now()
    const stepInterval = estimatedTotal / totalSteps

    const factTimer = setInterval(() => {
      setFactIdx(i => (i + 1) % FACTS.length)
    }, 6000)

    const interval = setInterval(() => {
      const idx = completedRef.current
      if (idx >= totalSteps) {
        const remaining = estimatedTotal - (Date.now() - startTime)
        setTimeout(() => {
          clearInterval(factTimer)
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

    return () => { clearInterval(interval); clearInterval(factTimer) }
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#181818]/95 backdrop-blur-sm">
      <div className="w-full max-w-lg px-6">
        <div className="mb-8 text-center">
          <p className="eyebrow text-[#8f8f8f]">Greenlit<span className="text-white">.</span></p>
          <h2 className="mt-3 text-[26px] font-medium tracking-[0.2px] text-white">Preparing your memorandum</h2>
          <p className="tnum mt-1 text-[11px] text-[#8f8f8f]">
            {(elapsed / 1000).toFixed(1)}s elapsed
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
                  <div className="relative flex size-2 items-center justify-center">
                    <div className={`size-1.5 rounded-full ${
                      ps === 'past' ? 'bg-white/70' : ps === 'active' ? 'bg-white' : 'bg-white/20'
                    }`} />
                  </div>
                  <span className="eyebrow text-[#969696]">
                    {phase.label}
                  </span>
                  {ps === 'past' && <CheckCircle2 className="size-2.5 text-white/70" />}
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
                          <CheckCircle2 className="size-3 shrink-0 text-white/70" />
                        ) : status === 'active' ? (
                          <Loader2 className="size-3 shrink-0 animate-spin text-white" />
                        ) : (
                          <Circle className="size-3 shrink-0 text-white/10" />
                        )}
                        <span className={`text-xs transition-colors duration-300 ${
                          status === 'done' ? 'text-[#969696]' : status === 'active' ? 'text-white' : 'text-[#8f8f8f]'
                        }`}>
                          {step.label}
                        </span>
                        {status === 'active' && (
                          <span className="ml-auto shrink-0 whitespace-nowrap text-[9px] text-[#8f8f8f]">
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
          <div className="relative h-px w-full overflow-hidden bg-white/10">
            <div
              className="relative h-full bg-white transition-all duration-500 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="tnum mt-2 flex justify-between text-[10px] text-[#8f8f8f]">
            <span>Preparing memorandum</span>
            <span>{progressPct}%</span>
          </div>
        </div>

        <div className="mt-6 h-10 overflow-hidden">
          <p className="animate-slide-up font-medium text-[13px] leading-relaxed text-[#969696]" key={factIdx}>
            {FACTS[factIdx]!}
          </p>
        </div>
      </div>
    </div>
  )
}
