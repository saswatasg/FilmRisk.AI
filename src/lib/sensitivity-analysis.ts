import type { EvaluationInput, SensitivityItem, ImmaterialMove } from './types'
import type { DatasetStats } from './dataset-stats'
import { calculateGreenlightScore } from './scoring-engine'

const FIELDS: { label: string; field: keyof EvaluationInput; type: 'tier' | 'slider' | 'percent' | 'budget' | 'timing' | 'overrun' | 'downshift'; gain: number }[] = [
  { label: 'Actor Tier', field: 'actorTier', type: 'tier', gain: 3 },
  { label: 'Director Tier', field: 'directorTier', type: 'tier', gain: 4 },
  { label: 'Concept Clarity', field: 'conceptClarity', type: 'slider', gain: 2 },
  { label: 'Novelty', field: 'novelty', type: 'slider', gain: 1.5 },
  { label: 'Market Timing', field: 'marketTiming', type: 'timing', gain: 3 },
  { label: 'Release Month', field: 'releaseMonth', type: 'timing', gain: 2 },
  { label: 'Theatrical Share', field: 'theatricalSharePercent', type: 'percent', gain: 2.5 },
  { label: 'Pre-Sale Coverage', field: 'ottRightsCr', type: 'budget', gain: 3 },
  { label: 'Budget Overrun', field: 'totalBudgetCr', type: 'overrun', gain: 0 },
  { label: 'Budget Downshift', field: 'totalBudgetCr', type: 'downshift', gain: 0 },
]

const TIER_ORDER: Record<string, number> = { S: 5, A: 4, B: 3, C: 2, D: 1, unknown: 0 }

function tierUp(t: string): string | null {
  const cur = TIER_ORDER[t] ?? 0
  if (cur >= 5) return null
  const next = Object.entries(TIER_ORDER).find(([, v]) => v === cur + 1)
  return next ? next[0] : null
}

function monthUp(m: number, stats: DatasetStats): number | null {
  const cur = stats.monthStats[m]
  if (!cur || cur.count < 3) return null
  const best = Object.entries(stats.monthStats)
    .filter(([, v]) => v.count >= 3)
    .sort(([, a], [, b]) => b.avgNormalizedMultiple - a.avgNormalizedMultiple)
  if (best.length === 0) return null
  const bestMonth = parseInt(best[0]![0])
  if (bestMonth === m) return null
  return bestMonth
}

const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function timingUp(t: string): string | null {
  if (t === 'weak') return 'neutral'
  if (t === 'neutral') return 'strong'
  return null
}

/* Each lever carries a display `suggested` string AND a typed `testValue` actually
   fed to the scoring engine. Display strings must never be written into typed
   input fields (that silently NaNs the re-score and drops the lever). */
export function analyzeScenarioMoves(input: EvaluationInput, stats: DatasetStats): {
  levers: SensitivityItem[]
  immaterial: ImmaterialMove[]
} {
  const base = calculateGreenlightScore(input, stats)
  const items: SensitivityItem[] = []
  const immaterial: ImmaterialMove[] = []

  for (const f of FIELDS) {
    let suggested: string | null = null
    let testValue: string | number | null = null
    let currentValue = String(input[f.field] ?? '')
    let description = ''

    if (f.type === 'tier') {
      const up = tierUp(currentValue)
      if (!up) continue
      testValue = up
      suggested = up + '-Tier'
      description = `Upgrade ${f.label} from ${currentValue} to ${up}`
    } else if (f.type === 'slider') {
      const cur = Number(input[f.field])
      if (cur >= 10) continue
      const next = Math.min(10, cur + 2)
      testValue = next
      suggested = String(next)
      currentValue = String(cur)
      description = `Increase ${f.label} from ${cur} to ${next}`
    } else if (f.type === 'percent') {
      const cur = Number(input[f.field])
      if (cur >= 50) continue
      const next = Math.min(50, cur + 5)
      testValue = next
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
      testValue = input.ottRightsCr + target
      suggested = `+₹${add}Cr`
      description = `Add ₹${add}Cr in OTT rights to reach ${newTotal}Cr total pre-sales`
    } else if (f.type === 'timing' && f.field === 'marketTiming') {
      const up = timingUp(currentValue)
      if (!up) continue
      testValue = up
      suggested = up
      description = `Improve market timing from ${currentValue} to ${up}`
    } else if (f.type === 'timing' && f.field === 'releaseMonth') {
      const cur = Number(input[f.field])
      const best = monthUp(cur, stats)
      if (!best) continue
      testValue = best
      suggested = MONTHS[best] ?? String(best)
      currentValue = MONTHS[cur] ?? String(cur)
      description = `Move release from ${currentValue} to ${suggested} (higher historical WR)`
    } else if (f.type === 'overrun') {
      /* Stress test: +20% budget with pre-sales fixed — the overrun eats coverage. */
      const overrun = Math.round(input.totalBudgetCr * 1.2 * 10) / 10
      testValue = overrun
      suggested = `+20% (₹${overrun}Cr)`
      currentValue = `₹${input.totalBudgetCr}Cr`
      description = `Stress-test a 20% budget overrun with pre-sale rights unchanged`
    } else if (f.type === 'downshift') {
      /* Guidance test: −20% budget with pre-sales fixed — answers "should we cut the budget?"
         (Note: smaller budgets face higher break-even multiples, so cuts can hurt.) */
      const cut = Math.round(input.totalBudgetCr * 0.8 * 10) / 10
      if (cut <= 0) continue
      testValue = cut
      suggested = `−20% (₹${cut}Cr)`
      currentValue = `₹${input.totalBudgetCr}Cr`
      description = `Test a 20% budget cut with pre-sale rights unchanged`
    }

    if (!suggested || testValue === null) continue

    const testInput = { ...input, [f.field]: testValue }
    const modified = calculateGreenlightScore(testInput, stats)
    if (!Number.isFinite(modified.totalScore)) continue
    const gain = Math.round((modified.totalScore - base.totalScore) * 10) / 10

    /* Uniform materiality: any move shifting the score by more than half a point
       matters — upside or downside. Anything smaller is recorded as immaterial
       (tested, negligible) rather than silently dropped. */
    if (Math.abs(gain) > 0.5) {
      items.push({ label: f.label, field: f.field, currentValue, suggestedValue: suggested, potentialGain: gain, description })
    } else {
      immaterial.push({ label: f.label, detail: `${description}: ${gain >= 0 ? '+' : ''}${gain} pts — no material effect`, gain })
    }
  }

  /* All material levers are returned (gains first, risk views after) — capping at an
     arbitrary top-N silently drops real effects, which is a no-op by omission. */
  const gains = items.filter(i => i.potentialGain > 0).sort((a, b) => b.potentialGain - a.potentialGain)
  const risks = items.filter(i => i.potentialGain < 0).sort((a, b) => a.potentialGain - b.potentialGain)
  const levers = [...gains, ...risks]
  immaterial.sort((a, b) => Math.abs(b.gain) - Math.abs(a.gain))
  return { levers, immaterial: immaterial.slice(0, 4) }
}

export function analyzeSensitivities(input: EvaluationInput, stats: DatasetStats): SensitivityItem[] {
  return analyzeScenarioMoves(input, stats).levers
}

export function analyzeImmaterialMoves(input: EvaluationInput, stats: DatasetStats): ImmaterialMove[] {
  return analyzeScenarioMoves(input, stats).immaterial
}
