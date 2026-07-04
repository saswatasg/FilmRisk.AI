export const PRODUCER_REALISATION_RATE = 0.32

export type Era = 'pre_ott' | 'ott_growth' | 'covid' | 'mature'

export function eraByYear(year: number | null | undefined): Era {
  if (!year) return 'mature'
  if (year <= 2014) return 'pre_ott'
  if (year <= 2019) return 'ott_growth'
  if (year <= 2021) return 'covid'
  return 'mature'
}

/* 
  P&A ratio by era × budget band.
  Estimates — pre-2015 had lower P&A (less digital marketing);
  COVID era had compressed theatrical windows but similar P&A.
*/
export const PA_RATIO: Record<Era, Record<string, number>> = {
  pre_ott:   { '<10': 0.35, '10-30': 0.30, '30-60': 0.25, '60-100': 0.25, '100-200': 0.30, '200-300': 0.35, '>300': 0.45 },
  ott_growth:{ '<10': 0.35, '10-30': 0.30, '30-60': 0.27, '60-100': 0.27, '100-200': 0.32, '200-300': 0.37, '>300': 0.47 },
  covid:     { '<10': 0.40, '10-30': 0.35, '30-60': 0.30, '60-100': 0.30, '100-200': 0.35, '200-300': 0.40, '>300': 0.50 },
  mature:    { '<10': 0.40, '10-30': 0.35, '30-60': 0.30, '60-100': 0.30, '100-200': 0.35, '200-300': 0.40, '>300': 0.50 },
}

/*
  Estimated pre-sale rights coverage (OTT + satellite + music + overseas + brand) as fraction of budget.
  Pre-OTT era: satellite/music only (~half of mature).
  OTT-growth era: rising digital deals.
  COVID era: elevated as theatrical share dropped.
  Mature (2022+): current market. Note 2024 saw ~10% rights decline.
  All values are estimates — actual deal data is not in dataset.
*/
export const ESTIMATED_RIGHTS_COVERAGE: Record<Era, Record<string, number>> = {
  pre_ott:   { '<10': 0.08, '10-30': 0.15, '30-60': 0.20, '60-100': 0.25, '100-200': 0.30, '200-300': 0.32, '>300': 0.35 },
  ott_growth:{ '<10': 0.12, '10-30': 0.22, '30-60': 0.32, '60-100': 0.36, '100-200': 0.45, '200-300': 0.48, '>300': 0.50 },
  covid:     { '<10': 0.15, '10-30': 0.28, '30-60': 0.42, '60-100': 0.48, '100-200': 0.58, '200-300': 0.60, '>300': 0.62 },
  mature:    { '<10': 0.20, '10-30': 0.30, '30-60': 0.40, '60-100': 0.40, '100-200': 0.55, '200-300': 0.55, '>300': 0.55 },
}

export function eraRightsCoverage(budget: number, era: Era): number {
  const band = budgetBand(budget)
  return ESTIMATED_RIGHTS_COVERAGE[era]?.[band] ?? ESTIMATED_RIGHTS_COVERAGE[era]?.['30-60'] ?? 0.30
}

export function eraPARatio(budget: number, era: Era): number {
  const band = budgetBand(budget)
  return PA_RATIO[era]?.[band] ?? PA_RATIO[era]?.['30-60'] ?? 0.30
}

export function breakevenMultiple(budget: number, rightsCoverageFrac: number, releaseYear?: number | null): number {
  const band = budgetBand(budget)
  const era = releaseYear != null ? eraByYear(releaseYear) : 'mature'
  const pa = releaseYear != null ? eraPARatio(budget, era) : (PA_RATIO['mature'][band] ?? 0.35)
  const theatricalNeeded = (1 + pa) * (1 - rightsCoverageFrac)
  return theatricalNeeded / PRODUCER_REALISATION_RATE
}

export function estimatedBreakeven(budget: number, releaseYear?: number | null): number {
  const era = releaseYear !== undefined ? eraByYear(releaseYear) : 'mature'
  const rights = eraRightsCoverage(budget, era)
  return breakevenMultiple(budget, rights, releaseYear)
}

/*
  Compute break-even-normalized gross multiple.
  If rightsCoverageFrac is provided by the user, it is used directly (bypassing era estimates).
  Otherwise, releaseYear selects the era for estimated rights coverage.
  If neither is provided, mature-era estimates are used (inference default).
*/
export function normalizedMultiple(grossMultiple: number, budget: number, releaseYear?: number | null, rightsCoverageFrac?: number): number {
  const be = rightsCoverageFrac !== undefined
    ? breakevenMultiple(budget, rightsCoverageFrac)
    : estimatedBreakeven(budget, releaseYear)
  return grossMultiple / be
}

export function budgetBand(b: number): string {
  if (b < 10) return '<10'
  if (b < 30) return '10-30'
  if (b < 60) return '30-60'
  if (b < 100) return '60-100'
  if (b < 200) return '100-200'
  if (b < 300) return '200-300'
  return '>300'
}

/* Calibrated lognormal sigma from dataset residuals */
export const BASE_SIGMA = 1.55
export const BAND_SIGMA: Record<string, number> = {
  '<10': 1.52,
  '10-30': 1.59,
  '30-60': 0.94,
  '60-100': 0.80,
  '100-200': 0.69,
  '200-300': 0.65,
  '>300': 0.83,
}
