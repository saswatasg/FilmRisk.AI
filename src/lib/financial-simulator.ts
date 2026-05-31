import type { EvaluationInput, FinancialProjection, ROIScenario } from './types'
import type { DatasetStats } from './dataset-stats'

export function calculateFinancialProjection(input: EvaluationInput, stats: DatasetStats): FinancialProjection {
  const p = stats.grossMultiplePercentiles
  const budget = input.totalBudgetCr

  const genreData = stats.genreStats[input.primaryGenre]
  const genreAvgMult = genreData && genreData.withGross > 0 ? genreData.avgMultiple : null

  const bandData = stats.budgetBandStats[budgetBand(budget)]
  const bandAvgMult = bandData ? bandData.avgMultiple : null

  const talentMultBoost = talentMultipleBoost(input, stats)
  const baseMultiple = genreAvgMult ?? bandAvgMult ?? p.p50

  const adjusted = {
    pessimistic: parseFloat(((genreAvgMult ?? p.p25) * 0.6).toFixed(2)),
    base: parseFloat((baseMultiple * talentMultBoost).toFixed(2)),
    optimistic: parseFloat(((genreAvgMult ?? p.p75) * 1.3 * talentMultBoost).toFixed(2)),
  }

  const totalRights =
    input.ottRightsCr + input.satelliteRightsCr + input.musicRightsCr +
    input.overseasRightsCr + input.brandRevenueCr
  const theatricalShare = input.theatricalSharePercent / 100
  const totalCost = budget + input.financingCostCr

  function computeNet(grossCr: number): number {
    const theatricalNet = grossCr * theatricalShare
    return theatricalNet + totalRights - totalCost
  }

  const scenarios: ROIScenario[] = [
    {
      label: 'Pessimistic',
      probability: '25%',
      grossCr: parseFloat((budget * adjusted.pessimistic).toFixed(1)),
      multiple: adjusted.pessimistic,
      netProfitCr: 0,
      roiPercent: 0,
    },
    {
      label: 'Base Case',
      probability: '50%',
      grossCr: parseFloat((budget * adjusted.base).toFixed(1)),
      multiple: adjusted.base,
      netProfitCr: 0,
      roiPercent: 0,
    },
    {
      label: 'Optimistic',
      probability: '25%',
      grossCr: parseFloat((budget * adjusted.optimistic).toFixed(1)),
      multiple: adjusted.optimistic,
      netProfitCr: 0,
      roiPercent: 0,
    },
  ]

  for (const s of scenarios) {
    s.netProfitCr = parseFloat(computeNet(s.grossCr).toFixed(2))
    s.roiPercent = totalCost > 0 ? parseFloat(((s.netProfitCr / totalCost) * 100).toFixed(1)) : 0
  }

  const breakEvenMult = totalCost > 0 && theatricalShare > 0
    ? parseFloat(((totalCost - totalRights) / (budget * theatricalShare)).toFixed(2))
    : 3

  return {
    scenarios,
    breakEvenGrossCr: parseFloat((budget * Math.max(1, breakEvenMult)).toFixed(1)),
    safeBudgetRange: {
      min: parseFloat((budget * 0.7).toFixed(1)),
      max: parseFloat((budget * 1.2).toFixed(1)),
    },
  }
}

function talentMultipleBoost(input: EvaluationInput, stats: DatasetStats): number {
  const at = input.actorTier
  const dt = input.directorTier
  const comboKey = `${dt}+${at}`
  const comboData = stats.comboStats[comboKey]
  const globalAvg = stats.grossMultiplePercentiles.p50

  if (comboData && comboData.count >= 3 && globalAvg > 0) {
    return parseFloat((comboData.avgMultiple / globalAvg).toFixed(2))
  }

  const actorData = stats.actorTierStats[at]
  const dirData = stats.directorTierStats[dt]
  const actorRatio = actorData && globalAvg > 0 ? actorData.avgMultiple / globalAvg : 1
  const dirRatio = dirData && globalAvg > 0 ? dirData.avgMultiple / globalAvg : 1
  return parseFloat((actorRatio * 0.45 + dirRatio * 0.55).toFixed(2))
}

function budgetBand(b: number): string {
  if (b < 10) return '<10'
  if (b < 30) return '10-30'
  if (b < 60) return '30-60'
  if (b < 100) return '60-100'
  if (b < 200) return '100-200'
  return '>200'
}
