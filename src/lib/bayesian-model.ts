/* ───────── Empirical Bayes model for missing-data & shrinkage ───────── */

import { budgetBand } from './industry-constants'

export interface Prior {
  mean: number
  variance: number
  strength: number
}

export interface Posterior {
  mean: number
  variance: number
  credibleInterval: [number, number]
  effectiveSampleSize: number
  shrinkage: number
}

export interface BayesianEstimates {
  genre: Record<string, Posterior>
  actorTier: Record<string, Posterior>
  directorTier: Record<string, Posterior>
  budgetBand: Record<string, Posterior>
  month: Record<number, Posterior>
  global: Posterior
  missingDataFraction: number
}

/* ───── Core empirical Bayes ───── */

export function computePrior(values: number[]): Prior {
  const n = values.length
  if (n < 2) return { mean: 1.0, variance: 4.0, strength: 2 }
  const mean = values.reduce((s, v) => s + v, 0) / n
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1)
  return { mean, variance: Math.max(variance, 0.01), strength: Math.min(n, 200) }
}

export function computePosterior(prior: Prior, observedMean: number, observedCount: number, observedVariance?: number): Posterior {
  const effectivePrior = prior.strength
  const effectiveObserved = observedCount

  const postMean = (effectivePrior * prior.mean + effectiveObserved * observedMean) / (effectivePrior + effectiveObserved)

  const obsVar = observedVariance ?? prior.variance
  const postVariance = 1 / (effectivePrior / prior.variance + effectiveObserved / Math.max(obsVar, 0.01))
  const postVar = Math.max(postVariance, 1e-6)

  const se = Math.sqrt(postVar)
  const ci: [number, number] = [
    Math.max(0, postMean - 1.96 * se),
    postMean + 1.96 * se,
  ]

  return {
    mean: Math.round(postMean * 100) / 100,
    variance: Math.round(postVariance * 100) / 100,
    credibleInterval: [Math.round(ci[0] * 100) / 100, Math.round(ci[1] * 100) / 100],
    effectiveSampleSize: Math.round(effectivePrior + effectiveObserved),
    shrinkage: Math.round(effectivePrior / (effectivePrior + effectiveObserved) * 100),
  }
}

/* ───── Aggregate across all films ───── */

export function computeBayesianEstimates(
  films: Array<{
    gross_multiple: number | null
    primary_genre: string
    actor_tier_proxy: string
    director_tier_proxy: string
    budget_cr: number | null
    release_month_num: number | null
  }>
): BayesianEstimates {
  const allMultiples = films
    .map(f => f.gross_multiple)
    .filter((m): m is number => m !== null && m > 0)

  const totalFilms = films.length
  const filmsWithMultiples = allMultiples.length
  const missingDataFraction = Math.round((1 - filmsWithMultiples / Math.max(1, totalFilms)) * 100)

  if (allMultiples.length < 3) {
    const prior = { mean: 1.0, variance: 4.0, strength: 2 }
    const global = computePosterior(prior, 1.0, allMultiples.length)
    return { genre: {}, actorTier: {}, directorTier: {}, budgetBand: {}, month: {}, global, missingDataFraction }
  }

  const globalPrior = computePrior(allMultiples)

  function categoryPosterior<T>(items: T[], keyFn: (f: typeof films[number]) => T | null, labelFn: (t: T) => string): Record<string, Posterior> {
    const result: Record<string, Posterior> = {}
    for (const item of items) {
      const matching = films.filter(f => keyFn(f) === item)
      const multiples = matching.map(f => f.gross_multiple).filter((m): m is number => m !== null && m > 0)
      if (multiples.length >= 1) {
        const obsMean = multiples.reduce((s, v) => s + v, 0) / multiples.length
        const obsVar = multiples.length > 1
          ? multiples.reduce((s, v) => s + (v - obsMean) ** 2, 0) / (multiples.length - 1)
          : globalPrior.variance
        const label = labelFn(item)
        result[label] = computePosterior(globalPrior, obsMean, multiples.length, obsVar)
      }
    }
    return result
  }

  const genres = [...new Set(films.map(f => f.primary_genre).filter(Boolean))]
  const actorTiers = [...new Set(films.map(f => f.actor_tier_proxy).filter(Boolean))]
  const directorTiers = [...new Set(films.map(f => f.director_tier_proxy).filter(Boolean))]
  const budgetBands = [...new Set(films.map(f => f.budget_cr !== null ? budgetBand(f.budget_cr) : null).filter((b): b is string => b !== null))]
  const months = [...new Set(films.map(f => f.release_month_num).filter((m): m is number => m !== null))]

  const global = computePosterior(globalPrior, allMultiples.reduce((s, v) => s + v, 0) / allMultiples.length, allMultiples.length)

  return {
    genre: categoryPosterior(genres, f => f.primary_genre, g => g),
    actorTier: categoryPosterior(actorTiers, f => f.actor_tier_proxy, t => t),
    directorTier: categoryPosterior(directorTiers, f => f.director_tier_proxy, t => t),
    budgetBand: categoryPosterior(budgetBands, f => f.budget_cr !== null ? budgetBand(f.budget_cr) : null, b => b),
    month: Object.fromEntries(
      months.map(m => [m, computePosterior(
        globalPrior,
        films.filter(f => f.release_month_num === m && f.gross_multiple !== null).reduce((s, v) => s + v.gross_multiple!, 0) /
          Math.max(1, films.filter(f => f.release_month_num === m && f.gross_multiple !== null).length),
        films.filter(f => f.release_month_num === m && f.gross_multiple !== null).length,
      )])
    ),
    global,
    missingDataFraction,
  }
}

/* ───── Score calibration from Bayesian mean ───── */

export function bayesianScore(bayes: Posterior, maxScore: number = 10, cap: number = 4.0): { score: number; ci: [number, number] } {
  const rawScore = Math.min(bayes.mean / cap, 1) * maxScore
  const ciLow = Math.min(bayes.credibleInterval[0] / cap, 1) * maxScore
  const ciHigh = Math.min(bayes.credibleInterval[1] / cap, 1) * maxScore
  return {
    score: Math.round(rawScore * 10) / 10,
    ci: [Math.round(ciLow * 10) / 10, Math.round(ciHigh * 10) / 10],
  }
}

/* ───── Uncertainty-aware component scoring ───── */

export function bayesianComponentScore(
  bayes: Posterior | undefined,
  global: Posterior,
  label: string,
  weight: number,
  maxScore: number = 10,
  cap: number = 4.0
): { score: number; contribution: number; explanation: string; scoreRange: { min: number; max: number } } {
  const p = bayes ?? global
  const { score, ci } = bayesianScore(p, maxScore, cap)
  const contribution = Math.round(score * weight * 10) / 10

  const shrtxt = p.shrinkage > 0 ? ` (${p.shrinkage}% shrunk)` : ''
  return {
    score,
    contribution,
    scoreRange: { min: ci[0], max: ci[1] },
    explanation: `${label}: ${p.mean.toFixed(2)}x CI[${p.credibleInterval[0].toFixed(2)}–${p.credibleInterval[1].toFixed(2)}]${shrtxt}`,
  }
}
