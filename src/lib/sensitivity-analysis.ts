import type { EvaluationInput, SensitivityItem } from './types'
import type { DatasetStats } from './dataset-stats'
import { calculateGreenlightScore } from './scoring-engine'

const FIELDS: { label: string; field: keyof EvaluationInput; type: 'tier' | 'slider' | 'percent' | 'budget' | 'timing'; gain: number }[] = [
  { label: 'Actor Tier', field: 'actorTier', type: 'tier', gain: 3 },
  { label: 'Director Tier', field: 'directorTier', type: 'tier', gain: 4 },
  { label: 'Concept Clarity', field: 'conceptClarity', type: 'slider', gain: 2 },
  { label: 'Novelty', field: 'novelty', type: 'slider', gain: 1.5 },
  { label: 'Market Timing', field: 'marketTiming', type: 'timing', gain: 3 },
  { label: 'Release Month', field: 'releaseMonth', type: 'timing', gain: 2 },
  { label: 'Theatrical Share', field: 'theatricalSharePercent', type: 'percent', gain: 2.5 },
  { label: 'Pre-Sale Coverage', field: 'ottRightsCr', type: 'budget', gain: 3 },
]

const TIER_ORDER: Record<string, number> = { A: 4, B: 3, C: 2, D: 1, unknown: 0 }
const MONTH_ORDER: Record<number, number[]> = {}
const MONTH_SCORE: Record<number, number> = {}

function tierUp(t: string): string | null {
  const cur = TIER_ORDER[t] ?? 0
  if (cur >= 4) return null
  const next = Object.entries(TIER_ORDER).find(([, v]) => v === cur + 1)
  return next ? next[0] : null
}

function monthUp(m: number, stats: DatasetStats): string | null {
  const cur = stats.monthStats[m]
  if (!cur || cur.count < 3) return null
  const best = Object.entries(stats.monthStats)
    .filter(([, v]) => v.count >= 3)
    .sort(([, a], [, b]) => b.adjustedWinRatePct - a.adjustedWinRatePct)
  if (best.length === 0) return null
  const bestMonth = parseInt(best[0][0])
  if (bestMonth === m) return null
  return MONTHS[bestMonth] ?? null
}

const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function timingUp(t: string): string | null {
  if (t === 'weak') return 'neutral'
  if (t === 'neutral') return 'strong'
  return null
}

export function analyzeSensitivities(input: EvaluationInput, stats: DatasetStats): SensitivityItem[] {
  const base = calculateGreenlightScore(input, stats)
  const items: SensitivityItem[] = []

  for (const f of FIELDS) {
    let suggested: string | null = null
    let currentValue = String(input[f.field] ?? '')
    let description = ''

    if (f.type === 'tier') {
      const up = tierUp(currentValue)
      if (!up) continue
      suggested = up + '-Tier'
      description = `Upgrade ${f.label} from ${currentValue} to ${up}`
    } else if (f.type === 'slider') {
      const cur = Number(input[f.field])
      if (cur >= 10) continue
      const next = Math.min(10, cur + 2)
      suggested = String(next)
      currentValue = String(cur)
      description = `Increase ${f.label} from ${cur} to ${next}`
    } else if (f.type === 'percent') {
      const cur = Number(input[f.field])
      if (cur >= 50) continue
      const next = Math.min(50, cur + 5)
      suggested = `${next}%`
      currentValue = `${cur}%`
      description = `Increase ${f.label} from ${cur}% to ${next}%`
    } else if (f.type === 'budget') {
      const totalRights =
        input.ottRightsCr + input.satelliteRightsCr + input.musicRightsCr +
        input.overseasRightsCr + input.brandRevenueCr
      const target = input.totalBudgetCr * 0.15
      if (totalRights >= input.totalBudgetCr * 0.8) continue
      const add = Math.round(target * 10) / 10
      const newTotal = Math.round((totalRights + add) * 10) / 10
      if (add <= 0) continue
      suggested = `+₹${add}Cr`
      description = `Add ₹${add}Cr in OTT rights to reach ${newTotal}Cr total pre-sales`
    } else if (f.type === 'timing' && f.field === 'marketTiming') {
      const up = timingUp(currentValue)
      if (!up) continue
      suggested = up
      description = `Improve market timing from ${currentValue} to ${up}`
    } else if (f.type === 'timing' && f.field === 'releaseMonth') {
      const cur = Number(input[f.field])
      const best = monthUp(cur, stats)
      if (!best) continue
      suggested = best
      currentValue = MONTHS[cur] ?? String(cur)
      description = `Move release from ${currentValue} to ${best} (higher historical WR)`
    }

    if (!suggested) continue

    const testInput = { ...input, [f.field]: f.type === 'budget' ? input.ottRightsCr + (input.totalBudgetCr * 0.15) : suggested as any }
    const modified = calculateGreenlightScore(testInput, stats)
    const gain = Math.round((modified.totalScore - base.totalScore) * 10) / 10

    if (gain > 0.5) {
      items.push({ label: f.label, field: f.field, currentValue, suggestedValue: suggested, potentialGain: gain, description })
    }
  }

  return items.sort((a, b) => b.potentialGain - a.potentialGain).slice(0, 5)
}
