import type { EvaluationInput, GreenlightScoreResult, FinancierRiskResult, ScoreComponent } from './types'
import type { DatasetStats } from './dataset-stats'

const GREENLIGHT_WEIGHTS = {
  genreViability: 0.15,
  budgetFeasibility: 0.20,
  talentStrength: 0.18,
  preSaleCoverage: 0.20,
  conceptQuality: 0.12,
  marketTiming: 0.08,
  productionViability: 0.07,
}

const FINANCIER_WEIGHTS = {
  capitalRecovery: 0.25,
  genreRisk: 0.18,
  budgetRisk: 0.17,
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
  const genreData = stats.genreStats[input.primaryGenre]
  if (!genreData || genreData.count < 3) {
    return {
      label: 'Genre Viability',
      score: 5, maxScore: 10, weight: GREENLIGHT_WEIGHTS.genreViability,
      contribution: 5 * GREENLIGHT_WEIGHTS.genreViability,
      explanation: `${input.primaryGenre}: insufficient data for historical analysis — neutral score`,
    }
  }

  const budget = input.totalBudgetCr
  const band = budgetBand(budget)
  const bandData = stats.budgetBandStats[band]
  const bandWinRate = bandData ? bandData.winRatePct : 30

  const genreWinRate = genreData.withGross > 0
    ? Math.round((genreData.withGross > 0 ? 1 : 0) * 100)
    : 30

  const genreFilmsWithMult = genreData.withGross
  const winners = genreData.avgMultiple >= 1.5 ? Math.round(genreFilmsWithMult * 0.4) : Math.round(genreFilmsWithMult * 0.2)
  const winRate = genreFilmsWithMult > 0 ? Math.round((winners / genreFilmsWithMult) * 100) : 30

  const score = Math.round((Math.min(winRate, 90) / 90) * 10 * 10) / 10
  return {
    label: 'Genre Viability',
    score,
    maxScore: 10,
    weight: GREENLIGHT_WEIGHTS.genreViability,
    contribution: score * GREENLIGHT_WEIGHTS.genreViability,
    explanation: `${input.primaryGenre}: ~${winRate}% historical win rate (${genreFilmsWithMult} films), avg budget ₹${genreData.avgBudget}Cr, avg ${genreData.avgMultiple}x — ${score >= 7 ? 'strong genre' : score >= 4 ? 'moderate' : 'weak'} historical returns`,
  }
}

function scoreBudgetFeasibility(input: EvaluationInput, stats: DatasetStats): ScoreComponent {
  const band = budgetBand(input.totalBudgetCr)
  const bandData = stats.budgetBandStats[band]

  if (!bandData) {
    return {
      label: 'Budget Feasibility',
      score: 5, maxScore: 10, weight: GREENLIGHT_WEIGHTS.budgetFeasibility,
      contribution: 5 * GREENLIGHT_WEIGHTS.budgetFeasibility,
      explanation: 'No historical data for this budget band',
    }
  }

  const winRate = bandData.winRatePct
  const score = Math.round((Math.min(winRate, 80) / 80) * 10 * 10) / 10
  return {
    label: 'Budget Feasibility',
    score,
    maxScore: 10,
    weight: GREENLIGHT_WEIGHTS.budgetFeasibility,
    contribution: score * GREENLIGHT_WEIGHTS.budgetFeasibility,
    explanation: `₹${input.totalBudgetCr}Cr (${band} band): ~${winRate}% historical success rate (${bandData.count} films, avg ${bandData.avgMultiple}x) — ${score >= 7 ? 'well-calibrated' : score >= 4 ? 'adequate' : 'tight budget band'}`,
  }
}

function scoreTalentStrength(input: EvaluationInput, stats: DatasetStats): ScoreComponent {
  const at = input.actorTier
  const dt = input.directorTier
  const comboKey = `${dt}+${at}`
  const comboData = stats.comboStats[comboKey]

  if (comboData && comboData.count >= 3) {
    const score = Math.round((Math.min(comboData.winRatePct, 95) / 95) * 10 * 10) / 10
    return {
      label: 'Talent Strength',
      score,
      maxScore: 10,
      weight: GREENLIGHT_WEIGHTS.talentStrength,
      contribution: score * GREENLIGHT_WEIGHTS.talentStrength,
      explanation: `${dt}-tier director + ${at}-tier actor: ${comboData.winRatePct}% win rate (${comboData.count} films, avg ${comboData.avgMultiple}x)`,
    }
  }

  const actorData = stats.actorTierStats[at]
  const dirData = stats.directorTierStats[dt]
  const actorWR = actorData ? actorData.winRatePct : 30
  const dirWR = dirData ? dirData.winRatePct : 30
  const compositeWR = Math.round(actorWR * 0.55 + dirWR * 0.45)
  const score = Math.round((Math.min(compositeWR, 90) / 90) * 10 * 10) / 10
  return {
    label: 'Talent Strength',
    score,
    maxScore: 10,
    weight: GREENLIGHT_WEIGHTS.talentStrength,
    contribution: score * GREENLIGHT_WEIGHTS.talentStrength,
    explanation: `${dt}-tier director (~${dirWR}% WR) + ${at}-tier actor (~${actorWR}% WR)`,
  }
}

function scorePreSaleCoverage(input: EvaluationInput): ScoreComponent {
  const totalRights =
    input.ottRightsCr + input.satelliteRightsCr + input.musicRightsCr +
    input.overseasRightsCr + input.brandRevenueCr
  const budget = input.totalBudgetCr
  if (budget <= 0) return {
    label: 'Pre-Sale Coverage',
    score: 0, maxScore: 10, weight: GREENLIGHT_WEIGHTS.preSaleCoverage,
    contribution: 0, explanation: 'Budget not provided',
  }
  const ratio = totalRights / budget
  const score = Math.min(10, Math.round((ratio / 0.8) * 10 * 10) / 10)
  return {
    label: 'Pre-Sale Coverage',
    score,
    maxScore: 10,
    weight: GREENLIGHT_WEIGHTS.preSaleCoverage,
    contribution: score * GREENLIGHT_WEIGHTS.preSaleCoverage,
    explanation: `${Math.round(ratio * 100)}% covered (₹${totalRights.toFixed(1)}Cr / ₹${budget.toFixed(1)}Cr) — ${score >= 8 ? 'strong coverage' : score >= 5 ? 'moderate' : 'low coverage risk'}`,
  }
}

function scoreConceptQuality(input: EvaluationInput): ScoreComponent {
  const composite = (input.conceptClarity * 0.6 + input.novelty * 0.4)
  const score = Math.round(composite * 10) / 10
  return {
    label: 'Concept Quality',
    score,
    maxScore: 10,
    weight: GREENLIGHT_WEIGHTS.conceptQuality,
    contribution: score * GREENLIGHT_WEIGHTS.conceptQuality,
    explanation: `Clarity: ${input.conceptClarity}/10, Novelty: ${input.novelty}/10 — ${score >= 7 ? 'strong pitch' : score >= 4 ? 'needs refinement' : 'weak concept foundation'}`,
  }
}

function scoreMarketTiming(input: EvaluationInput): ScoreComponent {
  const scores: Record<string, number> = { strong: 9, neutral: 6, weak: 3 }
  const score = scores[input.marketTiming] ?? 6
  return {
    label: 'Market Timing',
    score,
    maxScore: 10,
    weight: GREENLIGHT_WEIGHTS.marketTiming,
    contribution: score * GREENLIGHT_WEIGHTS.marketTiming,
    explanation: input.marketTiming === 'strong' ? 'Favorable release window'
      : input.marketTiming === 'neutral' ? 'Neutral market conditions'
      : 'Crowded release calendar or off-season',
  }
}

function scoreProductionViability(input: EvaluationInput): ScoreComponent {
  const prodRatio = input.totalBudgetCr > 0
    ? input.productionBudgetCr / input.totalBudgetCr
    : 0.6
  const ideal = 0.55
  const ratioScore = Math.max(0, 10 - Math.abs(prodRatio - ideal) * 25)
  const contingencyScore = input.contingencyPercent >= 5 && input.contingencyPercent <= 15 ? 10 : 4
  const score = Math.round((ratioScore * 0.5 + contingencyScore * 0.5) * 10) / 10
  return {
    label: 'Production Viability',
    score: Math.max(0, Math.min(10, score)),
    maxScore: 10,
    weight: GREENLIGHT_WEIGHTS.productionViability,
    contribution: Math.max(0, Math.min(10, score)) * GREENLIGHT_WEIGHTS.productionViability,
    explanation: `Production ${Math.round(prodRatio * 100)}% of total, contingency ${input.contingencyPercent}%`,
  }
}

export function calculateGreenlightScore(input: EvaluationInput, stats: DatasetStats): GreenlightScoreResult {
  const components = [
    scoreGenreViability(input, stats),
    scoreBudgetFeasibility(input, stats),
    scoreTalentStrength(input, stats),
    scorePreSaleCoverage(input),
    scoreConceptQuality(input),
    scoreMarketTiming(input),
    scoreProductionViability(input),
  ]

  const totalScore = Math.round(components.reduce((s, c) => s + c.contribution, 0) * 10) / 10
  const verdict = totalScore >= 70 ? 'greenlight' : totalScore >= 45 ? 'conditional' : 'dont_invest'

  const filled = [input.primaryGenre, input.logline, input.director, input.leadActor1].filter(Boolean).length
  const finFields = [input.totalBudgetCr, input.pAndABudgetCr, input.productionBudgetCr].filter(v => v > 0).length
  const confidence = filled >= 4 && finFields >= 2 ? 'high' : filled >= 2 ? 'medium' : 'low'

  return { totalScore, verdict, components, confidence }
}

function finScoreGenreRisk(input: EvaluationInput, stats: DatasetStats): ScoreComponent {
  const gs = stats.genreStats[input.primaryGenre]
  const genreWR = gs && gs.withGross > 0
    ? Math.round((gs.withGross > 0 ? (gs.avgMultiple >= 1.5 ? 0.5 : 0.3) : 0.3) * 100)
    : 30
  const score = Math.round((Math.min(genreWR, 80) / 80) * 10 * 10) / 10
  return {
    label: 'Genre Risk',
    score,
    maxScore: 10,
    weight: FINANCIER_WEIGHTS.genreRisk,
    contribution: score * FINANCIER_WEIGHTS.genreRisk,
    explanation: `${input.primaryGenre}: ~${genreWR}% recovery probability from historical data`,
  }
}

function finScoreBudgetRisk(input: EvaluationInput, stats: DatasetStats): ScoreComponent {
  const band = budgetBand(input.totalBudgetCr)
  const bd = stats.budgetBandStats[band]
  const winRate = bd ? bd.winRatePct : 30
  const invertedScore = Math.round((Math.min(100 - winRate, 90) / 90) * 10 * 10) / 10
  return {
    label: 'Budget Risk',
    score: 10 - invertedScore,
    maxScore: 10,
    weight: FINANCIER_WEIGHTS.budgetRisk,
    contribution: (10 - invertedScore) * FINANCIER_WEIGHTS.budgetRisk,
    explanation: `${band} band: ${winRate}% success rate — ${winRate >= 50 ? 'lower risk' : 'higher risk'} band`,
  }
}

function finScoreTalentLiquidity(input: EvaluationInput, stats: DatasetStats): ScoreComponent {
  const at = input.actorTier
  const actorData = stats.actorTierStats[at]
  const score = actorData
    ? Math.round((Math.min(actorData.winRatePct, 90) / 90) * 10 * 10) / 10
    : 4
  return {
    label: 'Talent Liquidity',
    score,
    maxScore: 10,
    weight: FINANCIER_WEIGHTS.talentLiquidity,
    contribution: score * FINANCIER_WEIGHTS.talentLiquidity,
    explanation: `${at}-tier actor: ~${actorData?.winRatePct ?? '?'}% historical project success rate`,
  }
}

function finScoreConceptRisk(input: EvaluationInput): ScoreComponent {
  const score = Math.round((input.conceptClarity * 0.5 + input.novelty * 0.3) * 10) / 10
  return {
    label: 'Concept Risk',
    score,
    maxScore: 10,
    weight: FINANCIER_WEIGHTS.conceptRisk,
    contribution: score * FINANCIER_WEIGHTS.conceptRisk,
    explanation: `Concept clarity ${input.conceptClarity}/10, novelty ${input.novelty}/10`,
  }
}

function finScoreMarketTiming(input: EvaluationInput): ScoreComponent {
  const scores: Record<string, number> = { strong: 9, neutral: 6, weak: 3 }
  const score = scores[input.marketTiming] ?? 6
  return {
    label: 'Market Timing',
    score,
    maxScore: 10,
    weight: FINANCIER_WEIGHTS.marketTiming,
    contribution: score * FINANCIER_WEIGHTS.marketTiming,
    explanation: input.marketTiming === 'strong' ? 'Strong window' : input.marketTiming === 'neutral' ? 'Neutral' : 'Weak window',
  }
}

function finScoreProductionRisk(input: EvaluationInput): ScoreComponent {
  const prodRatio = input.totalBudgetCr > 0 ? input.productionBudgetCr / input.totalBudgetCr : 0.6
  const ideal = 0.55
  const score = Math.max(1, Math.min(10, Math.round((10 - Math.abs(prodRatio - ideal) * 20) * 10) / 10))
  return {
    label: 'Production Risk',
    score,
    maxScore: 10,
    weight: FINANCIER_WEIGHTS.productionRisk,
    contribution: score * FINANCIER_WEIGHTS.productionRisk,
    explanation: `${Math.round(prodRatio * 100)}% production / total ratio`,
  }
}

export function calculateFinancierRisk(input: EvaluationInput, stats: DatasetStats): FinancierRiskResult {
  const components = [
    scorePreSaleCoverage(input),
    finScoreGenreRisk(input, stats),
    finScoreBudgetRisk(input, stats),
    finScoreTalentLiquidity(input, stats),
    finScoreConceptRisk(input),
    finScoreMarketTiming(input),
    finScoreProductionRisk(input),
  ]

  components[0].weight = FINANCIER_WEIGHTS.capitalRecovery
  components[0].contribution = components[0].score * FINANCIER_WEIGHTS.capitalRecovery

  const riskScore = Math.round(components.reduce((s, c) => s + c.contribution, 0) * 10) / 10
  const inverted = 100 - riskScore

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
