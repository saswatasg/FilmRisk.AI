import { eraByYear, eraRightsCoverage } from './industry-constants'

/* Percentile buckets: empirical cutoffs of adjustedScore on all 729 trainable films
   scored by the CURRENT engine (neutral backtest concepts), recomputed via
   scripts/recalibrate-percentiles.ts. Recalibrate after any engine change that
   shifts the score distribution; then re-run all benchmarks. */
export const PERCENTILE_BUCKETS: [number, number][] = [
  [25.1, 98], [24.0, 95], [23.3, 90], [22.5, 82], [22.0, 72],
  [21.2, 60], [20.5, 48], [19.9, 38], [19.3, 28], [18.6, 18],
  [17.8, 10], [17.3, 5],
]

/* Base thresholds — recalibrate via scripts/calibrate-thresholds.ts after data changes */
export const BASE_PCT_THRESHOLDS: Record<string, { gl: number; cond: number }> = {
  '<10': { gl: 50, cond: 20 },
  '10-30': { gl: 50, cond: 20 },
  '30-60': { gl: 55, cond: 25 },
  '60-100': { gl: 60, cond: 30 },
  '100-200': { gl: 65, cond: 35 },
  '200-300': { gl: 70, cond: 40 },
  '>300': { gl: 75, cond: 45 },
}

/* Backtest helpers: compute era-aware pre-sale rights estimates */
export function backtestRights(budget: number, releaseYear: number | null): {
  ottRightsCr: number; satelliteRightsCr: number; musicRightsCr: number;
  overseasRightsCr: number; brandRevenueCr: number
} {
  const era = eraByYear(releaseYear)
  const totalCoverage = eraRightsCoverage(budget, era)
  const total = budget * totalCoverage
  return {
    ottRightsCr: Math.round(total * 0.455 * 100) / 100,
    satelliteRightsCr: Math.round(total * 0.182 * 100) / 100,
    musicRightsCr: Math.round(total * 0.091 * 100) / 100,
    overseasRightsCr: Math.round(total * 0.182 * 100) / 100,
    brandRevenueCr: Math.round(total * 0.091 * 100) / 100,
  }
}

/* Backtest helper: neutral concept scores for every film.
   The CSV contains no content scores, and deriving sliders from a film's own
   verdict (as earlier versions did) leaks the test outcome into test inputs.
   Neutral constants remove the leakage; the concept component becomes
   non-informative in backtests (as it should be — user sliders only exist
   for real evaluations). Verified honest by the walk-forward fixture. */
export function backtestConcept(): { conceptClarity: number; novelty: number } {
  return { conceptClarity: 6, novelty: 5 }
}
