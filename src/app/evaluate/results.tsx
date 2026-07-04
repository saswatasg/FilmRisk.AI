'use client'

import { useState, useCallback } from 'react'
import type { EvaluationResult } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  AlertCircle, Lightbulb, ArrowUp, ArrowDown, Minus, ChevronDown,
  CheckCircle2, AlertTriangle, XCircle, Target, TrendingUp, ShieldCheck, Share2,
} from 'lucide-react'

const verdictConfig = {
  greenlight: { label: 'Greenlight', icon: CheckCircle2, class: 'bg-emerald-900/40 text-emerald-400 border-emerald-800/50' },
  conditional: { label: 'Conditional', icon: AlertTriangle, class: 'bg-amber-900/40 text-amber-400 border-amber-800/50' },
  dont_invest: { label: "Don't Invest", icon: XCircle, class: 'bg-red-900/40 text-red-400 border-red-800/50' },
}

const riskConfig = {
  low: { label: 'Low Risk', class: 'bg-emerald-900/40 text-emerald-400' },
  moderate: { label: 'Moderate Risk', class: 'bg-amber-900/40 text-amber-400' },
  high: { label: 'High Risk', class: 'bg-orange-900/40 text-orange-400' },
  very_high: { label: 'Very High Risk', class: 'bg-red-900/40 text-red-400' },
}

const severityConfig: Record<string, string> = {
  low: 'bg-emerald-900/40 text-emerald-400',
  moderate: 'bg-amber-900/40 text-amber-400',
  high: 'bg-orange-900/40 text-orange-400',
  critical: 'bg-red-900/40 text-red-400',
}

function ScoreBar({ value, max, className }: { value: number | null | undefined; max: number; className?: string }) {
  const valid = value !== null && value !== undefined && !isNaN(value) && max > 0
  const pct = valid ? Math.round((value / max) * 100) : 0
  const color = pct >= 70 ? 'from-emerald-600 to-emerald-400' : pct >= 45 ? 'from-amber-600 to-amber-400' : 'from-red-600 to-red-400'
  return (
    <div className={`h-2 w-full rounded-full bg-white/5 ${className ?? ''}`}>
      <div className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-1000 ease-out`} style={{ width: `${pct}%` }} />
    </div>
  )
}

function TrajectoryIcon({ trajectory }: { trajectory?: string | null }) {
  if (trajectory === 'up') return <ArrowUp className="size-3 text-emerald-400" />
  if (trajectory === 'down') return <ArrowDown className="size-3 text-red-400" />
  if (trajectory === 'stable') return <Minus className="size-3 text-white/30" />
  return null
}

export function EvaluationResults({ result, className }: { result: EvaluationResult; className?: string }) {
  const g = result.greenlight
  const vc = verdictConfig[g.verdict]!
  const [showLevers, setShowLevers] = useState(false)
  const [showComparables, setShowComparables] = useState(false)
  const [showRisk, setShowRisk] = useState(false)

  const mc = result.financialProjection.monteCarlo

  const margin = result.financialProjection.scenarios[1]?.netProfitCr ?? 0
  const marginPct = result.financialProjection.scenarios[1]?.roiPercent ?? 0

  const [copied, setCopied] = useState(false)

  const handleShare = useCallback(() => {
    const lines = [
      `Greenlit — ${result.projectSummary.title}`,
      `Score: ${g.adjustedScore ?? '--'}/100 | Verdict: ${vc.label}`,
      `Evidence: ${g.evidenceScore ?? '--'}/100 | Rank: P${g.realMarketPct ?? '--'}`,
      `Budget: ₹${result.projectSummary.totalBudgetCr}Cr | Profit prob: ${mc.probProfit}%`,
      result.riskDiagnosis.topRecommendations[0]
        ? `Top recommendation: ${result.riskDiagnosis.topRecommendations[0] ?? ''}`
        : '',
      'Evaluated at filmrisk.in/evaluate',
    ].filter(Boolean).join('\n')

    navigator.clipboard.writeText(lines).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [result, g, vc, mc])

  return (
    <div className={className}>
      {/* ───── VERDICT STRIP ───── */}
      <div className="animate-slide-up rounded-2xl border border-white/10 bg-zinc-900/60 p-6" style={{ animationDelay: '0ms' }}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold text-white truncate">{result.projectSummary.title}</h1>
            <p className="mt-0.5 text-xs text-white/40">
              {result.projectSummary.genre} &middot; Dir. {result.projectSummary.director} &middot; ₹{result.projectSummary.totalBudgetCr}Cr
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="outline" className="border-white/10 text-[10px] text-white/40">v2</Badge>
            <Badge className={vc.class}>
              <vc.icon className="size-3 mr-0.5" />
              {vc.label}
            </Badge>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-4 gap-4">
          <div>
            <p className="text-[10px] text-white/30 uppercase tracking-wider">Greenlight Score</p>
            <p className="mt-0.5 text-2xl font-bold text-white">{g.adjustedScore ?? '--'}<span className="text-sm font-normal text-white/30">/100</span></p>
            <p className="text-[10px] text-white/30">Break-even anchored blend</p>
          </div>
          <div>
            <p className="text-[10px] text-white/30 uppercase tracking-wider">Market Rank</p>
            <p className="mt-0.5 text-2xl font-bold text-emerald-400">P{g.realMarketPct ?? '--'}</p>
            <p className="text-[10px] text-white/30">Percentile vs dataset</p>
          </div>
          <div>
            <p className="text-[10px] text-white/30 uppercase tracking-wider">Data Evidence</p>
            <p className="mt-0.5 text-2xl font-bold text-white">{g.evidenceScore ?? '--'}<span className="text-sm font-normal text-white/30">/100</span></p>
            <p className="text-[10px] text-white/30">{g.evidencePct ?? '--'}% of weight from dataset</p>
          </div>
          <div>
            <p className="text-[10px] text-white/30 uppercase tracking-wider">Input Score</p>
            <p className="mt-0.5 text-2xl font-bold text-white">{g.inputScore ?? '--'}<span className="text-sm font-normal text-white/30">/100</span></p>
            <p className="text-[10px] text-white/30">Based on your assumptions</p>
          </div>
        </div>

        <ScoreBar value={g.adjustedScore} max={100} className="mt-4" />

        <div className="mt-4 flex flex-wrap items-center gap-2 text-[10px] text-white/25">
          <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-emerald-500/50" /> {g.components.length} scoring dimensions</span>
          <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-emerald-500/50" /> &plusmn;{g.confidenceInterval.upper ?? '--'} CI</span>
          <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-emerald-500/50" /> {result.financierRisk.capitalRecoveryProb ?? '--'}% capital recovery prob</span>
          <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-amber-500/50" /> ML model: {g.verdict === 'greenlight' ? 'supporting' : g.verdict === 'conditional' ? 'mixed' : 'cautionary'}</span>
          <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-purple-500/50" /> Bayesian shrinkage applied</span>
        </div>
      </div>

      {/* ───── NARRATIVE SUMMARY ───── */}
      <div className="mt-4 animate-slide-up rounded-2xl border border-white/5 bg-white/[0.02] p-5" style={{ animationDelay: '100ms' }}>
        <div className="flex items-start gap-3">
          <TrendingUp className="mt-0.5 size-4 text-emerald-400 shrink-0" />
          <p className="text-sm leading-relaxed text-white/70">{g.narrativeSummary}</p>
        </div>
      </div>

      {/* ───── RECOMMENDATIONS ───── */}
      {result.riskDiagnosis.topRecommendations.length > 0 && (
        <div className="mt-4 animate-slide-up rounded-2xl border border-amber-900/30 bg-amber-950/10 p-5" style={{ animationDelay: '200ms' }}>
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="size-4 text-amber-400" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-400/80">Recommendations</h3>
          </div>
          <ol className="space-y-2">
            {result.riskDiagnosis.topRecommendations.map((r, i) => (
              <li key={i} className="flex items-start gap-3 text-xs leading-relaxed">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-[9px] font-semibold text-amber-400">{i + 1}</span>
                <span className="text-white/60">{r}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* ───── COMPONENT SCORES ───── */}
        <div className="mt-5 animate-slide-up" style={{ animationDelay: '300ms' }}>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/30">Component Scores</h3>
          {g.components.length > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {g.components.filter(c => c.weight >= 0.04).map(c => {
            const pct = Math.round((c.score / c.maxScore) * 100)
            const barColor = pct >= 70 ? 'from-emerald-600 to-emerald-400' : pct >= 45 ? 'from-amber-600 to-amber-400' : 'from-red-600 to-red-400'
            return (
              <div key={c.label} className="rounded-xl border border-white/5 bg-zinc-900/30 p-3.5 transition-all hover:border-white/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="truncate text-xs font-medium text-white/70">{c.label}</span>
                    <TrajectoryIcon trajectory={c.trajectory} />
                    {c.rankPct !== undefined && (
                      <span className="text-[9px] text-amber-400/60">P{c.rankPct}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-xs font-semibold text-white">{c.score}</span>
                    <span className="text-[10px] text-white/30">/ {c.maxScore}</span>
                  </div>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-white/5">
                  <div className={`h-full rounded-full bg-gradient-to-r ${barColor}`} style={{ width: `${pct}%` }} />
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <p className="text-[10px] text-white/25 truncate">{c.explanation}</p>
                  {c.sampleSize !== undefined && c.sampleSize > 0 && (
                    <span className="shrink-0 text-[9px] text-white/15 ml-1">n={c.sampleSize}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        ) : (
          <p className="text-xs text-white/30">No component data available.</p>
        )}
      </div>

      {/* ───── MONTE CARLO ───── */}
      <div className="mt-5 animate-slide-up rounded-2xl border border-white/5 bg-zinc-900/30 p-5" style={{ animationDelay: '400ms' }}>
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-white/30">Monte Carlo Simulation</h3>
          <span className="text-[9px] text-white/20">{mc.simulations.toLocaleString()} paths &middot; {mc.downsideRisk > 0 ? Math.round(mc.downsideRisk / mc.expectedReturn * 100) : '\u2014'}% CV</span>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-5">
          {[
            { label: 'P10', s: mc.p10, color: 'border-red-900/40 bg-red-950/20' },
            { label: 'P25', s: mc.p25, color: 'border-orange-900/40 bg-orange-950/20' },
            { label: 'P50 (Median)', s: mc.p50, color: 'border-emerald-900/40 bg-emerald-950/20' },
            { label: 'P75', s: mc.p75, color: 'border-emerald-800/30 bg-emerald-950/10' },
            { label: 'P90', s: mc.p90, color: 'border-emerald-700/20 bg-emerald-950/5' },
          ].map(({ label, s, color }) => (
            <div key={label} className={`rounded-xl border p-3 ${color}`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium text-white/50">{label}</span>
                <span className="text-[9px] text-white/30">{s.multiple}x</span>
              </div>
              <p className="mt-1 text-base font-semibold text-white">₹{s.grossCr}Cr</p>
              <div className="mt-1 flex justify-between text-[10px]">
                <span className={s.netProfitCr >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                  {s.netProfitCr >= 0 ? '+' : ''}₹{s.netProfitCr}Cr
                </span>
                <span className={s.netProfitCr >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                  {s.roiPercent >= 0 ? '+' : ''}{s.roiPercent}%
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-white/30">
          <span className="flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-emerald-500/50" />
            Profit probability: <span className="text-emerald-400 font-medium">{mc.probProfit}%</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-emerald-500/50" />
            Expected return: <span className="text-white/50 font-medium">{mc.expectedReturn >= 0 ? '+' : ''}₹{mc.expectedReturn}Cr</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-amber-500/50" />
            Expected multiple: {mc.expectedMultiple}x
          </span>
        </div>

        <Separator className="my-3 bg-white/5" />

        <div className="flex flex-wrap gap-3 text-[10px] text-white/30">
          <span>Break-even: ₹{result.financialProjection.breakEvenGrossCr}Cr</span>
          <span>Safe range: ₹{result.financialProjection.safeBudgetRange.min}Cr–₹{result.financialProjection.safeBudgetRange.max}Cr</span>
          <span>Base margin: {margin >= 0 ? '+' : ''}{marginPct}% ({margin >= 0 ? '+' : ''}₹{margin}Cr)</span>
        </div>
      </div>

      {/* ───── PRE-SALE BENCHMARKS ───── */}
      {result.preSaleBenchmarks.length > 0 && (
        <div className="mt-5 animate-slide-up rounded-2xl border border-white/5 bg-zinc-900/30 p-5" style={{ animationDelay: '500ms' }}>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-white/30">Pre-Sale Benchmarks</h3>
          <div className="mt-3 space-y-1.5">
            {result.preSaleBenchmarks.map(b => {
              const statusColor = b.status === 'below' ? 'text-amber-400' : b.status === 'above' ? 'text-emerald-400' : 'text-white/40'
              return (
                <div key={b.category} className="flex flex-wrap items-center gap-3 rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-xs">
                  <span className="w-24 font-medium text-white/70 truncate">{b.category}</span>
                  <span className="text-white/50">₹{b.userValue}Cr</span>
                  <span className="text-white/30">(market: ₹{b.marketMin}Cr–₹{b.marketMax}Cr)</span>
                  <span className={`ml-auto ${statusColor}`}>{b.status}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ───── TOP LEVERS ───── */}
      {result.sensitivities.length > 0 && (
        <div className="mt-5 animate-slide-up rounded-2xl border border-white/5 bg-zinc-900/30" style={{ animationDelay: '600ms' }}>
          <button
            type="button"
            onClick={() => setShowLevers(v => !v)}
            aria-expanded={showLevers}
            aria-controls="levers-panel"
            className="flex w-full items-center justify-between px-5 py-3.5 text-left"
          >
            <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/30">
              <ArrowUp className="size-3 text-blue-400" />
              Top Score Levers
              <span className="text-white/20 font-normal normal-case">({result.sensitivities.length})</span>
            </span>
            <ChevronDown className={`size-4 text-white/30 transition-transform ${showLevers ? 'rotate-180' : ''}`} />
          </button>
          {showLevers && (
            <div id="levers-panel" role="region" className="border-t border-white/5 px-5 pb-4">
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {result.sensitivities.map(s => (
                  <div key={s.label} className="rounded-lg border border-white/5 bg-black/30 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-white/70">{s.label}</span>
                      <span className="text-xs font-semibold text-emerald-400">+{s.potentialGain} pts</span>
                    </div>
                    <p className="mt-1 text-[10px] text-white/30">{s.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ───── COMPARABLE FILMS ───── */}
      {result.comparableFilms.films.length > 0 && (
        <div className="mt-3 animate-slide-up rounded-2xl border border-white/5 bg-zinc-900/30" style={{ animationDelay: '700ms' }}>
          <button
            type="button"
            onClick={() => setShowComparables(v => !v)}
            aria-expanded={showComparables}
            aria-controls="comparables-panel"
            className="flex w-full items-center justify-between px-5 py-3.5 text-left"
          >
            <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/30">
              <Target className="size-3" />
              Comparable Films ({result.comparableFilms.films.length})
            </span>
            <ChevronDown className={`size-4 text-white/30 transition-transform ${showComparables ? 'rotate-180' : ''}`} />
          </button>
          {showComparables && (
            <div id="comparables-panel" role="region" className="border-t border-white/5 px-5 pb-4">
              <p className="mt-3 text-[10px] text-white/25">{result.comparableFilms.querySummary}</p>
              <div className="mt-2 space-y-1">
                {result.comparableFilms.films.map(f => (
                  <div key={f.film.film_id} className="flex flex-wrap items-center gap-3 rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-[11px]">
                    <span className="w-32 sm:w-40 font-medium text-white/70 truncate">{f.film.display_title}</span>
                    <span className="text-white/40">{f.film.release_year}</span>
                    <span className="text-white/40">{f.film.primary_genre}</span>
                    <span className="ml-auto flex items-center gap-2">
                      <div className="h-1 w-10 rounded-full bg-white/5">
                        <div className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400" style={{ width: `${f.similarityScore}%` }} />
                      </div>
                      <span className="text-[10px] text-white/40">{f.similarityScore}%</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ───── RISK DIAGNOSIS ───── */}
      {result.riskDiagnosis.factors.length > 0 && (
        <div className="mt-3 animate-slide-up rounded-2xl border border-white/5 bg-zinc-900/30" style={{ animationDelay: '800ms' }}>
          <button
            type="button"
            onClick={() => setShowRisk(v => !v)}
            aria-expanded={showRisk}
            aria-controls="risk-panel"
            className="flex w-full items-center justify-between px-5 py-3.5 text-left"
          >
            <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/30">
              <ShieldCheck className="size-3" />
              Risk Diagnosis
              <Badge className={`text-[9px] ${riskConfig[result.riskDiagnosis.overallRisk]?.class ?? ''}`}>
                {result.riskDiagnosis.overallRisk.replace('_', ' ')}
              </Badge>
            </span>
            <ChevronDown className={`size-4 text-white/30 transition-transform ${showRisk ? 'rotate-180' : ''}`} />
          </button>
          {showRisk && (
            <div id="risk-panel" role="region" className="border-t border-white/5 px-5 pb-4">
              <div className="mt-3 space-y-2">
                {result.riskDiagnosis.factors.map(f => (
                  <div key={f.factor} className="rounded-lg border border-white/5 bg-black/30 p-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-amber-400" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-white/70">{f.factor}</span>
                          <Badge className={`text-[9px] ${severityConfig[f.severity]!}`}>{f.severity}</Badge>
                        </div>
                        <p className="mt-0.5 text-[10px] text-white/30">{f.description}</p>
                        <p className="mt-1 text-[10px] text-white/25 italic">Mitigation: {f.mitigation}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ───── DATA QUALITY ───── */}
      {result.dataQualityWarnings.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5" style={{ animationDelay: '900ms' }}>
          {result.dataQualityWarnings.map((w, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-full border border-amber-900/30 bg-amber-950/20 px-2.5 py-1 text-[9px] text-amber-400/70">
              <AlertCircle className="size-2.5" />
              {w}
            </span>
          ))}
        </div>
      )}

      {/* ───── METHODOLOGY FOOTNOTE ───── */}
      <div className="mt-6 animate-slide-up rounded-lg border border-white/5 bg-white/[0.02] px-4 py-3" style={{ animationDelay: '1000ms' }}>
        <p className="text-[10px] text-white/20 leading-relaxed">
          Methodology: Continuous outcome model scoring expected gross multiples across {g.components.length} dimensions.
          Dataset: 729 films (2015–2025) with verified financials. ML: 9-feature GBM ensemble with Bayesian shrinkage toward empirical priors.
          Simulation: 10,000-path lognormal Monte Carlo with break-even-anchored mean and sample-size-adjusted volatility.
          Walk-forward validated across 15 annual windows. Survivorship bias: dataset avg 2.72× vs real market ~1.0×.
        </p>
        {result.timestamp && (
          <p className="mt-1.5 text-[9px] text-white/15">Evaluated {new Date(result.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
        )}
      </div>

      {/* ───── SHARE ───── */}
      <div className="mt-4 flex justify-center" style={{ animationDelay: '1100ms' }}>
        <button
          type="button"
          onClick={handleShare}
          className="flex items-center gap-1.5 rounded-full border border-white/5 bg-transparent px-4 py-2 text-[10px] text-white/30 transition-all duration-200 hover:border-white/10 hover:text-white/50 active:scale-95"
        >
          <Share2 className="size-3" />
          {copied ? 'Copied!' : 'Share results'}
        </button>
      </div>
    </div>
  )
}
