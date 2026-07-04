import { eraByYear, eraRightsCoverage } from './industry-constants'

/* Computed from 546-film full-finance training set (75-25 split, era-based scoring, no imputed rows) */
export const PERCENTILE_BUCKETS: [number, number][] = [
  [27.3, 98], [25.5, 95], [24.8, 90], [24.0, 82], [23.5, 72],
  [22.7, 60], [21.9, 48], [21.2, 38], [20.7, 28], [19.8, 18],
  [18.9, 10], [18.0, 5],
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

/* Backtest helpers: derive concept scores from verdict_raw */
export function backtestConcept(verdict: string): { conceptClarity: number; novelty: number } {
  const match = verdict.match(/hitFlop=(\d)/)
  if (!match) return { conceptClarity: 6, novelty: 5 }
  const v = parseInt(match[1]!)
  const clarityMap: Record<number, number> = { 1: 4, 2: 5, 3: 6, 4: 7, 5: 8 }
  const noveltyMap: Record<number, number> = { 1: 3, 2: 4, 3: 5, 4: 6, 5: 7 }
  return {
    conceptClarity: clarityMap[v] ?? 6,
    novelty: noveltyMap[v] ?? 5,
  }
}
