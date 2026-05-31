import type {
  EvaluationInput,
  GreenlightScoreResult,
  FinancierRiskResult,
  ScoreComponent,
  Verdict,
} from './types'

const GREENLIGHT_WEIGHTS = {
  conceptClarity: 0.10,
  novelty: 0.05,
  genreMarketFit: 0.12,
  talent: 0.12,
  budgetDiscipline: 0.20,
  preSaleCoverage: 0.15,
  contentScores: 0.10,
  marketTiming: 0.08,
  franchisePotential: 0.05,
  productionTeam: 0.03,
}

const FINANCIER_WEIGHTS = {
  capitalRecovery: 0.25,
  budgetDiscipline: 0.20,
  preSaleCoverage: 0.18,
  talentLiquidity: 0.15,
  genreRisk: 0.12,
  marketTiming: 0.05,
  contentScore: 0.05,
}

function scoreConceptClarity(input: EvaluationInput): ScoreComponent {
  const score = Math.min(input.conceptClarity, 10)
  return {
    label: 'Concept Clarity',
    score,
    maxScore: 10,
    weight: GREENLIGHT_WEIGHTS.conceptClarity,
    contribution: score * GREENLIGHT_WEIGHTS.conceptClarity,
    explanation: score >= 8
      ? 'Strong logline with clear premise and audience hook'
      : score >= 5
        ? 'Adequate concept clarity, consider sharpening the hook'
        : 'Concept needs more definition to assess market potential',
  }
}

function scoreNovelty(input: EvaluationInput): ScoreComponent {
  const baseScore = Math.min(input.novelty, 10)
  const sequelPenalty = input.isSequel ? 2 : 0
  const remakePenalty = input.isRemake ? 1 : 0
  const score = Math.max(0, baseScore - sequelPenalty - remakePenalty)
  return {
    label: 'Novelty / Originality',
    score,
    maxScore: 10,
    weight: GREENLIGHT_WEIGHTS.novelty,
    contribution: score * GREENLIGHT_WEIGHTS.novelty,
    explanation: score >= 7
      ? 'Fresh concept with original elements'
      : score >= 4
        ? 'Moderately original, some familiar elements'
        : 'Heavily derivative — higher novelty would strengthen the pitch',
  }
}

function scoreGenreMarketFit(input: EvaluationInput): ScoreComponent {
  const genreScores: Record<string, number> = {
    'Action': 7,
    'Comedy': 8,
    'Drama': 7,
    'Romance': 6,
    'Thriller': 7,
    'Horror': 5,
    'Musical': 6,
    'Biopic': 7,
    'Historical': 5,
    'Sci-Fi': 4,
    'Fantasy': 4,
    'Crime': 6,
    'Mythological': 5,
    'Social': 7,
    'Family': 8,
    'Animation': 5,
    'Documentary': 3,
  }
  const baseScore = genreScores[input.primaryGenre] ?? 5
  const budget = input.totalBudgetCr
  let score = baseScore

  if (budget > 150 && ['Social', 'Documentary', 'Horror'].includes(input.primaryGenre)) {
    score = Math.max(1, score - 3)
  }
  if (budget < 30 && ['Action', 'Sci-Fi', 'Fantasy', 'Historical'].includes(input.primaryGenre)) {
    score = Math.max(1, score - 2)
  }

  return {
    label: 'Genre-Market Fit',
    score,
    maxScore: 10,
    weight: GREENLIGHT_WEIGHTS.genreMarketFit,
    contribution: score * GREENLIGHT_WEIGHTS.genreMarketFit,
    explanation: `${input.primaryGenre} genre with ₹${budget}Cr budget — ${score >= 7 ? 'good alignment' : score >= 4 ? 'moderate fit' : 'genre-budget mismatch risk'}`,
  }
}

function scoreTalent(input: EvaluationInput): ScoreComponent {
  const tierScores: Record<string, number> = {
    'A': 9, 'B': 7, 'C': 5, 'D': 3, 'unknown': 4,
  }
  const directorScore = tierScores[input.directorTier ?? 'unknown'] ?? 4
  const actorScore = tierScores[input.actorTier ?? 'unknown'] ?? 4
  const score = Math.round((directorScore * 0.5 + actorScore * 0.5) * 10) / 10
  return {
    label: 'Talent (Director + Lead)',
    score,
    maxScore: 10,
    weight: GREENLIGHT_WEIGHTS.talent,
    contribution: score * GREENLIGHT_WEIGHTS.talent,
    explanation: `Director tier: ${input.directorTier ?? 'N/A'}, Actor tier: ${input.actorTier ?? 'N/A'}`,
  }
}

function scoreBudgetDiscipline(input: EvaluationInput): ScoreComponent {
  const productionRatio = input.totalBudgetCr > 0
    ? input.productionBudgetCr / input.totalBudgetCr
    : 0.6
  const contingencyOk = input.contingencyPercent >= 5 && input.contingencyPercent <= 15
  const idealProdRatio = 0.55
  const ratioScore = 10 - Math.abs(productionRatio - idealProdRatio) * 20
  const contingencyScore = contingencyOk ? 10 : 5
  const budgetSize = input.totalBudgetCr
  const sizeScore = budgetSize > 150 ? 5 : budgetSize > 80 ? 7 : budgetSize > 30 ? 9 : 7
  const score = Math.round((ratioScore * 0.4 + contingencyScore * 0.3 + sizeScore * 0.3) * 10) / 10
  return {
    label: 'Budget Discipline',
    score: Math.max(0, Math.min(10, score)),
    maxScore: 10,
    weight: GREENLIGHT_WEIGHTS.budgetDiscipline,
    contribution: Math.max(0, Math.min(10, score)) * GREENLIGHT_WEIGHTS.budgetDiscipline,
    explanation: `Production: ${(productionRatio * 100).toFixed(0)}% of total, Contingency: ${input.contingencyPercent}%`,
  }
}

function scorePreSaleCoverage(input: EvaluationInput): ScoreComponent {
  const totalRights =
    (input.ottRightsCr ?? 0) +
    (input.satelliteRightsCr ?? 0) +
    (input.musicRightsCr ?? 0) +
    (input.overseasRightsCr ?? 0) +
    (input.brandRevenueCr ?? 0)
  const budget = input.totalBudgetCr
  if (budget <= 0) return {
    label: 'Pre-Sale Coverage',
    score: 0, maxScore: 10, weight: GREENLIGHT_WEIGHTS.preSaleCoverage,
    contribution: 0, explanation: 'Budget not provided',
  }
  const coverageRatio = totalRights / budget
  const score = Math.min(10, coverageRatio * 10)
  return {
    label: 'Pre-Sale Coverage',
    score: Math.round(score * 10) / 10,
    maxScore: 10,
    weight: GREENLIGHT_WEIGHTS.preSaleCoverage,
    contribution: Math.round(score * 10) / 10 * GREENLIGHT_WEIGHTS.preSaleCoverage,
    explanation: `${(coverageRatio * 100).toFixed(0)}% of budget covered (₹${totalRights.toFixed(1)}Cr / ₹${budget.toFixed(1)}Cr)`,
  }
}

function scoreContentScores(input: EvaluationInput): ScoreComponent {
  const clarityWeight = parseFloat((input.conceptClarity / 10).toFixed(2))
  const noveltyWeight = parseFloat((input.novelty / 10).toFixed(2))
  const composite = Math.round((clarityWeight * 0.5 + noveltyWeight * 0.5) * 10 * 10) / 10
  return {
    label: 'Content Scores (Concept + Novelty)',
    score: Math.min(10, composite),
    maxScore: 10,
    weight: GREENLIGHT_WEIGHTS.contentScores,
    contribution: Math.min(10, composite) * GREENLIGHT_WEIGHTS.contentScores,
    explanation: `Concept: ${input.conceptClarity}/10, Novelty: ${input.novelty}/10`,
  }
}

function scoreMarketTiming(input: EvaluationInput): ScoreComponent {
  const timingScores: Record<string, number> = { strong: 9, neutral: 6, weak: 3 }
  const score = timingScores[input.marketTiming] ?? 6
  return {
    label: 'Market Timing',
    score,
    maxScore: 10,
    weight: GREENLIGHT_WEIGHTS.marketTiming,
    contribution: score * GREENLIGHT_WEIGHTS.marketTiming,
    explanation: input.marketTiming === 'strong'
      ? 'Strong market window — favorable release season and minimal competition'
      : input.marketTiming === 'neutral'
        ? 'Neutral market conditions'
        : 'Weak market window — crowded release calendar or off-season',
  }
}

function scoreFranchisePotential(input: EvaluationInput): ScoreComponent {
  let score = 3
  if (input.isSequel) score += 4
  if (input.hasFranchisePotential) score += 3
  score = Math.min(10, score)
  return {
    label: 'Franchise Potential',
    score,
    maxScore: 10,
    weight: GREENLIGHT_WEIGHTS.franchisePotential,
    contribution: score * GREENLIGHT_WEIGHTS.franchisePotential,
    explanation: input.isSequel
      ? 'Sequel with established audience base'
      : input.hasFranchisePotential
        ? 'Original concept with franchise potential'
        : 'Standalone project — limited franchise runway',
  }
}

function scoreProductionTeam(input: EvaluationInput): ScoreComponent {
  const score = input.productionTeamScore ?? 6
  return {
    label: 'Production Team',
    score: Math.max(1, Math.min(10, score)),
    maxScore: 10,
    weight: GREENLIGHT_WEIGHTS.productionTeam,
    contribution: Math.max(1, Math.min(10, score)) * GREENLIGHT_WEIGHTS.productionTeam,
    explanation: score >= 7 ? 'Experienced production team' : score >= 4 ? 'Adequate team' : 'Inexperienced team raises execution risk',
  }
}

function calculateGreenlightVerdict(totalScore: number): Verdict {
  if (totalScore >= 70) return 'greenlight'
  if (totalScore >= 45) return 'conditional'
  return 'dont_invest'
}

function calculateConfidence(input: EvaluationInput): 'high' | 'medium' | 'low' {
  const filledFields = [
    input.primaryGenre, input.logline, input.director, input.leadActor1,
  ].filter(Boolean).length
  const financialFields = [
    input.totalBudgetCr, input.pAndABudgetCr, input.productionBudgetCr,
  ].filter(v => v > 0).length
  if (filledFields >= 4 && financialFields >= 2) return 'high'
  if (filledFields >= 2) return 'medium'
  return 'low'
}

export function calculateGreenlightScore(input: EvaluationInput): GreenlightScoreResult {
  const components = [
    scoreConceptClarity(input),
    scoreNovelty(input),
    scoreGenreMarketFit(input),
    scoreTalent(input),
    scoreBudgetDiscipline(input),
    scorePreSaleCoverage(input),
    scoreContentScores(input),
    scoreMarketTiming(input),
    scoreFranchisePotential(input),
    scoreProductionTeam(input),
  ]
  const totalScore = Math.round(components.reduce((sum, c) => sum + c.contribution, 0) * 10) / 10
  return {
    totalScore,
    verdict: calculateGreenlightVerdict(totalScore),
    components,
    confidence: calculateConfidence(input),
  }
}

export function calculateFinancierRisk(input: EvaluationInput): FinancierRiskResult {
  const budgetDiscipline = scoreBudgetDiscipline(input)
  const preSale = scorePreSaleCoverage(input)
  const marketTiming = scoreMarketTiming(input)

  const capitalRecoveryScore = Math.min(10, ((input.ottRightsCr + input.satelliteRightsCr + input.musicRightsCr) / (input.totalBudgetCr || 1)) * 10)
  const talentLiquidityScore = (() => {
    const tierScores: Record<string, number> = { 'A': 9, 'B': 7, 'C': 5, 'D': 3, 'unknown': 4 }
    return tierScores[input.actorTier ?? 'unknown'] ?? 4
  })()
  const genreRiskScores: Record<string, number> = {
    'Action': 7, 'Comedy': 8, 'Drama': 7, 'Romance': 6, 'Thriller': 7,
    'Horror': 4, 'Musical': 5, 'Biopic': 6, 'Historical': 5, 'Sci-Fi': 4,
    'Fantasy': 4, 'Crime': 6, 'Social': 7, 'Family': 8,
  }
  const genreRiskScore = genreRiskScores[input.primaryGenre] ?? 5

  const contentScore = scoreContentScores(input)

  const components: ScoreComponent[] = [
    {
      label: 'Capital Recovery Probability',
      score: Math.round(capitalRecoveryScore * 10) / 10,
      maxScore: 10,
      weight: FINANCIER_WEIGHTS.capitalRecovery,
      contribution: Math.round(capitalRecoveryScore * 10) / 10 * FINANCIER_WEIGHTS.capitalRecovery,
      explanation: `${((capitalRecoveryScore / 10) * 100).toFixed(0)}% estimated recovery from pre-sold rights`,
    },
    {
      ...budgetDiscipline,
      weight: FINANCIER_WEIGHTS.budgetDiscipline,
      contribution: budgetDiscipline.score * FINANCIER_WEIGHTS.budgetDiscipline,
    },
    {
      ...preSale,
      weight: FINANCIER_WEIGHTS.preSaleCoverage,
      contribution: preSale.score * FINANCIER_WEIGHTS.preSaleCoverage,
    },
    {
      label: 'Talent Liquidity',
      score: talentLiquidityScore,
      maxScore: 10,
      weight: FINANCIER_WEIGHTS.talentLiquidity,
      contribution: talentLiquidityScore * FINANCIER_WEIGHTS.talentLiquidity,
      explanation: `${input.actorTier ?? 'N/A'}-tier lead — ${talentLiquidityScore >= 7 ? 'strong bancability' : talentLiquidityScore >= 5 ? 'moderate' : 'limited'} audience pull`,
    },
    {
      label: 'Genre Risk',
      score: genreRiskScore,
      maxScore: 10,
      weight: FINANCIER_WEIGHTS.genreRisk,
      contribution: genreRiskScore * FINANCIER_WEIGHTS.genreRisk,
      explanation: `${input.primaryGenre} — ${genreRiskScore >= 7 ? 'lower risk' : genreRiskScore >= 5 ? 'moderate risk' : 'higher risk'} genre`,
    },
    {
      ...marketTiming,
      weight: FINANCIER_WEIGHTS.marketTiming,
      contribution: marketTiming.score * FINANCIER_WEIGHTS.marketTiming,
    },
    {
      ...contentScore,
      weight: FINANCIER_WEIGHTS.contentScore,
      contribution: contentScore.score * FINANCIER_WEIGHTS.contentScore,
    },
  ]

  const riskScore = Math.round(components.reduce((sum, c) => sum + c.contribution, 0) * 10) / 10
  const invertedScore = 100 - riskScore

  const riskLevel = invertedScore >= 70 ? 'very_high'
    : invertedScore >= 50 ? 'high'
      : invertedScore >= 30 ? 'moderate'
        : 'low'

  const capitalRecoveryProb = Math.min(95, Math.round(capitalRecoveryScore * 10))

  return { riskScore, riskLevel, components, capitalRecoveryProb }
}
