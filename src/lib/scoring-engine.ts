import type { EvaluationInput, GreenlightScoreResult, FinancierRiskResult, ScoreComponent } from './types'
import type { DatasetStats } from './dataset-stats'

const W = {
  genreViability: 0.12,
  genreBudgetFit: 0.06,
  budgetFeasibility: 0.14,
  talentStrength: 0.17,
  preSaleCoverage: 0.22,
  conceptQuality: 0.10,
  marketTiming: 0.08,
  seasonality: 0.03,
  productionViability: 0.04,
  productionHouse: 0.04,
}

const FW = {
  capitalRecovery: 0.24,
  genreRisk: 0.11,
  budgetRisk: 0.14,
  genreBudgetRisk: 0.07,
  talentLiquidity: 0.13,
  conceptRisk: 0.10,
  marketTiming: 0.07,
  seasonalityRisk: 0.04,
  productionHouseRisk: 0.04,
  productionRisk: 0.06,
}

function budgetBand(b: number): string {
  if (b < 10) return '<10'
  if (b < 30) return '10-30'
  if (b < 60) return '30-60'
  if (b < 100) return '60-100'
  if (b < 200) return '100-200'
  return '>200'
}

function multScore(mult: number, cap: number = 4.0): number {
  return Math.round(Math.min(mult / cap, 1) * 10 * 10) / 10
}

function scoreGenreViability(input: EvaluationInput, stats: DatasetStats): ScoreComponent {
  const gs = stats.genreStats[input.primaryGenre]
  if (!gs || gs.count < 3) {
    return { label: 'Genre Viability', score: 5, maxScore: 10, weight: W.genreViability, contribution: 5 * W.genreViability, explanation: `${input.primaryGenre}: insufficient data` }
  }
  const score = multScore(gs.avgMultiple, 4.0)
  const trajPart = gs.trajectory ? ` (trending ${gs.trajectory})` : ''
  return {
    label: 'Genre Viability', score, maxScore: 10, weight: W.genreViability,
    contribution: score * W.genreViability, sampleSize: gs.count, trajectory: gs.trajectory,
    explanation: `${input.primaryGenre}: avg ${gs.avgMultiple}x (${gs.count} films${trajPart})`,
  }
}

function finGenreRisk(input: EvaluationInput, stats: DatasetStats): ScoreComponent {
  const gs = stats.genreStats[input.primaryGenre]
  const mult = gs ? gs.avgMultiple : 1.0
  const score = multScore(mult, 4.0)
  return {
    label: 'Genre Risk', score, maxScore: 10, weight: FW.genreRisk,
    contribution: score * FW.genreRisk, sampleSize: gs?.count ?? 0, trajectory: gs?.trajectory ?? null,
    explanation: `${input.primaryGenre}: avg ${mult.toFixed(2)}x${gs?.trajectory ? ` (trending ${gs.trajectory})` : ''}`,
  }
}

function scoreGenreBudgetFit(input: EvaluationInput, stats: DatasetStats): ScoreComponent {
  const key = `${input.primaryGenre}|${budgetBand(input.totalBudgetCr)}`
  const gb = stats.genreBudgetStats[key]
  if (!gb || gb.count < 2) {
    return { label: 'Genre-Budget Fit', score: 5, maxScore: 10, weight: W.genreBudgetFit, contribution: 5 * W.genreBudgetFit, explanation: 'No historical genre-budget combos' }
  }
  const score = multScore(gb.avgMultiple, 4.0)
  return {
    label: 'Genre-Budget Fit', score, maxScore: 10, weight: W.genreBudgetFit,
    contribution: score * W.genreBudgetFit, sampleSize: gb.count,
    explanation: `${input.primaryGenre} + ${budgetBand(input.totalBudgetCr)}: avg ${gb.avgMultiple}x (${gb.count} films)`,
  }
}

function scoreBudgetFeasibility(input: EvaluationInput, stats: DatasetStats): ScoreComponent {
  const band = budgetBand(input.totalBudgetCr)
  const bd = stats.budgetBandStats[band]
  if (!bd) {
    return { label: 'Budget Feasibility', score: 5, maxScore: 10, weight: W.budgetFeasibility, contribution: 5 * W.budgetFeasibility, explanation: `${band}: no data` }
  }
  const score = multScore(bd.avgMultiple, 3.5)
  return {
    label: 'Budget Feasibility', score, maxScore: 10, weight: W.budgetFeasibility,
    contribution: score * W.budgetFeasibility, sampleSize: bd.count,
    explanation: `₹${input.totalBudgetCr}Cr (${band}): avg ${bd.avgMultiple}x (${bd.count} films)`,
  }
}

function scoreTalentStrength(input: EvaluationInput, stats: DatasetStats): ScoreComponent {
  const comboKey = `${input.directorTier}+${input.actorTier}`
  const combo = stats.comboStats[comboKey]
  if (combo && combo.count >= 2) {
    const score = multScore(combo.avgMultiple, 4.0)
    return {
      label: 'Talent Strength', score, maxScore: 10, weight: W.talentStrength,
      contribution: score * W.talentStrength, sampleSize: combo.count,
      explanation: `${input.directorTier}+${input.actorTier}: avg ${combo.avgMultiple}x (${combo.count} films)`,
    }
  }
  const a = stats.actorTierStats[input.actorTier]
  const d = stats.directorTierStats[input.directorTier]
  const aM = a ? a.avgMultiple : 1.0
  const dM = d ? d.avgMultiple : 1.0
  const composite = aM * 0.45 + dM * 0.55
  const score = multScore(composite, 4.0)
  return {
    label: 'Talent Strength', score, maxScore: 10, weight: W.talentStrength,
    contribution: score * W.talentStrength,
    sampleSize: Math.max(a?.count ?? 0, d?.count ?? 0),
    explanation: `Dir${input.directorTier}(~${dM.toFixed(2)}x) + Act${input.actorTier}(~${aM.toFixed(2)}x)`,
  }
}

function scorePreSaleCoverage(input: EvaluationInput): ScoreComponent {
  const totalRights =
    input.ottRightsCr + input.satelliteRightsCr + input.musicRightsCr +
    input.overseasRightsCr + input.brandRevenueCr
  if (input.totalBudgetCr <= 0) {
    return { label: 'Pre-Sale Coverage', score: 0, maxScore: 10, weight: W.preSaleCoverage, contribution: 0, explanation: 'No budget provided' }
  }
  const ratio = totalRights / input.totalBudgetCr
  const score = Math.min(10, Math.round((ratio / 0.8) * 10 * 10) / 10)
  return {
    label: 'Pre-Sale Coverage', score, maxScore: 10, weight: W.preSaleCoverage,
    contribution: score * W.preSaleCoverage,
    explanation: `${Math.round(ratio * 100)}% covered (₹${totalRights.toFixed(1)}Cr / ₹${input.totalBudgetCr.toFixed(1)}Cr)`,
  }
}

function scoreConceptQuality(input: EvaluationInput): ScoreComponent {
  const composite = input.conceptClarity * 0.6 + input.novelty * 0.4
  const score = Math.round(composite * 10) / 10
  return {
    label: 'Concept Quality', score, maxScore: 10, weight: W.conceptQuality,
    contribution: score * W.conceptQuality,
    explanation: `Clarity ${input.conceptClarity}/10, Novelty ${input.novelty}/10`,
  }
}

function scoreSeasonality(input: EvaluationInput, stats: DatasetStats): ScoreComponent {
  const ms = stats.monthStats[input.releaseMonth]
  if (!ms || ms.count < 3) {
    return { label: 'Seasonality', score: 6, maxScore: 10, weight: W.seasonality, contribution: 6 * W.seasonality, explanation: `${monthName(input.releaseMonth)}: insufficient data` }
  }
  const score = multScore(ms.avgMultiple, 3.5)
  return {
    label: 'Seasonality', score, maxScore: 10, weight: W.seasonality,
    contribution: score * W.seasonality, sampleSize: ms.count,
    explanation: `${monthName(input.releaseMonth)}: avg ${ms.avgMultiple}x (${ms.count} films)`,
  }
}

function monthName(m: number): string {
  const names = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return names[m] ?? `Month ${m}`
}

function scoreMarketTiming(input: EvaluationInput): ScoreComponent {
  const scores: Record<string, number> = { strong: 9, neutral: 6, weak: 3 }
  const score = scores[input.marketTiming] ?? 6
  return {
    label: 'Market Timing', score, maxScore: 10, weight: W.marketTiming,
    contribution: score * W.marketTiming,
    explanation: input.marketTiming === 'strong' ? 'Favorable window' : input.marketTiming === 'neutral' ? 'Neutral' : 'Weak/crowded',
  }
}

function scoreProductionViability(input: EvaluationInput): ScoreComponent {
  const prodRatio = input.totalBudgetCr > 0 ? input.productionBudgetCr / input.totalBudgetCr : 0.6
  const ideal = 0.55
  const ratioScore = Math.max(0, 10 - Math.abs(prodRatio - ideal) * 25)
  const contingencyScore = input.contingencyPercent >= 5 && input.contingencyPercent <= 15 ? 10 : 4
  const score = Math.round((ratioScore * 0.5 + contingencyScore * 0.5) * 10) / 10
  return {
    label: 'Production Viability', score: Math.max(0, Math.min(10, score)), maxScore: 10,
    weight: W.productionViability,
    contribution: Math.max(0, Math.min(10, score)) * W.productionViability,
    explanation: `Production ${Math.round(prodRatio * 100)}%, contingency ${input.contingencyPercent}%`,
  }
}

function scoreProductionHouse(input: EvaluationInput, stats: DatasetStats): ScoreComponent {
  if (!input.productionHouse) return { label: 'Production House', score: 5, maxScore: 10, weight: W.productionHouse, contribution: 5 * W.productionHouse, explanation: 'No production house selected' }
  const ph = stats.productionHouseStats[input.productionHouse]
  if (!ph || ph.count < 3) {
    return { label: 'Production House', score: 5, maxScore: 10, weight: W.productionHouse, contribution: 5 * W.productionHouse, explanation: `${input.productionHouse}: insufficient data (${ph ? ph.count : 0} films)` }
  }
  const score = multScore(ph.avgMultiple, 4.0)
  return {
    label: 'Production House', score, maxScore: 10, weight: W.productionHouse,
    contribution: score * W.productionHouse, sampleSize: ph.count,
    explanation: `${input.productionHouse}: avg ${ph.avgMultiple}x (${ph.count} films)`,
  }
}

function computeConfidenceInterval(components: ScoreComponent[]): { lower: number; upper: number } {
  const sampleSizes = components.map(c => c.sampleSize ?? 0).filter(n => n > 0)
  if (sampleSizes.length < 3) return { lower: -5, upper: 5 }
  const avgN = sampleSizes.reduce((s, n) => s + n, 0) / sampleSizes.length
  const se = 10 / Math.sqrt(avgN)
  return { lower: Math.round(-1.96 * se * 10) / 10, upper: Math.round(1.96 * se * 10) / 10 }
}

export function calculateGreenlightScore(input: EvaluationInput, stats: DatasetStats): GreenlightScoreResult {
  const components = [
    scoreGenreViability(input, stats),
    scoreGenreBudgetFit(input, stats),
    scoreBudgetFeasibility(input, stats),
    scoreTalentStrength(input, stats),
    scorePreSaleCoverage(input),
    scoreConceptQuality(input),
    scoreSeasonality(input, stats),
    scoreMarketTiming(input),
    scoreProductionViability(input),
    scoreProductionHouse(input, stats),
  ]

  const raw = components.reduce((s, c) => s + c.contribution, 0)
  const totalScore = Math.round(raw * 10 * 10) / 10
  const verdict = totalScore >= 75 ? 'greenlight' : totalScore >= 50 ? 'conditional' : 'dont_invest'

  const filled = [input.primaryGenre, input.logline, input.director, input.leadActor1].filter(Boolean).length
  const finFields = [input.totalBudgetCr, input.productionBudgetCr].filter(v => v > 0).length
  const confidence = filled >= 4 && finFields >= 2 ? 'high' : filled >= 2 ? 'medium' : 'low'
  const confidenceInterval = computeConfidenceInterval(components)

  return { totalScore, verdict, components, confidence, confidenceInterval }
}

function finBudgetRisk(input: EvaluationInput, stats: DatasetStats): ScoreComponent {
  const band = budgetBand(input.totalBudgetCr)
  const bd = stats.budgetBandStats[band]
  const mult = bd ? bd.avgMultiple : 1.0
  const score = multScore(mult, 3.5)
  return {
    label: 'Budget Risk', score, maxScore: 10, weight: FW.budgetRisk,
    contribution: score * FW.budgetRisk, sampleSize: bd?.count ?? 0,
    explanation: `${band}: avg ${mult.toFixed(2)}x`,
  }
}

function finGenreBudgetRisk(input: EvaluationInput, stats: DatasetStats): ScoreComponent {
  const key = `${input.primaryGenre}|${budgetBand(input.totalBudgetCr)}`
  const gb = stats.genreBudgetStats[key]
  const mult = gb ? gb.avgMultiple : 1.0
  const score = multScore(mult, 4.0)
  return {
    label: 'Genre-Budget Risk', score, maxScore: 10, weight: FW.genreBudgetRisk,
    contribution: score * FW.genreBudgetRisk, sampleSize: gb?.count ?? 0,
    explanation: gb ? `${key}: avg ${mult.toFixed(2)}x` : 'No direct combos',
  }
}

function finTalentLiquidity(input: EvaluationInput, stats: DatasetStats): ScoreComponent {
  const a = stats.actorTierStats[input.actorTier]
  const mult = a ? a.avgMultiple : 1.0
  const score = multScore(mult, 4.0)
  return {
    label: 'Talent Liquidity', score, maxScore: 10, weight: FW.talentLiquidity,
    contribution: score * FW.talentLiquidity, sampleSize: a?.count ?? 0,
    explanation: `${input.actorTier}-tier: avg ${mult.toFixed(2)}x`,
  }
}

function finConceptRisk(input: EvaluationInput): ScoreComponent {
  const score = Math.round((input.conceptClarity * 0.5 + input.novelty * 0.3) * 10) / 10
  return {
    label: 'Concept Risk', score, maxScore: 10, weight: FW.conceptRisk,
    contribution: score * FW.conceptRisk,
    explanation: `Clarity ${input.conceptClarity}/10, Novelty ${input.novelty}/10`,
  }
}

function finSeasonalityRisk(input: EvaluationInput, stats: DatasetStats): ScoreComponent {
  const ms = stats.monthStats[input.releaseMonth]
  const mult = ms ? ms.avgMultiple : 1.5
  const score = multScore(mult, 3.5)
  return {
    label: 'Seasonality Risk', score, maxScore: 10, weight: FW.seasonalityRisk,
    contribution: score * FW.seasonalityRisk, sampleSize: ms?.count ?? 0,
    explanation: `${monthName(input.releaseMonth)}: avg ${mult.toFixed(2)}x`,
  }
}

function finProductionHouseRisk(input: EvaluationInput, stats: DatasetStats): ScoreComponent {
  if (!input.productionHouse) return { label: 'Production House Risk', score: 5, maxScore: 10, weight: FW.productionHouseRisk, contribution: 5 * FW.productionHouseRisk, explanation: 'No production house selected' }
  const ph = stats.productionHouseStats[input.productionHouse]
  if (!ph || ph.count < 3) {
    return { label: 'Production House Risk', score: 5, maxScore: 10, weight: FW.productionHouseRisk, contribution: 5 * FW.productionHouseRisk, explanation: `${input.productionHouse}: insufficient data` }
  }
  const score = multScore(ph.avgMultiple, 4.0)
  return {
    label: 'Production House Risk', score, maxScore: 10, weight: FW.productionHouseRisk,
    contribution: score * FW.productionHouseRisk, sampleSize: ph.count,
    explanation: `${input.productionHouse}: avg ${ph.avgMultiple}x (${ph.count} films)`,
  }
}

function finMarketTiming(input: EvaluationInput): ScoreComponent {
  const scores: Record<string, number> = { strong: 9, neutral: 6, weak: 3 }
  const score = scores[input.marketTiming] ?? 6
  return {
    label: 'Market Timing', score, maxScore: 10, weight: FW.marketTiming,
    contribution: score * FW.marketTiming,
    explanation: input.marketTiming,
  }
}

function finProductionRisk(input: EvaluationInput): ScoreComponent {
  const prodRatio = input.totalBudgetCr > 0 ? input.productionBudgetCr / input.totalBudgetCr : 0.6
  const score = Math.max(1, Math.min(10, Math.round((10 - Math.abs(prodRatio - 0.55) * 20) * 10) / 10))
  return {
    label: 'Production Risk', score, maxScore: 10, weight: FW.productionRisk,
    contribution: score * FW.productionRisk,
    explanation: `${Math.round(prodRatio * 100)}% production / total`,
  }
}

export function calculateFinancierRisk(input: EvaluationInput, stats: DatasetStats): FinancierRiskResult {
  const components = [
    { ...scorePreSaleCoverage(input), label: 'Capital Recovery', weight: FW.capitalRecovery },
    finGenreRisk(input, stats),
    finBudgetRisk(input, stats),
    finGenreBudgetRisk(input, stats),
    finTalentLiquidity(input, stats),
    finConceptRisk(input),
    finSeasonalityRisk(input, stats),
    finMarketTiming(input),
    finProductionHouseRisk(input, stats),
  ]

  components[0].contribution = components[0].score * FW.capitalRecovery

  const raw = components.reduce((s, c) => s + c.contribution, 0)
  const riskScore = Math.round(raw * 10 * 10) / 10
  const inverted = Math.max(0, Math.min(100, 100 - riskScore))

  const totalRights =
    input.ottRightsCr + input.satelliteRightsCr + input.musicRightsCr +
    input.overseasRightsCr + input.brandRevenueCr
  const capitalRecoveryProb = input.totalBudgetCr > 0
    ? Math.min(95, Math.round((totalRights / input.totalBudgetCr) * 100))
    : 0

  const confidenceInterval = computeConfidenceInterval(components)

  return {
    riskScore,
    riskLevel: inverted >= 70 ? 'very_high' : inverted >= 50 ? 'high' : inverted >= 30 ? 'moderate' : 'low',
    components,
    capitalRecoveryProb,
    confidenceInterval,
  }
}
