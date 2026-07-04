import type { BollywoodFilm } from './types'
import { budgetBand } from './industry-constants'

function median(arr: number[]): number {
  const s = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 0 ? (s[mid - 1]! + s[mid]!) / 2 : s[mid]!
}

export function imputeFinance(films: BollywoodFilm[]): BollywoodFilm[] {
  const full = films.filter(f => f.budget_cr !== null && f.budget_cr > 0 && f.worldwide_gross_cr !== null && f.worldwide_gross_cr > 0)

  const bands = ['<10', '10-30', '30-60', '60-100', '100-200', '200-300', '>300'] as const
  const bandMedians: Record<string, number> = {}
  for (const band of bands) {
    const bandFilms = full.filter(f => budgetBand(f.budget_cr!) === band)
    if (bandFilms.length < 3) continue
    const multiples = bandFilms.map(f => f.worldwide_gross_cr! / f.budget_cr!)
    bandMedians[band] = median(multiples)
  }

  let imputed = 0
  const result = films.map(f => {
    if (f.budget_cr !== null && f.budget_cr > 0 && (f.worldwide_gross_cr === null || f.worldwide_gross_cr <= 0)) {
      const band = budgetBand(f.budget_cr)
      const mult = bandMedians[band]
      if (mult !== undefined) {
        imputed++
        return { ...f, worldwide_gross_cr: Math.round(f.budget_cr * mult * 100) / 100, gross_multiple: mult, is_imputed_finance: true }
      }
    }
    if (f.worldwide_gross_cr !== null && f.worldwide_gross_cr > 0 && (f.budget_cr === null || f.budget_cr <= 0)) {
      const guessBand = (gross: number): string | null => {
        let bestBand: string | null = null
        let bestError = Infinity
        for (const band of bands) {
          const mult = bandMedians[band]
          if (mult === undefined || mult <= 0) continue
          const b = gross / mult
          const err = Math.abs(gross - b * mult)
          if (budgetBand(b) === band && err < bestError) {
            bestBand = band
            bestError = err
          }
        }
        if (bestBand) return bestBand
        for (const band of bands) {
          const mult = bandMedians[band]
          if (mult === undefined || mult <= 0) continue
          const b = gross / mult
          const err = Math.abs(gross - b * mult)
          if (err < bestError) { bestBand = band; bestError = err }
        }
        return bestBand
      }
      const matchedBand = guessBand(f.worldwide_gross_cr)
      if (matchedBand) {
        const mult = bandMedians[matchedBand]
        if (mult !== undefined) {
          imputed++
          const budget = Math.round(f.worldwide_gross_cr / mult * 100) / 100
          return { ...f, budget_cr: budget, gross_multiple: mult, is_imputed_finance: true }
        }
      }
    }
    return f
  })

  console.log(`[impute] Imputed ${imputed} partial-finance films (${full.length} full originals)`)
  return result
}
