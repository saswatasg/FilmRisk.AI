export interface BollywoodFilm {
  film_id: string
  canonical_title: string
  display_title: string
  release_year: number
  primary_genre: string
  director: string
  lead_actor_1: string
  lead_actor_2: string
  production_house: string
  actor_rank_score: number | null
  actor_tier_proxy: string
  director_rank_score: number | null
  director_tier_proxy: string
  budget_cr: number | null
  worldwide_gross_cr: number | null
  gross_multiple: number | null
  verdict_raw: string
  hitflop_numeric: number | null
  imdb_rating: number | null
  imdb_votes: number | null
  runtime_min: number | null
  model_usage: string
  financial_data_confidence: string
}

export interface EvaluationInput {
  filmTitle: string
  primaryGenre: string
  logline: string
  conceptClarity: number
  novelty: number
  director: string
  leadActor1: string
  directorTier: string
  actorTier: string
  totalBudgetCr: number
  productionBudgetCr: number
  pAndABudgetCr: number
  contingencyPercent: number
  ottRightsCr: number
  satelliteRightsCr: number
  musicRightsCr: number
  overseasRightsCr: number
  brandRevenueCr: number
  financingCostCr: number
  theatricalSharePercent: number
  marketTiming: 'strong' | 'neutral' | 'weak'
}

export interface ScoreComponent {
  label: string
  score: number
  maxScore: number
  weight: number
  contribution: number
  explanation: string
}

export interface GreenlightScoreResult {
  totalScore: number
  verdict: 'greenlight' | 'conditional' | 'dont_invest'
  components: ScoreComponent[]
  confidence: 'high' | 'medium' | 'low'
}

export interface FinancierRiskResult {
  riskScore: number
  riskLevel: 'low' | 'moderate' | 'high' | 'very_high'
  components: ScoreComponent[]
  capitalRecoveryProb: number
}

export interface ComparableFilm {
  film: BollywoodFilm
  similarityScore: number
  matchDetails: Record<string, number>
}

export interface ComparableResult {
  films: ComparableFilm[]
  querySummary: string
}

export interface ROIScenario {
  label: string
  probability: string
  grossCr: number
  multiple: number
  netProfitCr: number
  roiPercent: number
}

export interface FinancialProjection {
  scenarios: ROIScenario[]
  breakEvenGrossCr: number
  safeBudgetRange: { min: number; max: number }
}

export interface RiskFactor {
  factor: string
  severity: 'low' | 'moderate' | 'high' | 'critical'
  description: string
  mitigation: string
}

export interface RiskDiagnosis {
  overallRisk: 'low' | 'moderate' | 'high' | 'very_high'
  factors: RiskFactor[]
  topRecommendations: string[]
}

export interface EvaluationResult {
  projectSummary: {
    title: string
    genre: string
    director: string
    leadActor: string
    totalBudgetCr: number
  }
  greenlight: GreenlightScoreResult
  financierRisk: FinancierRiskResult
  comparableFilms: ComparableResult
  financialProjection: FinancialProjection
  riskDiagnosis: RiskDiagnosis
  timestamp: string
}

export interface DatasetSummary {
  totalFilms: number
  filmsWithBudget: number
  filmsWithGross: number
  dateRange: { min: number; max: number }
  genres: string[]
  verdicts: Record<string, number>
}
