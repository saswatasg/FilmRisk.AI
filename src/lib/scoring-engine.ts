import type { EvaluationInput, GreenlightScoreResult, FinancierRiskResult, ScoreComponent } from './types'
import type { DatasetStats } from './dataset-stats'

const W = {
  genreViability: 0.13,
  genreBudgetFit: 0.07,
  budgetFeasibility: 0.18,
  talentStrength: 0.16,
  preSaleCoverage: 0.22,
  conceptQuality: 0.10,
  marketTiming: 0.07,
  productionViability: 0.07,
}

const FW = {
  capitalRecovery: 0.25,
  genreRisk: 0.12,
  budgetRisk: 0.15,
  genreBudgetRisk: 0.08,
  talentLiquidity: 0.15,
  conceptRisk: 0.10,
  marketTiming: 0.08,
  productionRisk: 0.07,
}

function budgetBand(b: number): string {
  if (b < 10) return '<10'
  if (b < 30) return '10-30'
  if (b < 60) return '30-60'
  if (b < 100) return '60-100'
  if (b < 200) return '100-200'
  return '>200'
}

function scoreGenreViability(input: EvaluationInput, stats: DatasetStats): ScoreComponent {
  const gs = stats.genreStats[input.primaryGenre]
  if (!gs || gs.count < 3) {
    return { label: 'Genre Viability', score: 5, maxScore: 10, weight: W.genreViability, contribution: 5 * W.genreViability, explanation: `${input.primaryGenre}: insufficient data` }
  }
  const wr = gs.adjustedWinRatePct
  const score = Math.round(Math.min(wr, 80) / 80 * 10 * 10) / 10
  return {
    label: 'Genre Viability', score, maxScore: 10, weight: W.genreViability,
    contribution: score * W.genreViability,
    explanation: `${input.primaryGenre}: ${gs.winRatePct}% raw → ${wr}% adjusted (${gs.count} films, avg ${gs.avgMultiple}x)`,
  }
}

function scoreGenreBudgetFit(input: EvaluationInput, stats: DatasetStats): ScoreComponent {
  const key = `${input.primaryGenre}|${budgetBand(input.totalBudgetCr)}`
  const gb = stats.genreBudgetStats[key]
  if (!gb || gb.count < 2) {
    return { label: 'Genre-Budget Fit', score: 5, maxScore: 10, weight: W.genreBudgetFit, contribution: 5 * W.genreBudgetFit, explanation: 'No historical genre-budget combos' }
  }
  const wr = gb.adjustedWinRatePct
  const score = Math.round(Math.min(wr, 85) / 85 * 10 * 10) / 10
  return {
    label: 'Genre-Budget Fit', score, maxScore: 10, weight: W.genreBudgetFit,
    contribution: score * W.genreBudgetFit,
    explanation: `${input.primaryGenre} + ${budgetBand(input.totalBudgetCr)}: ${gb.adjustedWinRatePct}% adjusted WR (${gb.count} films)`,
  }
}

function scoreBudgetFeasibility(input: EvaluationInput, stats: DatasetStats): ScoreComponent {
  const band = budgetBand(input.totalBudgetCr)
  const bd = stats.budgetBandStats[band]
  if (!bd) {
    return { label: 'Budget Feasibility', score: 5, maxScore: 10, weight: W.budgetFeasibility, contribution: 5 * W.budgetFeasibility, explanation: `${band}: no data` }
  }
  const wr = bd.adjustedWinRatePct
  const score = Math.round(Math.min(wr, 75) / 75 * 10 * 10) / 10
  return {
    label: 'Budget Feasibility', score, maxScore: 10, weight: W.budgetFeasibility,
    contribution: score * W.budgetFeasibility,
    explanation: `₹${input.totalBudgetCr}Cr (${band}): ${bd.winRatePct}% raw → ${wr}% adjusted (${bd.count} films)`,
  }
}

function scoreTalentStrength(input: EvaluationInput, stats: DatasetStats): ScoreComponent {
  const comboKey = `${input.directorTier}+${input.actorTier}`
  const combo = stats.comboStats[comboKey]
  if (combo && combo.count >= 2) {
    const wr = combo.adjustedWinRatePct
    const score = Math.round(Math.min(wr, 90) / 90 * 10 * 10) / 10
    return {
      label: 'Talent Strength', score, maxScore: 10, weight: W.talentStrength,
      contribution: score * W.talentStrength,
      explanation: `${input.directorTier}+${input.actorTier}: ${combo.winRatePct}% → ${wr}% adjusted (${combo.count} films)`,
    }
  }
  const a = stats.actorTierStats[input.actorTier]
  const d = stats.directorTierStats[input.directorTier]
  const aWR = a ? a.adjustedWinRatePct : 25
  const dWR = d ? d.adjustedWinRatePct : 25
  const composite = Math.round(aWR * 0.55 + dWR * 0.45)
  const score = Math.round(Math.min(composite, 80) / 80 * 10 * 10) / 10
  return {
    label: 'Talent Strength', score, maxScore: 10, weight: W.talentStrength,
    contribution: score * W.talentStrength,
    explanation: `Dir${input.directorTier}(~${dWR}%) + Act${input.actorTier}(~${aWR}%)`,
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

export function calculateGreenlightScore(input: EvaluationInput, stats: DatasetStats): GreenlightScoreResult {
  const components = [
    scoreGenreViability(input, stats),
    scoreGenreBudgetFit(input, stats),
    scoreBudgetFeasibility(input, stats),
    scoreTalentStrength(input, stats),
    scorePreSaleCoverage(input),
    scoreConceptQuality(input),
    scoreMarketTiming(input),
    scoreProductionViability(input),
  ]

  const raw = components.reduce((s, c) => s + c.contribution, 0)
  const totalScore = Math.round(raw * 10 * 10) / 10
  const verdict = totalScore >= 75 ? 'greenlight' : totalScore >= 50 ? 'conditional' : 'dont_invest'

  const filled = [input.primaryGenre, input.logline, input.director, input.leadActor1].filter(Boolean).length
  const finFields = [input.totalBudgetCr, input.productionBudgetCr].filter(v => v > 0).length
  const confidence = filled >= 4 && finFields >= 2 ? 'high' : filled >= 2 ? 'medium' : 'low'

  return { totalScore, verdict, components, confidence }
}

function finGenreRisk(input: EvaluationInput, stats: DatasetStats): ScoreComponent {
  const gs = stats.genreStats[input.primaryGenre]
  const wr = gs ? gs.adjustedWinRatePct : 30
  const score = Math.round(Math.min(wr, 75) / 75 * 10 * 10) / 10
  return {
    label: 'Genre Risk', score, maxScore: 10, weight: FW.genreRisk,
    contribution: score * FW.genreRisk,
    explanation: `${input.primaryGenre}: ${wr}% adjusted recovery rate`,
  }
}

function finBudgetRisk(input: EvaluationInput, stats: DatasetStats): ScoreComponent {
  const band = budgetBand(input.totalBudgetCr)
  const bd = stats.budgetBandStats[band]
  const wr = bd ? bd.adjustedWinRatePct : 30
  const inverted = Math.round(Math.min(100 - wr, 85) / 85 * 10 * 10) / 10
  return {
    label: 'Budget Risk', score: 10 - inverted, maxScore: 10, weight: FW.budgetRisk,
    contribution: (10 - inverted) * FW.budgetRisk,
    explanation: `${band}: ${wr}% adjusted WR — ${wr >= 40 ? 'lower' : 'higher'} risk`,
  }
}

function finGenreBudgetRisk(input: EvaluationInput, stats: DatasetStats): ScoreComponent {
  const key = `${input.primaryGenre}|${budgetBand(input.totalBudgetCr)}`
  const gb = stats.genreBudgetStats[key]
  const wr = gb ? gb.adjustedWinRatePct : 30
  const score = Math.round(Math.min(wr, 75) / 75 * 10 * 10) / 10
  return {
    label: 'Genre-Budget Risk', score, maxScore: 10, weight: FW.genreBudgetRisk,
    contribution: score * FW.genreBudgetRisk,
    explanation: gb ? `${key}: ${wr}% adjusted WR` : 'No direct combos',
  }
}

function finTalentLiquidity(input: EvaluationInput, stats: DatasetStats): ScoreComponent {
  const a = stats.actorTierStats[input.actorTier]
  const wr = a ? a.adjustedWinRatePct : 25
  const score = Math.round(Math.min(wr, 80) / 80 * 10 * 10) / 10
  return {
    label: 'Talent Liquidity', score, maxScore: 10, weight: FW.talentLiquidity,
    contribution: score * FW.talentLiquidity,
    explanation: `${input.actorTier}-tier: ${wr}% adjusted WR`,
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
    finMarketTiming(input),
    finProductionRisk(input),
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

  return {
    riskScore,
    riskLevel: inverted >= 70 ? 'very_high' : inverted >= 50 ? 'high' : inverted >= 30 ? 'moderate' : 'low',
    components,
    capitalRecoveryProb,
  }
}
