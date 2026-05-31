import type { EvaluationInput, FinancialProjection, ROIScenario } from './types'

function estimateGrossMultiples(input: EvaluationInput): { pessimistic: number; base: number; optimistic: number } {
  const genreMultiples: Record<string, { p: number; b: number; o: number }> = {
    'Action':     { p: 1.5, b: 2.5, o: 4.0 },
    'Comedy':     { p: 2.0, b: 3.0, o: 5.0 },
    'Drama':      { p: 1.5, b: 2.5, o: 4.5 },
    'Romance':    { p: 1.5, b: 2.5, o: 4.0 },
    'Thriller':   { p: 1.5, b: 2.5, o: 4.0 },
    'Horror':     { p: 2.0, b: 3.5, o: 6.0 },
    'Musical':    { p: 1.0, b: 2.0, o: 3.5 },
    'Biopic':     { p: 1.5, b: 2.5, o: 4.0 },
    'Historical': { p: 1.0, b: 2.0, o: 3.5 },
    'Sci-Fi':     { p: 1.0, b: 2.0, o: 3.5 },
    'Fantasy':    { p: 1.0, b: 2.0, o: 3.5 },
    'Crime':      { p: 1.5, b: 2.5, o: 4.0 },
    'Social':     { p: 2.0, b: 3.0, o: 5.0 },
    'Family':     { p: 2.0, b: 3.5, o: 6.0 },
  }

  const base = genreMultiples[input.primaryGenre] ?? { p: 1.5, b: 2.5, o: 4.0 }

  let talentBoost = 1.0
  if (input.actorTier === 'A') talentBoost = 1.3
  else if (input.actorTier === 'B') talentBoost = 1.15

  if (input.directorTier === 'A') talentBoost += 0.15
  else if (input.directorTier === 'B') talentBoost += 0.05

  if (input.isSequel) talentBoost += 0.2

  return {
    pessimistic: parseFloat((base.p * talentBoost).toFixed(2)),
    base: parseFloat((base.b * talentBoost).toFixed(2)),
    optimistic: parseFloat((base.o * talentBoost).toFixed(2)),
  }
}

function computeNetProfit(grossCr: number, input: EvaluationInput): number {
  const totalCost = input.totalBudgetCr + (input.financingCostCr ?? 0)
  const theatricalShare = (input.theatricalSharePercent ?? 50) / 100
  const nonTheatricalRevenue =
    (input.ottRightsCr ?? 0) +
    (input.satelliteRightsCr ?? 0) +
    (input.musicRightsCr ?? 0) +
    (input.overseasRightsCr ?? 0) +
    (input.brandRevenueCr ?? 0)
  const theatricalNet = grossCr * theatricalShare
  return parseFloat((theatricalNet + nonTheatricalRevenue - totalCost).toFixed(2))
}

export function calculateFinancialProjection(input: EvaluationInput): FinancialProjection {
  const multiples = estimateGrossMultiples(input)

  const breakEvenMultiple = input.totalBudgetCr > 0
    ? parseFloat((((input.totalBudgetCr + (input.financingCostCr ?? 0)) - (
      (input.ottRightsCr ?? 0) +
      (input.satelliteRightsCr ?? 0) +
      (input.musicRightsCr ?? 0) +
      (input.overseasRightsCr ?? 0) +
      (input.brandRevenueCr ?? 0)
    )) / (input.totalBudgetCr * ((input.theatricalSharePercent ?? 50) / 100))).toFixed(2))
    : 3.0

  const safeBudgetMax = parseFloat((input.totalBudgetCr * 1.2).toFixed(1))
  const safeBudgetMin = parseFloat((input.totalBudgetCr * 0.7).toFixed(1))

  const grossMultiplier = input.recoveryMultiple > 0 ? input.recoveryMultiple : (input.totalBudgetCr > 0 ? 2.5 : 2.5)

  const scenarios: ROIScenario[] = [
    {
      label: 'Pessimistic',
      probability: '25%',
      grossCr: parseFloat((input.totalBudgetCr * multiples.pessimistic).toFixed(1)),
      multiple: multiples.pessimistic,
      netProfitCr: computeNetProfit(input.totalBudgetCr * multiples.pessimistic, input),
      roiPercent: 0,
    },
    {
      label: 'Base Case',
      probability: '50%',
      grossCr: parseFloat((input.totalBudgetCr * multiples.base).toFixed(1)),
      multiple: multiples.base,
      netProfitCr: computeNetProfit(input.totalBudgetCr * multiples.base, input),
      roiPercent: 0,
    },
    {
      label: 'Optimistic',
      probability: '25%',
      grossCr: parseFloat((input.totalBudgetCr * multiples.optimistic).toFixed(1)),
      multiple: multiples.optimistic,
      netProfitCr: computeNetProfit(input.totalBudgetCr * multiples.optimistic, input),
      roiPercent: 0,
    },
  ]

  for (const s of scenarios) {
    const totalCost = input.totalBudgetCr + (input.financingCostCr ?? 0)
    s.roiPercent = totalCost > 0
      ? parseFloat(((s.netProfitCr / totalCost) * 100).toFixed(1))
      : 0
  }

  return {
    scenarios,
    breakEvenGrossCr: parseFloat((input.totalBudgetCr * breakEvenMultiple).toFixed(1)),
    safeBudgetRange: { min: safeBudgetMin, max: safeBudgetMax },
  }
}
