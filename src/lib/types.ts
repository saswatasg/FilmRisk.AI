export interface BollywoodFilm {
  film_id: string
  canonical_title: string
  display_title: string
  release_year: number
  release_month: string
  release_month_num: number
  release_date: string
  primary_genre: string
  secondary_genre: string
  all_genres: string
  sequel_flag: number
  remake_flag: number
  director: string
  lead_actor_1: string
  lead_actor_2: string
  cast_list: string
  writer_list: string
  production_house: string
  actor_rank_score: number
  actor_tier_proxy: string
  director_rank_score: number
  director_tier_proxy: string
  budget_cr: number | null
  worldwide_gross_cr: number | null
  gross_multiple: number | null
  gross_multiple_bucket: string
  budget_band: string
  box_office_source_type: string
  verdict_raw: string
  hitflop_numeric: number | null
  imdb_rating: number | null
  imdb_votes: number | null
  imdb_weighted_rating: number | null
  imdb_id: string
  runtime_min: number | null
  certificate: string
  overview: string
  model_usage: string
  financial_data_confidence: string
  metadata_confidence: string
  row_quality_score: string
  stage_allowed_greenlight: string
  source_count: number
  source_files: string
  primary_source: string
  dedupe_key: string
  notes: string
  concept_clarity_score: number | null
  novelty_score: number | null
  theatricality_score: number | null
  mass_appeal_score: number | null
  urban_appeal_score: number | null
  youth_appeal_score: number | null
  family_appeal_score: number | null
  music_dependency_score: number | null
}

export interface EvaluationInput {
  filmTitle?: string
  primaryGenre: string
  secondaryGenre?: string
  logline: string
  conceptClarity: number
  novelty: number
  director: string
  leadActor1: string
  leadActor2?: string
  directorTier?: string
  actorTier?: string
  totalBudgetCr: number
  pAndABudgetCr: number
  productionBudgetCr: number
  contingencyPercent: number
  ottRightsCr: number
  satelliteRightsCr: number
  musicRightsCr: number
  overseasRightsCr: number
  brandRevenueCr: number
  financingCostCr: number
  theatricalSharePercent: number
  recoveryMultiple: number
  isSequel: boolean
  isRemake: boolean
  hasFranchisePotential: boolean
  targetAudience: string
  marketTiming: 'strong' | 'neutral' | 'weak'
  productionHouse?: string
  productionTeamScore?: number
}

export type Verdict = 'greenlight' | 'conditional' | 'dont_invest'

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
  verdict: Verdict
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

export type DataConfidence = 'high' | 'medium' | 'low'

export interface DatasetSummary {
  totalFilms: number
  filmsWithBudget: number
  filmsWithGross: number
  dateRange: { min: number; max: number }
  genres: string[]
  verdicts: Record<string, number>
}
