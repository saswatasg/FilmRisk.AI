/*
  Shared harness logic for all backtest/evaluation scripts (walk-forward, 75-25,
  track-record, demo). Every script constructs inputs, classes, verdicts, and
  correctness identically — no drift between harnesses.
*/
import { readFileSync } from 'fs'
import { join } from 'path'
import { parseCSV } from '../src/lib/csv-parser'
import { imputeFinance } from '../src/lib/impute-finance'
import { budgetBand, normalizedMultiple } from '../src/lib/industry-constants'
import { BASE_PCT_THRESHOLDS, backtestRights, backtestConcept } from '../src/lib/config'
import type { BollywoodFilm, EvaluationInput } from '../src/lib/types'

export const MIN_TRAIN_YEAR = 2010

export interface FinanceFilm extends BollywoodFilm {
  budget_cr: number
  worldwide_gross_cr: number
}

export function loadFinanceFilms(): FinanceFilm[] {
  return loadAllFilms().filter((f): f is FinanceFilm =>
    f.budget_cr !== null && f.budget_cr > 0 &&
    f.worldwide_gross_cr !== null && f.worldwide_gross_cr > 0 &&
    !f.is_imputed_finance
  )
}

export function loadAllFilms(): BollywoodFilm[] {
  const csvPath = join(process.cwd(), 'src', 'data', 'bollywood_input.csv')
  const text = readFileSync(csvPath, 'utf-8')
  return imputeFinance(parseCSV(text))
}

export function actualClass(normMult: number): string {
  if (normMult >= 2.0) return 'BLOCKBUSTER'
  if (normMult >= 1.5) return 'HIT'
  if (normMult >= 1.0) return 'BREAK_EVEN'
  if (normMult >= 0.5) return 'BELOW_AVG'
  return 'FLOP'
}

export function isHit(actual: string): boolean {
  return actual === 'HIT' || actual === 'BLOCKBUSTER'
}

export function verdictFromPct(pct: number, band: string): string {
  const t = BASE_PCT_THRESHOLDS[band] ?? BASE_PCT_THRESHOLDS['30-60']!
  return pct >= t.gl ? 'GREENLIGHT' : pct >= t.cond ? 'CONDITIONAL' : 'DONT_INVEST'
}

/* The correctness rule used by every benchmark (3-way mapping, lenient by design) */
export function correctness(verdict: string, actual: string, hit: boolean): boolean {
  if (verdict === 'GREENLIGHT' && hit) return true
  if (verdict === 'CONDITIONAL' && (actual === 'BREAK_EVEN' || actual === 'BELOW_AVG')) return true
  if (verdict === 'DONT_INVEST' && (actual === 'FLOP' || actual === 'BELOW_AVG')) return true
  return false
}

/* Maps a predicted class to the nearest verdict (apples-to-apples for class-only baselines) */
export function classVerdict(cls: string): string {
  if (cls === 'HIT' || cls === 'BLOCKBUSTER') return 'GREENLIGHT'
  if (cls === 'BREAK_EVEN' || cls === 'BELOW_AVG') return 'CONDITIONAL'
  return 'DONT_INVEST'
}

export function actualNormalizedMultiple(f: FinanceFilm): number {
  return normalizedMultiple(f.worldwide_gross_cr / f.budget_cr, f.budget_cr, f.release_year)
}

/* Backtest input: era-aware synthetic pre-sale rights + verdict-derived concept scores
   (the CSV contains neither — documented limitation, same inputs in every harness). */
export function makeInput(f: FinanceFilm): EvaluationInput {
  const rights = backtestRights(f.budget_cr, f.release_year)
  const concept = backtestConcept()
  return {
    filmTitle: f.display_title,
    secondaryGenre: f.secondary_genre,
    sequelFlag: f.sequel_flag,
    logline: '',
    primaryGenre: f.primary_genre,
    director: f.director,
    leadActor1: f.lead_actor_1,
    directorTier: f.director_tier_proxy,
    actorTier: f.actor_tier_proxy,
    productionHouse: f.production_house,
    totalBudgetCr: f.budget_cr,
    productionBudgetCr: f.budget_cr * 0.6,
    pAndABudgetCr: f.budget_cr * 0.25,
    contingencyPercent: 10,
    ottRightsCr: rights.ottRightsCr,
    satelliteRightsCr: rights.satelliteRightsCr,
    musicRightsCr: rights.musicRightsCr,
    overseasRightsCr: rights.overseasRightsCr,
    brandRevenueCr: rights.brandRevenueCr,
    financingCostCr: f.budget_cr * 0.05,
    theatricalSharePercent: 40,
    marketTiming: 'neutral',
    releaseMonth: f.release_month_num ?? 6,
    conceptClarity: concept.conceptClarity,
    novelty: concept.novelty,
  }
}

export function median(arr: number[]): number {
  const s = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 0 ? (s[mid - 1]! + s[mid]!) / 2 : s[mid]!
}

export function bandOf(budget: number): string {
  return budgetBand(budget)
}
