/* ───────── ML model pipeline: trains GBRT + Bayesian model from dataset ───────── */

import type { BollywoodFilm, EvaluationInput } from './types'
import type { DatasetStats } from './dataset-stats'
import { trainGBM, predictGBM, featureImportance, extractFeatures, crossValidateGBM, attributeGBM, type GBMConfig } from './gbm-model'
import { computeBayesianEstimates, type BayesianEstimates } from './bayesian-model'
import { normalizedMultiple } from './industry-constants'

let trainedGBM: GBMConfig | null = null
let trainedBayes: BayesianEstimates | null = null
let trainingCount = 0

export function trainModels(films: BollywoodFilm[]): void {
  const withData = films.filter(f =>
    f.budget_cr !== null && f.budget_cr > 0 &&
    f.gross_multiple !== null && f.gross_multiple > 0 &&
    !f.is_imputed_finance
  )
  trainingCount = withData.length

  if (withData.length >= 50) {
    const X = withData.map(f => extractFeatures(f))
    const y = withData.map(f => normalizedMultiple(f.gross_multiple!, f.budget_cr!, f.release_year))
    const years = withData.map(f => f.release_year ?? 2000)

    const { bestParams } = crossValidateGBM(X, y, years, {
      nEstimators: [100, 200, 300],
      maxDepth: [3, 4, 5, 6],
      learningRate: [0.05, 0.08, 0.1],
    })
    trainedGBM = trainGBM(X, y, bestParams)
  }

  trainedBayes = computeBayesianEstimates(films.filter(f => f.gross_multiple !== null && f.gross_multiple > 0 && !f.is_imputed_finance).map(f => ({
    gross_multiple: f.gross_multiple,
    primary_genre: f.primary_genre,
    actor_tier_proxy: f.actor_tier_proxy,
    director_tier_proxy: f.director_tier_proxy,
    budget_cr: f.budget_cr,
    release_month_num: f.release_month_num,
  })))
}

export function getModelStatus(): { gbm: boolean; bayes: boolean; filmCount: number } {
  return {
    gbm: trainedGBM !== null,
    bayes: trainedBayes !== null,
    filmCount: trainingCount,
  }
}

/* ───── GBM prediction from EvaluationInput ───── */

function buildInputFeatures(input: EvaluationInput, stats?: DatasetStats): number[] {
  const aRank = stats?.actorTierStats[input.actorTier]?.avgRankScore
    ?? (input.actorTier === 'S' ? 95 : input.actorTier === 'A' ? 80 : input.actorTier === 'B' ? 55 : input.actorTier === 'C' ? 30 : 10)
  const dRank = stats?.directorTierStats[input.directorTier]?.avgRankScore
    ?? (input.directorTier === 'S' ? 95 : input.directorTier === 'A' ? 80 : input.directorTier === 'B' ? 55 : input.directorTier === 'C' ? 30 : 10)

  return extractFeatures({
    budget_cr: input.totalBudgetCr || 30,
    actor_tier_proxy: input.actorTier || 'C',
    director_tier_proxy: input.directorTier || 'C',
    actor_rank_score: aRank,
    director_rank_score: dRank,
    release_month_num: input.releaseMonth || 6,
    sequel_flag: input.sequelFlag,
  })
}

export function predictMultiple(input: EvaluationInput, stats?: DatasetStats): number | null {
  if (!trainedGBM) return null
  return predictGBM(trainedGBM, buildInputFeatures(input, stats))
}

export function attributeMultiple(input: EvaluationInput, stats?: DatasetStats): {
  base: number
  offset: number
  prediction: number
  features: { name: string; contribution: number }[]
} | null {
  if (!trainedGBM) return null
  const { base, offset, prediction, attributions } = attributeGBM(trainedGBM, buildInputFeatures(input, stats))
  return { base, offset, prediction, features: attributions }
}

export function getFeatureImportance(): { name: string; importance: number }[] {
  if (!trainedGBM) return []
  return featureImportance(trainedGBM)
}

export function getBayesianEstimates(): import('./bayesian-model').BayesianEstimates | null {
  return trainedBayes
}
