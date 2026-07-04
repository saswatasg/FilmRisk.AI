import type { EvaluationInput, FinancialProjection, ROIScenario, MonteCarloResult } from './types'
import type { DatasetStats } from './dataset-stats'
import { budgetBand, estimatedBreakeven, BASE_SIGMA, BAND_SIGMA } from './industry-constants'

const SIMULATIONS = 10000

/* Proper lognormal: E[X] = targetMean given sigma */
function logRandom(targetMean: number, sigma: number): number {
  const mu = Math.log(Math.max(targetMean, 0.01)) - sigma * sigma / 2
  const u = Math.random() + 1e-10
  const v = Math.random() + 1e-10
  const r = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  return Math.max(0.01, Math.exp(mu + sigma * r))
}

function sampleCountSigma(stats: DatasetStats, input: EvaluationInput): number {
  const sampleSizes: number[] = []
  const gs = stats.genreStats[input.primaryGenre]
  if (gs) sampleSizes.push(gs.count)
  const band = budgetBand(input.totalBudgetCr)
  const bs = stats.budgetBandStats[band]
  if (bs) sampleSizes.push(bs.count)
  const as = stats.actorTierStats[input.actorTier]
  if (as) sampleSizes.push(as.count)
  const ds = stats.directorTierStats[input.directorTier]
  if (ds) sampleSizes.push(ds.count)
  const avgN = sampleSizes.length > 0
    ? sampleSizes.reduce((s, n) => s + n, 0) / sampleSizes.length
    : 10
  const bandSigma = BAND_SIGMA[band] ?? BASE_SIGMA
  return bandSigma * Math.sqrt(10 / Math.max(avgN, 3))
}

export function calculateFinancialProjection(input: EvaluationInput, stats: DatasetStats, greenlightScore?: number): FinancialProjection {
  const budget = input.totalBudgetCr

  const genreData = stats.genreStats[input.primaryGenre]
  const genreNormMult = genreData && genreData.weightedCount > 0 ? genreData.avgNormalizedMultiple : null

  const bandData = stats.budgetBandStats[budgetBand(budget)]
  const bandNormMult = bandData ? bandData.avgNormalizedMultiple : null

  const normBase = genreNormMult ?? bandNormMult ?? 1.0
  const be = estimatedBreakeven(budget)
  const baseMultiple = normBase * be
  const talentMultBoost = talentMultipleBoost(input, stats)

  const totalRights =
    input.ottRightsCr + input.satelliteRightsCr + input.musicRightsCr +
    input.overseasRightsCr + input.brandRevenueCr
  const theatricalShare = input.theatricalSharePercent / 100
  const totalCost = budget + input.financingCostCr

  function computeNet(grossCr: number): number {
    const theatricalNet = grossCr * theatricalShare
    return theatricalNet + totalRights - totalCost
  }

  const sigma = sampleCountSigma(stats, input)
  const outcomes: number[] = []
  const roiValues: number[] = []
  let profitCount = 0
  let mcMean = baseMultiple * talentMultBoost
  if (greenlightScore !== undefined) {
    const glNorm = greenlightScore / 100
    mcMean = mcMean * (0.3 + glNorm * 0.7)
  }

  for (let i = 0; i < SIMULATIONS; i++) {
    const mult = logRandom(mcMean, sigma)
    const grossCr = budget * mult
    const net = computeNet(grossCr)
    outcomes.push(net)
    const roi = totalCost > 0 ? (net / totalCost) * 100 : 0
    roiValues.push(roi)
    if (net > 0) profitCount++
  }

  outcomes.sort((a, b) => a - b)
  roiValues.sort((a, b) => a - b)

  function pctile(sorted: number[], pct: number): number {
    const idx = Math.floor(sorted.length * (pct / 100))
    return sorted[Math.min(idx, sorted.length - 1)]
  }

  function scenario(label: string, _pct: number, net: number): ROIScenario {
    const roi = totalCost > 0 ? (net / totalCost) * 100 : 0
    const mult = budget > 0 ? (net + totalCost - totalRights) / (budget * theatricalShare) : 0
    return {
      label,
      probability: `${_pct}%`,
      grossCr: parseFloat(((net + totalCost - totalRights) / theatricalShare).toFixed(1)),
      multiple: parseFloat(Math.max(0, mult).toFixed(2)),
      netProfitCr: parseFloat(net.toFixed(2)),
      roiPercent: parseFloat(roi.toFixed(1)),
    }
  }

  const p10 = scenario('P10', 10, pctile(outcomes, 10))
  const p25 = scenario('P25', 25, pctile(outcomes, 25))
  const p50 = scenario('Expected', 50, pctile(outcomes, 50))
  const p75 = scenario('P75', 75, pctile(outcomes, 75))
  const p90 = scenario('P90', 90, pctile(outcomes, 90))

  const scenarios: ROIScenario[] = [
    { ...p25, label: 'Pessimistic', probability: '25%' },
    { ...p50, label: 'Base Case', probability: '50%' },
    { ...p75, label: 'Optimistic', probability: '25%' },
  ]

  const expectedReturn = outcomes.reduce((s, v) => s + v, 0) / SIMULATIONS
  const expectedMult = expectedReturn > 0
    ? (expectedReturn + totalCost - totalRights) / (budget * theatricalShare)
    : 0

  const negReturns = outcomes.filter(v => v < 0)
  const downsideRisk = negReturns.length > 0
    ? Math.abs(negReturns.reduce((s, v) => s + v, 0)) / negReturns.length
    : 0

  const monteCarlo: MonteCarloResult = {
    simulations: SIMULATIONS,
    p10, p25, p50, p75, p90,
    probProfit: Math.round((profitCount / SIMULATIONS) * 100),
    expectedReturn: parseFloat(expectedReturn.toFixed(2)),
    expectedMultiple: parseFloat(Math.max(0, expectedMult).toFixed(2)),
    downsideRisk: parseFloat(downsideRisk.toFixed(2)),
  }

  const breakEvenMult = totalCost > 0 && theatricalShare > 0
    ? parseFloat(((totalCost - totalRights) / (budget * theatricalShare)).toFixed(2))
    : 3

  return {
    scenarios,
    monteCarlo,
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
