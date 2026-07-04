import type { EvaluationInput, GreenlightScoreResult, FinancierRiskResult, ScoreComponent, MarketSignalReport } from './types'
import type { DatasetStats } from './dataset-stats'
import { scoreMarketSentiment } from './market-signals'
import { predictMultiple, getModelStatus, getBayesianEstimates } from './ml-predictor'
import { budgetBand } from './industry-constants'
import { PERCENTILE_BUCKETS, BASE_PCT_THRESHOLDS } from './config'

const DATASET_COMPONENTS = new Set([
  'Genre Viability', 'Genre-Budget Fit', 'Budget Feasibility',
  'Talent Strength', 'Seasonality', 'Production House',
  'Genre Risk', 'Budget Risk', 'Genre-Budget Risk',
  'Talent Liquidity', 'Seasonality Risk', 'Production House Risk',
])

function isDatasetDerived(label: string): boolean {
  return DATASET_COMPONENTS.has(label)
}

function listEnglish(items: string[]): string {
  if (items.length === 0) return ''
  if (items.length === 1) return items[0]!
  if (items.length === 2) return `${items[0]!} and ${items[1]!}`
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]!}`
}

function ordinal(n: number): string {
  if (n >= 11 && n <= 13) return `${n}th`
  const s = n % 10
  return `${n}${s === 1 ? 'st' : s === 2 ? 'nd' : s === 3 ? 'rd' : 'th'}`
}

/* Producer weights — documented in AGENTS.md Scoring Engine */
const W = {
  genreViability: 0.14,
  genreBudgetFit: 0.07,
  budgetFeasibility: 0.16,
  talentStrength: 0.20,
  preSaleCoverage: 0.12,
  conceptQuality: 0.10,
  marketTiming: 0.06,
  seasonality: 0.05,
  productionViability: 0.03,
  productionHouse: 0.05,
  marketSentiment: 0.02,
}

/* Financier weights — documented in AGENTS.md Scoring Engine */
const FW = {
  capitalRecovery: 0.20,
  genreRisk: 0.13,
  budgetRisk: 0.16,
  genreBudgetRisk: 0.08,
  talentLiquidity: 0.15,
  conceptRisk: 0.10,
  marketTiming: 0.04,
  seasonalityRisk: 0.04,
  productionHouseRisk: 0.04,
  productionRisk: 0.04,
  marketSentiment: 0.02,
}

const SMALL_SAMPLE = 10

function shrunkenMultiple(empirical: number, count: number, prior: number, posteriorMean?: number): number {
  if (count >= SMALL_SAMPLE) return empirical
  if (posteriorMean !== undefined) return posteriorMean
  /* Empirical Bayes: weight empirical toward prior by sample size */
  const k = count / (count + 5)
  return empirical * k + prior * (1 - k)
}

function multScore(mult: number, cap: number = 3.0): number {
  return Math.round(Math.min(mult / cap, 1) * 10 * 10) / 10
}

function scoreGenreViability(input: EvaluationInput, stats: DatasetStats): ScoreComponent {
  const gs = stats.genreStats[input.primaryGenre]
  let mult: number
  let count = 0
  let explanation: string

  if (!gs || gs.count < 3) {
    const bayes = getBayesianEstimates()
    const bp = bayes?.genre[input.primaryGenre]?.mean
    mult = bp ?? 1.0
    count = 0
    explanation = `${input.primaryGenre}: bayesian prior ${mult.toFixed(2)}x`
  } else {
    mult = shrunkenMultiple(gs.avgNormalizedMultiple, gs.count, 1.0, getBayesianEstimates()?.genre[input.primaryGenre]?.mean)
    count = gs.count
    const trajPart = gs.trajectory ? ` (trending ${gs.trajectory})` : ''
    explanation = `${input.primaryGenre}: avg ${gs.avgMultiple}x raw (${gs.avgNormalizedMultiple.toFixed(2)}x break-even)${trajPart}`
  }

  /* Secondary genre boost/penalty */
  if (input.secondaryGenre) {
    const sgStats = stats.secondaryGenreStats[input.secondaryGenre]
    if (sgStats && sgStats.count >= 3) {
      const sgMult = sgStats.avgNormalizedMultiple
      /* Blend: 80% primary weight, 20% secondary weight */
      mult = mult * 0.8 + sgMult * 0.2
      explanation += ` | +${input.secondaryGenre} sub-genre ${sgMult.toFixed(2)}x`
    }
  }

  const score = multScore(mult, 3.0)
  return {
    label: 'Genre Viability', score, maxScore: 10, weight: W.genreViability,
    contribution: score * W.genreViability, sampleSize: count, trajectory: gs?.trajectory ?? null,
    explanation,
  }
}

function finGenreRisk(input: EvaluationInput, stats: DatasetStats): ScoreComponent {
  const gs = stats.genreStats[input.primaryGenre]
  const bayes = getBayesianEstimates()?.genre[input.primaryGenre]?.mean
  const rawMult = gs ? shrunkenMultiple(gs.avgNormalizedMultiple, gs.count, 1.0, bayes) : (bayes ?? 1.0)
  const mult = rawMult
  const score = multScore(mult, 3.0)
  return {
    label: 'Genre Risk', score, maxScore: 10, weight: FW.genreRisk,
    contribution: score * FW.genreRisk, sampleSize: gs?.count ?? 0, trajectory: gs?.trajectory ?? null,
    explanation: `${input.primaryGenre}: ${mult.toFixed(2)}x break-even${gs?.trajectory ? ` (trending ${gs.trajectory})` : ''}`,
  }
}

function scoreGenreBudgetFit(input: EvaluationInput, stats: DatasetStats): ScoreComponent {
  const key = `${input.primaryGenre}|${budgetBand(input.totalBudgetCr)}`
  const gb = stats.genreBudgetStats[key]
  if (!gb || gb.count < 2) {
    const gPrior = getBayesianEstimates()?.genre[input.primaryGenre]?.mean ?? 1.0
    const bPrior = getBayesianEstimates()?.budgetBand[budgetBand(input.totalBudgetCr)]?.mean ?? 1.0
    const mult = (gPrior + bPrior) / 2
    const score = multScore(mult, 3.0)
    return { label: 'Genre-Budget Fit', score, maxScore: 10, weight: W.genreBudgetFit, contribution: score * W.genreBudgetFit, explanation: `${input.primaryGenre} + ${budgetBand(input.totalBudgetCr)}: bayesian blend ${mult.toFixed(2)}x` }
  }
  const rawMult = shrunkenMultiple(gb.avgNormalizedMultiple, gb.count, 1.0)
  const score = multScore(rawMult, 3.0)
  return {
    label: 'Genre-Budget Fit', score, maxScore: 10, weight: W.genreBudgetFit,
    contribution: score * W.genreBudgetFit, sampleSize: gb.count,
    explanation: `${input.primaryGenre} + ${budgetBand(input.totalBudgetCr)}: avg ${gb.avgNormalizedMultiple.toFixed(2)}x break-even`,
  }
}

function scoreBudgetFeasibility(input: EvaluationInput, stats: DatasetStats): ScoreComponent {
  const band = budgetBand(input.totalBudgetCr)
  const bd = stats.budgetBandStats[band]
  if (!bd) {
    const bp = getBayesianEstimates()?.budgetBand[band]?.mean ?? 1.0
    const score = multScore(bp, 3.0)
    return { label: 'Budget Feasibility', score, maxScore: 10, weight: W.budgetFeasibility, contribution: score * W.budgetFeasibility, explanation: `${band}: bayesian prior ${bp.toFixed(2)}x` }
  }
  const rawMult = shrunkenMultiple(bd.avgNormalizedMultiple, bd.count, 1.0, getBayesianEstimates()?.budgetBand[band]?.mean)
  const score = multScore(rawMult, 3.0)
  return {
    label: 'Budget Feasibility', score, maxScore: 10, weight: W.budgetFeasibility,
    contribution: score * W.budgetFeasibility, sampleSize: bd.count,
    explanation: `₹${input.totalBudgetCr}Cr (${band}): avg ${bd.avgNormalizedMultiple.toFixed(2)}x break-even`,
  }
}

function scoreTalentStrength(input: EvaluationInput, stats: DatasetStats): ScoreComponent {
  const comboKey = `${input.directorTier}+${input.actorTier}`
  const combo = stats.comboStats[comboKey]
  const at = stats.actorTierStats[input.actorTier]
  const dt = stats.directorTierStats[input.directorTier]

  const rankBonus = (t: typeof at | undefined, weight: number): number => {
    if (!t || t.count < 3) return 0
    const pct = (t.avgRankScore - t.minRankScore) / Math.max(1, t.maxRankScore - t.minRankScore)
    return pct * 0.5 * weight
  }

  if (combo && combo.count >= 2) {
    const score = multScore(combo.avgNormalizedMultiple, 3.0)
    const rankAdj = rankBonus(at, 0.45) + rankBonus(dt, 0.55)
    const finalScore = Math.min(10, Math.round((score + rankAdj) * 10) / 10)
    return {
      label: 'Talent Strength', score: finalScore, maxScore: 10, weight: W.talentStrength,
      contribution: finalScore * W.talentStrength, sampleSize: combo.count,
      rankPct: Math.round(rankBonus(at, 0.45) * 20 + rankBonus(dt, 0.55) * 20),
      explanation: `${input.directorTier}+${input.actorTier}: avg ${combo.avgNormalizedMultiple.toFixed(2)}x break-even${
        rankAdj > 0 ? ` · rank ${at ? Math.round(at.avgRankScore) : '?'}/${dt ? Math.round(dt.avgRankScore) : '?'}` : ''
      }`,
    }
  }
  const aM = at ? at.avgNormalizedMultiple : 1.0
  const dM = dt ? dt.avgNormalizedMultiple : 1.0
  const composite = aM * 0.45 + dM * 0.55
  const score = multScore(composite, 3.0)
  const rankAdj = rankBonus(at, 0.45) + rankBonus(dt, 0.55)
  const finalScore = Math.min(10, Math.round((score + rankAdj) * 10) / 10)
  return {
    label: 'Talent Strength', score: finalScore, maxScore: 10, weight: W.talentStrength,
    contribution: finalScore * W.talentStrength,
    sampleSize: Math.max(at?.count ?? 0, dt?.count ?? 0),
    rankPct: Math.round(rankBonus(at, 0.45) * 20 + rankBonus(dt, 0.55) * 20),
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
  let composite = input.conceptClarity * 0.6 + input.novelty * 0.4
  let exp = `Clarity ${input.conceptClarity}/10, Novelty ${input.novelty}/10`
  if (input.sequelFlag) {
    composite = Math.min(composite + 1.5, 10)
    exp += ' | Sequel bonus +1.5'
  }
  const score = Math.round(composite * 10) / 10
  return {
    label: 'Concept Quality', score, maxScore: 10, weight: W.conceptQuality,
    contribution: score * W.conceptQuality,
    explanation: exp,
  }
}

function scoreSeasonality(input: EvaluationInput, stats: DatasetStats): ScoreComponent {
  const ms = stats.monthStats[input.releaseMonth]
  if (!ms || ms.count < 3) {
    return { label: 'Seasonality', score: 6, maxScore: 10, weight: W.seasonality, contribution: 6 * W.seasonality, explanation: `${monthName(input.releaseMonth)}: using default (6)` }
  }
  const rawMult = shrunkenMultiple(ms.avgNormalizedMultiple, ms.count, 1.0)
  const score = multScore(rawMult, 3.0)
  return {
    label: 'Seasonality', score, maxScore: 10, weight: W.seasonality,
    contribution: score * W.seasonality, sampleSize: ms.count,
    explanation: `${monthName(input.releaseMonth)}: avg ${ms.avgNormalizedMultiple.toFixed(2)}x break-even`,
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
  const score = multScore(ph.avgNormalizedMultiple, 3.0)
  return {
    label: 'Production House', score, maxScore: 10, weight: W.productionHouse,
    contribution: score * W.productionHouse, sampleSize: ph.count,
    explanation: `${input.productionHouse}: avg ${ph.avgNormalizedMultiple.toFixed(2)}x break-even`,
  }
}

function computeConfidenceInterval(components: ScoreComponent[]): { lower: number; upper: number } {
  const sampleSizes = components.map(c => c.sampleSize ?? 0).filter(n => n > 0)
  if (sampleSizes.length < 3) return { lower: -5, upper: 5 }
  const avgN = sampleSizes.reduce((s, n) => s + n, 0) / sampleSizes.length
  const se = 10 / Math.sqrt(avgN)
  return { lower: Math.round(-1.96 * se * 10) / 10, upper: Math.round(1.96 * se * 10) / 10 }
}

export function calculateGreenlightScore(input: EvaluationInput, stats: DatasetStats, marketReport?: MarketSignalReport | null): GreenlightScoreResult {
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

  if (marketReport) {
    const ms = scoreMarketSentiment(marketReport, input)
    ms.weight = W.marketSentiment
    ms.contribution = ms.score * W.marketSentiment
    components.push(ms)
  }

  /* ───── ML-enhanced prediction ───── */
  const mlPrediction = predictMultiple(input, stats)
  const modelStatus = getModelStatus()

  const raw = components.reduce((s, c) => s + (c.contribution || 0), 0)
  const totalScore = Math.round(raw * 10 * 10) / 10 || 0

  let datasetContrib = 0, userContrib = 0
  for (const c of components) {
    if (isDatasetDerived(c.label)) datasetContrib += (c.contribution || 0)
    else userContrib += (c.contribution || 0)
  }
  const adjustedRaw = datasetContrib + userContrib
  let adjustedScore = Math.round(adjustedRaw * 10 * 10) / 10 || 0

  /* Blend with ML prediction (trained on break-even-normalized target) */
  if (mlPrediction !== null) {
    const mlScore = Math.round(Math.min(mlPrediction / (3.0 / 10), 100) * 10) / 10 || 0
    adjustedScore = Math.round((adjustedScore * 0.6 + mlScore * 0.4) * 10) / 10 || 0
  }

  const realMarketPct = PERCENTILE_BUCKETS.find(([s]) => adjustedScore >= s)?.[1] ?? 1

  const band = budgetBand(input.totalBudgetCr)
  const t = BASE_PCT_THRESHOLDS[band] ?? BASE_PCT_THRESHOLDS['30-60']!
  const verdict = realMarketPct >= t.gl ? 'greenlight' : realMarketPct >= t.cond ? 'conditional' : 'dont_invest'

  const strengths = components.filter(c => c.contribution >= c.weight * 7).map(c => c.label)
  const weaknesses = components.filter(c => c.contribution < c.weight * 3.5).map(c => c.label)
  const topLever = components.reduce((best, c) =>
    c.contribution < c.weight * 6 && best.contribution / best.weight > c.contribution / c.weight ? c : best
  , components[0]!)

  /* Split adjustedScore (post-ML blend) proportionally into dataset/input components */
  const dataWeight = adjustedRaw > 0 ? datasetContrib / adjustedRaw : 0.5
  const userWeight = adjustedRaw > 0 ? userContrib / adjustedRaw : 0.5
  const evidenceScore = Math.round(adjustedScore * dataWeight * 10) / 10 || 0
  const inputScore = Math.round(adjustedScore * userWeight * 10) / 10 || 0
  const evidencePct = adjustedScore > 0 ? Math.round(dataWeight * 100) : 0

  const mlStr = mlPrediction !== null ? `ML model predicts ~${mlPrediction.toFixed(2)}× gross multiple (break-even anchored), ` : ''
  const bayesStr = modelStatus.bayes ? `Bayesian shrinkage active across ${modelStatus.filmCount}+ films. ` : ''

  const narrativeSummary = `This project scores ${adjustedScore}/100 on a break-even anchored scale. ` +
    `${mlStr}` +
    `Of the total, ${evidencePct}% of weight comes from dataset evidence (${evidenceScore}/100) and ${100 - evidencePct}% from your input assumptions. ` +
    (strengths.length > 0
      ? `Strongest areas: ${listEnglish(strengths)}. `
      : 'No component stands out as a clear strength. ') +
    (weaknesses.length > 0
      ? `Key risks: ${listEnglish(weaknesses)}. `
      : '') +
    `Biggest improvement lever: ${topLever.label}. ` +
    `${bayesStr}` +
    `Market rank: ~${ordinal(realMarketPct)} percentile vs all films.`

  for (const c of components) {
    if (c.sampleSize && c.sampleSize >= 3) {
      const se = 10 / Math.sqrt(c.sampleSize)
      c.scoreRange = {
        min: Math.max(0, Math.round((c.score - 1.96 * se) * 10) / 10),
        max: Math.min(c.maxScore, Math.round((c.score + 1.96 * se) * 10) / 10),
      }
    }
  }

  const filled = [input.primaryGenre, input.logline, input.director, input.leadActor1].filter(Boolean).length
  const finFields = [input.totalBudgetCr, input.productionBudgetCr].filter(v => v > 0).length
  const confidence = filled >= 4 && finFields >= 2 ? 'high' : filled >= 2 ? 'medium' : 'low'
  const confidenceInterval = computeConfidenceInterval(components)

  return { totalScore, adjustedScore, evidenceScore, inputScore, evidencePct, realMarketPct, verdict, components, confidence, confidenceInterval, narrativeSummary }
}

function finBudgetRisk(input: EvaluationInput, stats: DatasetStats): ScoreComponent {
  const band = budgetBand(input.totalBudgetCr)
  const bd = stats.budgetBandStats[band]
  const bayes = getBayesianEstimates()?.budgetBand[band]?.mean
  const mult = bd ? shrunkenMultiple(bd.avgNormalizedMultiple, bd.count, 1.0, bayes) : (bayes ?? 1.0)
  const score = multScore(mult, 3.0)
  return {
    label: 'Budget Risk', score, maxScore: 10, weight: FW.budgetRisk,
    contribution: score * FW.budgetRisk, sampleSize: bd?.count ?? 0,
    explanation: `${band}: avg ${mult.toFixed(2)}x break-even`,
  }
}

function finGenreBudgetRisk(input: EvaluationInput, stats: DatasetStats): ScoreComponent {
  const key = `${input.primaryGenre}|${budgetBand(input.totalBudgetCr)}`
  const gb = stats.genreBudgetStats[key]
  const gPrior = getBayesianEstimates()?.genre[input.primaryGenre]?.mean ?? 1.0
  const bPrior = getBayesianEstimates()?.budgetBand[budgetBand(input.totalBudgetCr)]?.mean ?? 1.0
  const mult = gb ? shrunkenMultiple(gb.avgNormalizedMultiple, gb.count, 1.0) : (gPrior + bPrior) / 2
  const score = multScore(mult, 3.0)
  return {
    label: 'Genre-Budget Risk', score, maxScore: 10, weight: FW.genreBudgetRisk,
    contribution: score * FW.genreBudgetRisk, sampleSize: gb?.count ?? 0,
    explanation: gb ? `${key}: avg ${mult.toFixed(2)}x break-even` : 'No direct combos',
  }
}

function finTalentLiquidity(input: EvaluationInput, stats: DatasetStats): ScoreComponent {
  const a = stats.actorTierStats[input.actorTier]
  const bayes = getBayesianEstimates()?.actorTier[input.actorTier]?.mean
  const mult = a ? shrunkenMultiple(a.avgNormalizedMultiple, a.count, 1.0, bayes) : (bayes ?? 1.0)
  const score = multScore(mult, 3.0)
  return {
    label: 'Talent Liquidity', score, maxScore: 10, weight: FW.talentLiquidity,
    contribution: score * FW.talentLiquidity, sampleSize: a?.count ?? 0,
    explanation: `${input.actorTier}-tier: avg ${mult.toFixed(2)}x break-even`,
  }
}

function finSeasonalityRisk(input: EvaluationInput, stats: DatasetStats): ScoreComponent {
  const ms = stats.monthStats[input.releaseMonth]
  const mult = ms ? shrunkenMultiple(ms.avgNormalizedMultiple, ms.count, 1.0) : 1.0
  const score = multScore(mult, 3.0)
  return {
    label: 'Seasonality Risk', score, maxScore: 10, weight: FW.seasonalityRisk,
    contribution: score * FW.seasonalityRisk, sampleSize: ms?.count ?? 0,
    explanation: `${monthName(input.releaseMonth)}: avg ${mult.toFixed(2)}x break-even`,
  }
}

function finProductionHouseRisk(input: EvaluationInput, stats: DatasetStats): ScoreComponent {
  if (!input.productionHouse) return { label: 'Production House Risk', score: 5, maxScore: 10, weight: FW.productionHouseRisk, contribution: 5 * FW.productionHouseRisk, explanation: 'No production house selected' }
  const ph = stats.productionHouseStats[input.productionHouse]
  if (!ph || ph.count < 3) {
    return { label: 'Production House Risk', score: 5, maxScore: 10, weight: FW.productionHouseRisk, contribution: 5 * FW.productionHouseRisk, explanation: `${input.productionHouse}: insufficient data` }
  }
  const score = multScore(ph.avgNormalizedMultiple, 3.0)
  return {
    label: 'Production House Risk', score, maxScore: 10, weight: FW.productionHouseRisk,
    contribution: score * FW.productionHouseRisk, sampleSize: ph.count,
    explanation: `${input.productionHouse}: avg ${ph.avgNormalizedMultiple.toFixed(2)}x break-even`,
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

export function calculateFinancierRisk(input: EvaluationInput, stats: DatasetStats, marketReport?: MarketSignalReport | null): FinancierRiskResult {
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

  if (marketReport) {
    const ms = scoreMarketSentiment(marketReport, input)
    ms.weight = FW.marketSentiment
    ms.contribution = ms.score * FW.marketSentiment
    components.push(ms)
  }

  components[0]!.contribution = components[0]!.score * FW.capitalRecovery

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
