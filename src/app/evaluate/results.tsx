'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import type { EvaluationResult } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  AlertCircle, Lightbulb, ArrowUp, ArrowDown, Minus, ChevronDown,
  CheckCircle2, AlertTriangle, XCircle, Target, TrendingUp, ShieldCheck,
} from 'lucide-react'
import { countRange } from '@/lib/display-ranges'

const verdictConfig = {
  greenlight: { label: 'Greenlight', icon: CheckCircle2, class: 'border-[#2FA968]/50 bg-transparent text-[#2FA968]' },
  conditional: { label: 'Conditional', icon: AlertTriangle, class: 'border-white/25 bg-transparent text-white' },
  dont_invest: { label: "Don't Invest", icon: XCircle, class: 'border-[#f13a2c]/40 bg-transparent text-[#f13a2c]' },
}

const riskConfig = {
  low: { label: 'Low Risk', class: 'bg-[#2FA968]/15 text-[#2FA968]' },
  moderate: { label: 'Moderate Risk', class: 'bg-[#303030] text-white' },
  high: { label: 'High Risk', class: 'bg-[#f13a2c]/15 text-[#f13a2c]' },
  very_high: { label: 'Very High Risk', class: 'bg-[#f13a2c]/15 text-[#f13a2c]' },
}

const severityConfig: Record<string, string> = {
  low: 'bg-[#2FA968]/15 text-[#2FA968]',
  moderate: 'bg-[#303030] text-white',
  high: 'bg-[#f13a2c]/15 text-[#f13a2c]',
  critical: 'bg-[#f13a2c]/15 text-[#f13a2c]',
}

function ScoreBar({ value, max, className }: { value: number | null | undefined; max: number; className?: string }) {
  const valid = value !== null && value !== undefined && !isNaN(value) && max > 0
  const pct = valid ? Math.round((value / max) * 100) : 0
  return (
    <div className={`h-1 w-full rounded-full bg-[#303030] ${className ?? ''}`}>
      <div className="h-full rounded-full bg-white transition-all duration-700 ease-out" style={{ width: `${pct}%` }} />
    </div>
  )
}

function TrajectoryIcon({ trajectory }: { trajectory?: string | null }) {
  if (trajectory === 'up') return <ArrowUp className="size-3 text-[#2FA968]" />
  if (trajectory === 'down') return <ArrowDown className="size-3 text-[#f13a2c]" />
  if (trajectory === 'stable') return <Minus className="size-3 text-[#8f8f8f]" />
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

  /* Filenames the PDF after the project */
  useEffect(() => {
    const prev = document.title
    document.title = `Greenlit memorandum — ${result.projectSummary.title}`
    return () => { document.title = prev }
  }, [result.projectSummary.title])

  /* A printed memorandum must be complete: expand every collapsible for print,
     then restore the reader's exact UI state afterwards. */
  const printRestore = useRef<{ levers: boolean; comparables: boolean; risk: boolean } | null>(null)
  useEffect(() => {
    const expand = () => {
      printRestore.current = { levers: showLevers, comparables: showComparables, risk: showRisk }
      setShowLevers(true)
      setShowComparables(true)
      setShowRisk(true)
    }
    const restore = () => {
      const p = printRestore.current
      if (p) {
        setShowLevers(p.levers)
        setShowComparables(p.comparables)
        setShowRisk(p.risk)
      }
    }
    window.addEventListener('beforeprint', expand)
    window.addEventListener('afterprint', restore)
    return () => {
      window.removeEventListener('beforeprint', expand)
      window.removeEventListener('afterprint', restore)
    }
  }, [showLevers, showComparables, showRisk])

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

  const [needleIn, setNeedleIn] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setNeedleIn(true), 60)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className={className}>
      {/* Print-only cover header */}
      <div className="mb-8 hidden print:block">
        <p className="text-[11px] font-semibold uppercase tracking-[1.1px]">Greenlit · Investment memorandum</p>
        <h1 className="mt-2 text-[28px] font-medium">{result.projectSummary.title}</h1>
        <p className="mt-1 text-[13px]">
          {result.projectSummary.genre} · Dir. {result.projectSummary.director} · ₹{result.projectSummary.totalBudgetCr}Cr ·
          Verdict {vc.label} · Market rank P{g.realMarketPct ?? '--'} · Generated {result.timestamp ? new Date(result.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}
        </p>
      </div>
      {/* ───── MEMORANDUM MASTHEAD ───── */}
      <div className="animate-slide-up rounded-none border border-[#303030] bg-transparent p-6 sm:p-8" style={{ animationDelay: '0ms' }}>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="min-w-0 flex-1">
            <p className="eyebrow text-[#969696]">Investment memorandum</p>
            <h1 className="font-medium mt-2 truncate text-2xl text-white sm:text-3xl">{result.projectSummary.title}</h1>
            <p className="mt-1 text-[13px] text-[#969696]">
              {result.projectSummary.genre} &middot; Dir. {result.projectSummary.director} &middot; ₹{result.projectSummary.totalBudgetCr}Cr
            </p>
          </div>
          <div className="shrink-0 text-right">
            <Badge className={vc.class}>
              <vc.icon className="size-3 mr-0.5" />
              {vc.label}
            </Badge>
            <p className="tnum mt-2 text-[64px] font-bold leading-none tracking-[-1.6px] text-white sm:text-[80px]">{g.adjustedScore ?? '--'}</p>
            <p className="mt-1 text-[11px] text-[#8f8f8f]">blend score · market rank P{g.realMarketPct ?? '--'}</p>
          </div>
        </div>

        <ScoreBar value={g.adjustedScore} max={100} className="mt-6" />

        {/* ───── VERDICT GAUGE: green / yellow / red ───── */}
        <div className="mt-6">
          <div className="flex items-baseline justify-between">
            <p className="eyebrow text-[#969696]">Verdict gauge</p>
            <p className="text-[11px] text-[#8f8f8f]">Needle: this project&apos;s market percentile</p>
          </div>
          <div className="relative mt-3">
            <div className="flex h-2.5 overflow-hidden rounded-full" role="img"
              aria-label={`Verdict ${vc.label} at percentile ${g.realMarketPct ?? 'unknown'}`}>
              <div className={`flex-1 ${g.verdict === 'dont_invest' ? 'bg-[#f13a2c]' : 'bg-[#f13a2c]/25'}`} />
              <div className={`flex-1 ${g.verdict === 'conditional' ? 'bg-[#E5A83B]' : 'bg-[#E5A83B]/25'}`} />
              <div className={`flex-1 ${g.verdict === 'greenlight' ? 'bg-[#2FA968]' : 'bg-[#2FA968]/25'}`} />
            </div>
            {typeof g.realMarketPct === 'number' && (
              <div
                className="absolute top-1/2 size-4 rounded-full border-[3px] border-[#181818] bg-white shadow-[0_0_0_1px_rgba(255,255,255,0.4)] transition-[left] duration-1000 ease-out"
                style={{
                  left: needleIn ? `${Math.min(99, Math.max(1, g.realMarketPct))}%` : '50%',
                  transform: 'translateX(-50%) translateY(-50%)',
                  animation: needleIn ? undefined : 'needle-settle 0.5s ease-out',
                }}
              />
            )}
          </div>
          <div className="mt-2 grid grid-cols-3 text-[11px] font-semibold uppercase tracking-[1.1px]">
            <span className={g.verdict === 'dont_invest' ? 'text-[#f13a2c]' : 'text-[#8f8f8f]'}>Don&apos;t invest</span>
            <span className={`text-center ${g.verdict === 'conditional' ? 'text-[#E5A83B]' : 'text-[#8f8f8f]'}`}>Conditional</span>
            <span className={`text-right ${g.verdict === 'greenlight' ? 'text-[#2FA968]' : 'text-[#8f8f8f]'}`}>Greenlight</span>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-4 border-t border-[#303030] pt-5">
          <div>
            <p className="eyebrow text-[#969696]">Market rank</p>
            <p className="tnum font-medium mt-1 text-2xl text-white">P{g.realMarketPct ?? '--'}</p>
            <p className="mt-0.5 text-[11px] text-[#8f8f8f]">Percentile vs dataset</p>
          </div>
          <div>
            <p className="eyebrow text-[#969696]">Data evidence</p>
            <p className="tnum font-medium mt-1 text-2xl text-white">{g.evidenceScore ?? '--'}</p>
            <p className="mt-0.5 text-[11px] text-[#8f8f8f]">{g.evidencePct ?? '--'}% of weight from dataset</p>
          </div>
          <div>
            <p className="eyebrow text-[#969696]">Input score</p>
            <p className="tnum font-medium mt-1 text-2xl text-white">{g.inputScore ?? '--'}</p>
            <p className="mt-0.5 text-[11px] text-[#8f8f8f]">Based on your assumptions</p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11px] text-[#8f8f8f]">
          <span className="flex items-center gap-1.5"><span className="size-1 rounded-full bg-white/70" /> {g.components.length} scoring dimensions</span>
          <span className="flex items-center gap-1.5"><span className="size-1 rounded-full bg-white/70" /> &plusmn;{g.confidenceInterval.upper ?? '--'} confidence interval</span>
          <span className="flex items-center gap-1.5"><span className="size-1 rounded-full bg-white/70" /> {result.financierRisk.capitalRecoveryProb ?? '--'}% capital recovery probability</span>
          <span className="flex items-center gap-1.5"><span className="size-1 rounded-full bg-[#8f8f8f]" /> ML model: {g.verdict === 'greenlight' ? 'supporting' : g.verdict === 'conditional' ? 'mixed' : 'cautionary'}</span>
        </div>
      </div>

      {/* ───── NARRATIVE SUMMARY ───── */}
      <div className="mt-4 animate-slide-up rounded-none border border-[#303030] bg-transparent p-5" style={{ animationDelay: '100ms' }}>
        <div className="flex items-start gap-3">
          <TrendingUp className="mt-0.5 size-4 text-white shrink-0" />
          <p className="font-medium text-[15px] leading-relaxed text-white/85">{g.narrativeSummary}</p>
        </div>
      </div>

      {/* ───── RECOMMENDATIONS ───── */}
      {result.riskDiagnosis.topRecommendations.length > 0 && (
        <div className="mt-4 animate-slide-up rounded-none border border-[#303030] bg-white/[0.03] p-5" style={{ animationDelay: '200ms' }}>
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="size-4 text-white" />
            <h3 className="eyebrow text-white/90">Recommendations</h3>
          </div>
          <ol className="space-y-2">
            {result.riskDiagnosis.topRecommendations.map((r, i) => (
              <li key={i} className="flex items-start gap-3 text-xs leading-relaxed">
                <span className="tnum mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[#303030] text-[9px] font-semibold text-white">{i + 1}</span>
                <span className="text-[#969696]">{r}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* ───── COMPONENT SCORES ───── */}
        <div className="mt-5 animate-slide-up" style={{ animationDelay: '300ms' }}>
          <h3 className="mb-3 eyebrow text-[#969696]">Component Scores</h3>
          {g.components.length > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {g.components.filter(c => c.weight >= 0.04).map(c => {
            const pct = Math.round((c.score / c.maxScore) * 100)
            const barColor = pct >= 70 ? 'bg-[#2FA968]' : pct >= 45 ? 'bg-white/80' : 'bg-[#f13a2c]'
            return (
              <div key={c.label} className="rounded-none border border-[#303030] bg-transparent p-4 transition-colors hover:border-white/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="truncate text-xs font-medium text-white/80">{c.label}</span>
                    <TrajectoryIcon trajectory={c.trajectory} />
                    {c.rankPct !== undefined && (
                      <span className="tnum text-[9px] text-[#8f8f8f]">P{c.rankPct}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="tnum text-xs font-semibold text-white">{c.score}</span>
                    <span className="text-[10px] text-[#8f8f8f]">/ {c.maxScore}</span>
                  </div>
                </div>
                <div className="mt-2 h-1 rounded-full bg-[#303030]">
                  <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <p className="text-[10px] text-[#8f8f8f] truncate">{c.explanation}</p>
                  {c.sampleSize !== undefined && c.sampleSize > 0 && (
                    <span className="shrink-0 text-[9px] text-[#8f8f8f] ml-1">{countRange(c.sampleSize)}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        ) : (
          <p className="text-xs text-[#8f8f8f]">No component data available.</p>
        )}
      </div>

      {/* ───── WHY THIS SCORE (ML PATH ATTRIBUTION) ───── */}
      {g.mlAttribution && (
        <div className="mt-5 animate-slide-up rounded-none border border-[#303030] bg-transparent p-5" style={{ animationDelay: '350ms' }}>
          <h3 className="eyebrow text-[#969696]">Why this score</h3>
          <p className="mt-1 text-[10px] text-[#8f8f8f]">
            The ML model predicts ~{g.mlAttribution.prediction.toFixed(2)}× break-even multiple from a base of {g.mlAttribution.base.toFixed(2)}×.
            Top drivers (path attribution — how each input pushed the prediction up or down):
          </p>
          <div className="mt-3 space-y-1.5">
            {[...g.mlAttribution.features]
              .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
              .slice(0, 4)
              .map(f => {
                const mag = Math.abs(f.contribution)
                const pct = Math.min(100, Math.round(mag * 100))
                return (
                  <div key={f.name} className="flex items-center gap-3 text-[11px]">
                    <span className="w-32 shrink-0 truncate text-[#969696]">{f.name}</span>
                    <div className="h-1 flex-1 rounded-full bg-[#303030]">
                      <div
                        className={`h-full rounded-full ${f.contribution >= 0 ? 'bg-[#2FA968]' : 'bg-[#f13a2c]'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className={`w-20 shrink-0 text-right font-medium ${f.contribution >= 0 ? 'text-[#2FA968]' : 'text-[#f13a2c]'}`}>
                      {f.contribution >= 0 ? '+' : ''}{f.contribution.toFixed(2)}×
                    </span>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {/* ───── MONTE CARLO ───── */}
      <div className="mt-5 animate-slide-up rounded-none border border-[#303030] bg-transparent p-5" style={{ animationDelay: '400ms' }}>
        <div className="flex items-center justify-between">
          <h3 className="eyebrow text-[#969696]">Monte Carlo Simulation</h3>
          <span className="tnum text-[9px] text-[#8f8f8f]">{mc.simulations.toLocaleString()} paths &middot; {mc.downsideRisk > 0 ? Math.round(mc.downsideRisk / mc.expectedReturn * 100) : '\u2014'}% CV</span>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-5">
          {[
            { label: 'P10', s: mc.p10, color: 'border-[#303030] bg-transparent' },
            { label: 'P25', s: mc.p25, color: 'border-[#303030] bg-transparent' },
            { label: 'P50 (Median)', s: mc.p50, color: 'border-[#303030] bg-white/[0.03]' },
            { label: 'P75', s: mc.p75, color: 'border-[#303030] bg-transparent' },
            { label: 'P90', s: mc.p90, color: 'border-[#303030] bg-transparent' },
          ].map(({ label, s, color }) => (
            <div key={label} className={`rounded-none border p-3 ${color}`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium text-white/80">{label}</span>
                <span className="tnum text-[9px] text-[#8f8f8f]">{s.multiple}x</span>
              </div>
              <p className="tnum mt-1 text-base font-semibold text-white">₹{s.grossCr}Cr</p>
              <div className="mt-1 flex justify-between text-[10px]">
                <span className={s.netProfitCr >= 0 ? 'text-[#2FA968]' : 'text-[#f13a2c]'}>
                  {s.netProfitCr >= 0 ? '+' : ''}₹{s.netProfitCr}Cr
                </span>
                <span className={s.netProfitCr >= 0 ? 'text-[#2FA968]' : 'text-[#f13a2c]'}>
                  {s.roiPercent >= 0 ? '+' : ''}{s.roiPercent}%
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-[#8f8f8f]">
          <span className="flex items-center gap-1">
            <span className="size-1 rounded-full bg-white/70" />
            Profit probability: <span className="tnum text-[#2FA968] font-medium">{mc.probProfit}%</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="size-1 rounded-full bg-white/70" />
            Expected return: <span className="tnum text-white/80 font-medium">{mc.expectedReturn >= 0 ? '+' : ''}₹{mc.expectedReturn}Cr</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="size-1 rounded-full bg-[#8f8f8f]" />
            Expected multiple: {mc.expectedMultiple}x
          </span>
        </div>

        <Separator className="my-3 bg-white/[0.07]" />

        <div className="tnum flex flex-wrap gap-3 text-[10px] text-[#8f8f8f]">
          <span>Break-even: ₹{result.financialProjection.breakEvenGrossCr}Cr</span>
          <span>Safe range: ₹{result.financialProjection.safeBudgetRange.min}Cr–₹{result.financialProjection.safeBudgetRange.max}Cr</span>
          <span>Base margin: {margin >= 0 ? '+' : ''}{marginPct}% ({margin >= 0 ? '+' : ''}₹{margin}Cr)</span>
        </div>
      </div>

      {/* ───── PRE-SALE BENCHMARKS ───── */}
      {result.preSaleBenchmarks.length > 0 && (
        <div className="mt-5 animate-slide-up rounded-none border border-[#303030] bg-transparent p-5" style={{ animationDelay: '500ms' }}>
          <h3 className="eyebrow text-[#969696]">Pre-Sale Benchmarks</h3>
          <div className="mt-3 space-y-1.5">
            {result.preSaleBenchmarks.map(b => {
              const statusColor = b.status === 'below' ? 'text-[#f13a2c]' : b.status === 'above' ? 'text-[#2FA968]' : 'text-[#8f8f8f]'
              return (
                <div key={b.category} className="flex flex-wrap items-center gap-3 rounded-none border border-[#303030] bg-transparent px-3 py-2 text-xs">
                  <span className="w-24 font-medium text-white/80 truncate">{b.category}</span>
                  <span className="tnum text-[#969696]">₹{b.userValue}Cr</span>
                  <span className="tnum text-[#8f8f8f]">(market: ₹{b.marketMin}Cr–₹{b.marketMax}Cr)</span>
                  <span className={`ml-auto ${statusColor}`}>{b.status}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ───── TOP LEVERS ───── */}
      <div className="mt-5 animate-slide-up rounded-none border border-[#303030] bg-transparent" style={{ animationDelay: '600ms' }}>
        <button
          type="button"
          onClick={() => setShowLevers(v => !v)}
          aria-expanded={showLevers}
          aria-controls="levers-panel"
          className="flex w-full items-center justify-between px-5 py-3.5 text-left"
        >
          <span className="flex items-center gap-2 eyebrow text-[#969696]">
            <ArrowUp className="size-3 text-blue-400" />
            Top Score Levers
            <span className="tnum text-[#8f8f8f] font-normal normal-case">({result.sensitivities.length})</span>
          </span>
          <ChevronDown className={`size-4 text-[#8f8f8f] transition-transform ${showLevers ? 'rotate-180' : ''}`} />
        </button>
        {showLevers && (
          <div id="levers-panel" role="region" className="border-t border-[#303030] px-5 pb-4">
            {result.sensitivities.length > 0 ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {result.sensitivities.map(s => (
                  <div key={s.label} className="rounded-none border border-[#303030] bg-transparent p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-white/80">{s.label}</span>
                      <span className={`text-xs font-semibold ${s.potentialGain >= 0 ? 'text-[#2FA968]' : 'text-[#f13a2c]'}`}>
                        {s.potentialGain >= 0 ? `+${s.potentialGain} pts` : `${s.potentialGain} pts risk`}
                      </span>
                    </div>
                    <p className="mt-1 text-[10px] text-[#969696]">{s.description}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-[10px] leading-relaxed text-[#8f8f8f]">
                No individual input change moves the score by more than 0.5 points — the score is locally robust to single-lever moves.
              </p>
            )}
          </div>
        )}
      </div>

      {/* ───── TESTED: NO MATERIAL EFFECT ───── */}
      {result.insensitiveLevers.length > 0 && (
        <div className="mt-3 animate-slide-up rounded-none border border-[#303030] bg-transparent px-5 py-4" style={{ animationDelay: '650ms' }}>
          <p className="text-[11px] font-semibold uppercase tracking-[1.1px] text-[#8f8f8f]">
            Tested — won&apos;t move the needle
          </p>
          <ul className="mt-2 space-y-1.5">
            {result.insensitiveLevers.map(m => (
              <li key={m.label} className="flex items-baseline justify-between gap-3 text-[11px]">
                <span className="min-w-0 flex-1 truncate text-[#969696]">{m.detail}</span>
                <span className="tnum shrink-0 text-[#8f8f8f]">{m.gain >= 0 ? '+' : ''}{m.gain} pts</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ───── COMPARABLE FILMS ───── */}
      {result.comparableFilms.films.length > 0 && (
        <div className="mt-3 animate-slide-up rounded-none border border-[#303030] bg-transparent" style={{ animationDelay: '700ms' }}>
          <button
            type="button"
            onClick={() => setShowComparables(v => !v)}
            aria-expanded={showComparables}
            aria-controls="comparables-panel"
            className="flex w-full items-center justify-between px-5 py-3.5 text-left"
          >
            <span className="flex items-center gap-2 eyebrow text-[#969696]">
              <Target className="size-3" />
              Comparable Films ({result.comparableFilms.films.length})
            </span>
            <ChevronDown className={`size-4 text-[#8f8f8f] transition-transform ${showComparables ? 'rotate-180' : ''}`} />
          </button>
          {showComparables && (
            <div id="comparables-panel" role="region" className="border-t border-[#303030] px-5 pb-4">
              <p className="mt-3 text-[10px] text-[#8f8f8f]">{result.comparableFilms.querySummary}</p>
              <div className="mt-2 space-y-1">
                {result.comparableFilms.films.map(f => (
                  <div key={f.film.film_id} className="flex flex-wrap items-center gap-3 rounded-none border border-[#303030] bg-transparent px-3 py-2 text-[11px]">
                    <span className="w-32 sm:w-40 font-medium text-white/80 truncate">{f.film.display_title}</span>
                    <span className="tnum text-[#969696]">{f.film.release_year}</span>
                    <span className="text-[#969696]">{f.film.primary_genre}</span>
                    <span className="ml-auto flex items-center gap-2">
                      <div className="h-1 w-10 rounded-full bg-[#303030]">
                        <div className="h-full rounded-full bg-white/80" style={{ width: `${f.similarityScore}%` }} />
                      </div>
                      <span className="tnum text-[10px] text-[#969696]">{f.similarityScore}%</span>
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
        <div className="mt-3 animate-slide-up rounded-none border border-[#303030] bg-transparent" style={{ animationDelay: '800ms' }}>
          <button
            type="button"
            onClick={() => setShowRisk(v => !v)}
            aria-expanded={showRisk}
            aria-controls="risk-panel"
            className="flex w-full items-center justify-between px-5 py-3.5 text-left"
          >
            <span className="flex items-center gap-2 eyebrow text-[#969696]">
              <ShieldCheck className="size-3" />
              Risk Diagnosis
              <Badge className={`text-[9px] ${riskConfig[result.riskDiagnosis.overallRisk]?.class ?? ''}`}>
                {result.riskDiagnosis.overallRisk.replace('_', ' ')}
              </Badge>
            </span>
            <ChevronDown className={`size-4 text-[#8f8f8f] transition-transform ${showRisk ? 'rotate-180' : ''}`} />
          </button>
          {showRisk && (
            <div id="risk-panel" role="region" className="border-t border-[#303030] px-5 pb-4">
              <div className="mt-3 space-y-2">
                {result.riskDiagnosis.factors.map(f => (
                  <div key={f.factor} className="rounded-none border border-[#303030] bg-transparent p-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-white" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-white/80">{f.factor}</span>
                          <Badge className={`text-[9px] ${severityConfig[f.severity]!}`}>{f.severity}</Badge>
                        </div>
                        <p className="mt-0.5 text-[10px] text-[#969696]">{f.description}</p>
                        <p className="mt-1 text-[10px] text-[#8f8f8f] italic">Mitigation: {f.mitigation}</p>
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
            <span key={i} className="inline-flex items-center gap-1 rounded-full border border-[#303030] bg-white/[0.03] px-2.5 py-1 text-[9px] text-white/80">
              <AlertCircle className="size-2.5 text-[#8f8f8f]" />
              {w}
            </span>
          ))}
        </div>
      )}

      {/* ───── METHODOLOGY FOOTNOTE ───── */}
      <div className="mt-6 animate-slide-up rounded-none border border-[#303030] bg-transparent px-4 py-3" style={{ animationDelay: '1000ms' }}>
        <p className="text-[10px] text-[#8f8f8f] leading-relaxed">
          Methodology: Continuous outcome model scoring expected gross multiples across {g.components.length} dimensions.
          Dataset: 729 films (2001–2025) with verified financials. ML: 9-feature GBM ensemble with Bayesian shrinkage toward empirical priors.
          Simulation: 10,000-path lognormal Monte Carlo with break-even-anchored mean and sample-size-adjusted volatility.
          Walk-forward validated: 14 rolling folds, 658 films tested out-of-sample. Survivorship bias is disclosed, not corrected away. Full film-by-film record available under diligence.
        </p>
        {result.timestamp && (
          <p className="mt-1.5 text-[9px] text-[#8f8f8f]">Evaluated {new Date(result.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
        )}
      </div>

      {/* ───── SHARE + PDF ───── */}
      <div className="mt-4 flex justify-center gap-3" style={{ animationDelay: '1100ms' }}>
        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center gap-1.5 rounded-none bg-[#da291c] px-6 py-2.5 text-[12px] font-bold uppercase tracking-[1.4px] text-white transition-colors hover:bg-[#b01e0a]"
        >
          Download PDF
        </button>
        <button
          type="button"
          onClick={handleShare}
          className="flex items-center gap-1.5 rounded-none border border-[#303030] bg-transparent px-6 py-2.5 text-[12px] font-bold uppercase tracking-[1.4px] text-[#969696] transition-colors hover:border-white/60 hover:text-white"
        >
          {copied ? 'Copied!' : 'Share results'}
        </button>
      </div>
    </div>
  )
}
