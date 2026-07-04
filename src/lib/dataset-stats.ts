import type { BollywoodFilm } from './types'
import { budgetBand, normalizedMultiple } from './industry-constants'

const BASE_SUCCESS_PRIOR = 0.30
const PRIOR_STRENGTH = 6

export interface GenreStats {
  count: number
  weightedCount: number
  avgBudget: number
  avgMultiple: number
  winRatePct: number
  adjustedWinRatePct: number
  recentWinRatePct: number | null
  trajectory: 'up' | 'down' | 'stable' | null
  avgNormalizedMultiple: number
}

export interface ProductionHouseStats {
  count: number
  filmCount: number
  avgMultiple: number
  avgNormalizedMultiple: number
}

export interface TierStats {
  count: number
  weightedCount: number
  avgMultiple: number
  avgNormalizedMultiple: number
  avgRankScore: number
  minRankScore: number
  maxRankScore: number
}

export interface BudgetBandStats {
  count: number
  avgMultiple: number
  avgNormalizedMultiple: number
}

export interface GenreBudgetInteraction {
  count: number
  avgMultiple: number
  avgNormalizedMultiple: number
}

export interface MonthStats {
  count: number
  avgMultiple: number
  avgNormalizedMultiple: number
}

export interface DatasetStats {
  genreStats: Record<string, GenreStats>
  actorTierStats: Record<string, TierStats>
  directorTierStats: Record<string, TierStats>
  budgetBandStats: Record<string, BudgetBandStats>
  genreBudgetStats: Record<string, GenreBudgetInteraction>
  monthStats: Record<number, MonthStats>
  productionHouseStats: Record<string, ProductionHouseStats>
  grossMultiplePercentiles: { p10: number; p25: number; p50: number; p75: number; p90: number }
  comboStats: Record<string, { count: number; avgMultiple: number; avgNormalizedMultiple: number }>
  secondaryGenreStats: Record<string, { count: number; avgMultiple: number; avgNormalizedMultiple: number }>
}

function bayesianWR(wins: number, total: number, prior: number = BASE_SUCCESS_PRIOR, strength: number = PRIOR_STRENGTH): number {
  if (total === 0) return Math.round(prior * 100)
  const adjusted = (wins + prior * strength) / (total + strength)
  return Math.round(adjusted * 100)
}

function temporalWeight(year: number | null): number {
  if (!year || year <= 2015) return 1.0
  if (year >= 2025) return 3.0
  return 1.0 + (year - 2015) * 0.2
}

export function computeDatasetStats(films: BollywoodFilm[]): DatasetStats {
  const withFinance = films.filter(f => f.budget_cr !== null && f.budget_cr > 0)
  const allMultiples: number[] = []

  const genreRaw: Record<string, { wins: number; total: number; weightedBudget: number; weightedMultSum: number; weightedCount: number; actualWins: number; actualCount: number; normalizedMultSum: number; normalizedWins: number }> = {}
  const actorRaw: Record<string, { wins: number; total: number; weightedMultSum: number; weightedCount: number; scoreSum: number; actualWins: number; actualCount: number; minScore: number; maxScore: number; normalizedMultSum: number; normalizedWins: number }> = {}
  const dirRaw: Record<string, { wins: number; total: number; weightedMultSum: number; weightedCount: number; scoreSum: number; actualWins: number; actualCount: number; minScore: number; maxScore: number; normalizedMultSum: number; normalizedWins: number }> = {}
  const bandRaw: Record<string, { wins: number; total: number; weightedMultSum: number; weightedCount: number; actualWins: number; actualCount: number; normalizedMultSum: number; normalizedWins: number }> = {}
  const genreBudgetRaw: Record<string, { wins: number; total: number; weightedMultSum: number; weightedCount: number; actualWins: number; actualCount: number; normalizedMultSum: number; normalizedWins: number }> = {}
  const secGenreRaw: Record<string, { wins: number; total: number; weightedMultSum: number; weightedCount: number; actualWins: number; actualCount: number; normalizedMultSum: number; normalizedWins: number }> = {}
  const comboRaw: Record<string, { wins: number; total: number; weightedMultSum: number; weightedCount: number; actualWins: number; actualCount: number; normalizedMultSum: number; normalizedWins: number }> = {}
  const monthRaw: Record<number, { wins: number; total: number; weightedMultSum: number; weightedCount: number; actualWins: number; actualCount: number; normalizedMultSum: number; normalizedWins: number }> = {}
  const houseRaw: Record<string, { wins: number; total: number; weightedMultSum: number; weightedCount: number; actualWins: number; actualCount: number; normalizedMultSum: number; normalizedWins: number }> = {}

  for (const f of withFinance) {
    const b = f.budget_cr!
    const g = f.worldwide_gross_cr
    const mult = f.gross_multiple
    const year = f.release_year
    const wt = temporalWeight(year)

    const genre = f.primary_genre
    const at = f.actor_tier_proxy
    const dt = f.director_tier_proxy
    const band = budgetBand(b)
    const month = f.release_month_num
    const house = f.production_house

    let gr = genreRaw[genre]
    if (!gr) { gr = { wins: 0, total: 0, weightedBudget: 0, weightedMultSum: 0, weightedCount: 0, actualWins: 0, actualCount: 0, normalizedMultSum: 0, normalizedWins: 0 }; genreRaw[genre] = gr }
    gr.total += wt
    gr.weightedBudget += b * wt
    gr.weightedCount += wt

    let mr: { wins: number; total: number; weightedMultSum: number; weightedCount: number; actualWins: number; actualCount: number; normalizedMultSum: number; normalizedWins: number } | undefined
    if (month !== null) {
      mr = monthRaw[month]
      if (!mr) { mr = { wins: 0, total: 0, weightedMultSum: 0, weightedCount: 0, actualWins: 0, actualCount: 0, normalizedMultSum: 0, normalizedWins: 0 }; monthRaw[month] = mr }
      mr.total += wt
      mr.weightedCount += wt
    }

    let hr: { wins: number; total: number; weightedMultSum: number; weightedCount: number; actualWins: number; actualCount: number; normalizedMultSum: number; normalizedWins: number } | undefined
    if (house) {
      hr = houseRaw[house]
      if (!hr) { hr = { wins: 0, total: 0, weightedMultSum: 0, weightedCount: 0, actualWins: 0, actualCount: 0, normalizedMultSum: 0, normalizedWins: 0 }; houseRaw[house] = hr }
      hr.total += wt
      hr.weightedCount += wt
    }

    if (g !== null && g > 0 && mult !== null) {
      const normMult = normalizedMultiple(mult, b, year)

      gr.weightedMultSum += mult * wt
      gr.normalizedMultSum += normMult * wt
      if (normMult >= 1.0) { gr.wins += wt; gr.actualWins += 1 }
      gr.actualCount += 1
      allMultiples.push(mult)

      let br = bandRaw[band]
      if (!br) { br = { wins: 0, total: 0, weightedMultSum: 0, weightedCount: 0, actualWins: 0, actualCount: 0, normalizedMultSum: 0, normalizedWins: 0 }; bandRaw[band] = br }
      br.total += wt
      br.weightedMultSum += mult * wt
      br.normalizedMultSum += normMult * wt
      br.weightedCount += wt
      if (normMult >= 1.0) { br.wins += wt; br.actualWins += 1 }
      br.actualCount += 1

      if (f.secondary_genre) {
        let sr = secGenreRaw[f.secondary_genre]
        if (!sr) { sr = { wins: 0, total: 0, weightedMultSum: 0, weightedCount: 0, actualWins: 0, actualCount: 0, normalizedMultSum: 0, normalizedWins: 0 }; secGenreRaw[f.secondary_genre] = sr }
        sr.total += wt
        sr.weightedMultSum += mult * wt
        sr.normalizedMultSum += normMult * wt
        sr.weightedCount += wt
        if (normMult >= 1.0) { sr.wins += wt; sr.actualWins += 1 }
        sr.actualCount += 1
      }

      const gbKey = `${genre}|${band}`
      let gbr = genreBudgetRaw[gbKey]
      if (!gbr) { gbr = { wins: 0, total: 0, weightedMultSum: 0, weightedCount: 0, actualWins: 0, actualCount: 0, normalizedMultSum: 0, normalizedWins: 0 }; genreBudgetRaw[gbKey] = gbr }
      gbr.total += wt
      gbr.weightedMultSum += mult * wt
      gbr.normalizedMultSum += normMult * wt
      gbr.weightedCount += wt
      if (normMult >= 1.0) { gbr.wins += wt; gbr.actualWins += 1 }
      gbr.actualCount += 1

      if (month !== null && mr) {
        mr.weightedMultSum += mult * wt
        mr.normalizedMultSum += normMult * wt
        if (normMult >= 1.0) { mr.wins += wt; mr.actualWins += 1 }
        mr.actualCount += 1
      }

      if (house && hr) {
        hr.weightedMultSum += mult * wt
        hr.normalizedMultSum += normMult * wt
        if (normMult >= 1.0) { hr.wins += wt; hr.actualWins += 1 }
        hr.actualCount += 1
      }
    }

    if (at) {
      let ar = actorRaw[at]
      if (!ar) { ar = { wins: 0, total: 0, weightedMultSum: 0, weightedCount: 0, scoreSum: 0, actualWins: 0, actualCount: 0, minScore: Infinity, maxScore: -Infinity, normalizedMultSum: 0, normalizedWins: 0 }; actorRaw[at] = ar }
      ar.total += wt
      ar.weightedCount += wt
      if (f.actor_rank_score !== null) {
        ar.scoreSum += f.actor_rank_score * wt
        ar.minScore = Math.min(ar.minScore, f.actor_rank_score)
        ar.maxScore = Math.max(ar.maxScore, f.actor_rank_score)
      }
      if (mult !== null) {
        const normMult = normalizedMultiple(mult, b, year)
        ar.weightedMultSum += mult * wt
        ar.normalizedMultSum += normMult * wt
        if (normMult >= 1.0) { ar.wins += wt; ar.actualWins += 1 }
        ar.actualCount += 1
      }
    }

    if (dt) {
      let dr = dirRaw[dt]
      if (!dr) { dr = { wins: 0, total: 0, weightedMultSum: 0, weightedCount: 0, scoreSum: 0, actualWins: 0, actualCount: 0, minScore: Infinity, maxScore: -Infinity, normalizedMultSum: 0, normalizedWins: 0 }; dirRaw[dt] = dr }
      dr.total += wt
      dr.weightedCount += wt
      if (f.director_rank_score !== null) {
        dr.scoreSum += f.director_rank_score * wt
        dr.minScore = Math.min(dr.minScore, f.director_rank_score)
        dr.maxScore = Math.max(dr.maxScore, f.director_rank_score)
      }
      if (mult !== null) {
        const normMult = normalizedMultiple(mult, b, year)
        dr.weightedMultSum += mult * wt
        dr.normalizedMultSum += normMult * wt
        if (normMult >= 1.0) { dr.wins += wt; dr.actualWins += 1 }
        dr.actualCount += 1
      }
    }

    if (at && dt && mult !== null) {
      const normMult = normalizedMultiple(mult, b, year)
      const key = `${dt}+${at}`
      let cr = comboRaw[key]
      if (!cr) { cr = { wins: 0, total: 0, weightedMultSum: 0, weightedCount: 0, actualWins: 0, actualCount: 0, normalizedMultSum: 0, normalizedWins: 0 }; comboRaw[key] = cr }
      cr.total += wt
      cr.weightedMultSum += mult * wt
      cr.normalizedMultSum += normMult * wt
      cr.weightedCount += wt
      if (normMult >= 1.0) { cr.wins += wt; cr.actualWins += 1 }
      cr.actualCount += 1
    }
  }

  const genreStats: Record<string, GenreStats> = {}
  for (const [k, r] of Object.entries(genreRaw)) {
    const rawWR = r.weightedCount > 0 ? Math.round((r.wins / r.weightedCount) * 100) : 0
    genreStats[k] = {
      count: Math.round(r.weightedCount),
      weightedCount: Math.round(r.weightedCount),
      avgBudget: r.weightedCount > 0 ? Math.round(r.weightedBudget / r.weightedCount) : 0,
      avgMultiple: r.weightedCount > 0 ? Math.round((r.weightedMultSum / r.weightedCount) * 100) / 100 : 0,
      avgNormalizedMultiple: r.weightedCount > 0 ? Math.round((r.normalizedMultSum / r.weightedCount) * 100) / 100 : 0,
      winRatePct: rawWR,
      adjustedWinRatePct: bayesianWR(r.actualWins, r.actualCount),
      recentWinRatePct: null,
      trajectory: null,
    }
  }

  const actorTierStats: Record<string, TierStats> = {}
  for (const [k, r] of Object.entries(actorRaw)) {
    const avgRankScore = r.weightedCount > 0 ? Math.round((r.scoreSum / r.weightedCount) * 100) / 100 : 0
    actorTierStats[k] = {
      count: Math.round(r.weightedCount),
      weightedCount: Math.round(r.weightedCount),
      avgMultiple: r.weightedCount > 0 ? Math.round((r.weightedMultSum / r.weightedCount) * 100) / 100 : 0,
      avgNormalizedMultiple: r.weightedCount > 0 ? Math.round((r.normalizedMultSum / r.weightedCount) * 100) / 100 : 0,
      avgRankScore,
      minRankScore: r.minScore === Infinity ? avgRankScore : Math.round(r.minScore),
      maxRankScore: r.maxScore === -Infinity ? avgRankScore : Math.round(r.maxScore),
    }
  }

  const directorTierStats: Record<string, TierStats> = {}
  for (const [k, r] of Object.entries(dirRaw)) {
    const avgRankScore = r.weightedCount > 0 ? Math.round((r.scoreSum / r.weightedCount) * 100) / 100 : 0
    directorTierStats[k] = {
      count: Math.round(r.weightedCount),
      weightedCount: Math.round(r.weightedCount),
      avgMultiple: r.weightedCount > 0 ? Math.round((r.weightedMultSum / r.weightedCount) * 100) / 100 : 0,
      avgNormalizedMultiple: r.weightedCount > 0 ? Math.round((r.normalizedMultSum / r.weightedCount) * 100) / 100 : 0,
      avgRankScore,
      minRankScore: r.minScore === Infinity ? avgRankScore : Math.round(r.minScore),
      maxRankScore: r.maxScore === -Infinity ? avgRankScore : Math.round(r.maxScore),
    }
  }

  const bandStats: Record<string, BudgetBandStats> = {}
  for (const [k, r] of Object.entries(bandRaw)) {
    bandStats[k] = {
      count: Math.round(r.weightedCount),
      avgMultiple: r.weightedCount > 0 ? Math.round((r.weightedMultSum / r.weightedCount) * 100) / 100 : 0,
      avgNormalizedMultiple: r.weightedCount > 0 ? Math.round((r.normalizedMultSum / r.weightedCount) * 100) / 100 : 0,
    }
  }

  const genreBudgetStats: Record<string, GenreBudgetInteraction> = {}
  for (const [k, r] of Object.entries(genreBudgetRaw)) {
    genreBudgetStats[k] = {
      count: Math.round(r.weightedCount),
      avgMultiple: r.weightedCount > 0 ? Math.round((r.weightedMultSum / r.weightedCount) * 100) / 100 : 0,
      avgNormalizedMultiple: r.weightedCount > 0 ? Math.round((r.normalizedMultSum / r.weightedCount) * 100) / 100 : 0,
    }
  }

  const monthStats: Record<number, MonthStats> = {}
  for (const [k, r] of Object.entries(monthRaw)) {
    const month = parseInt(k)
    monthStats[month] = {
      count: Math.round(r.weightedCount),
      avgMultiple: r.weightedCount > 0 ? Math.round((r.weightedMultSum / r.weightedCount) * 100) / 100 : 0,
      avgNormalizedMultiple: r.weightedCount > 0 ? Math.round((r.normalizedMultSum / r.weightedCount) * 100) / 100 : 0,
    }
  }

  const comboStats: Record<string, { count: number; avgMultiple: number; avgNormalizedMultiple: number }> = {}
  for (const [k, r] of Object.entries(comboRaw)) {
    if (r.weightedCount >= 2) {
      comboStats[k] = {
        count: Math.round(r.weightedCount),
        avgMultiple: r.weightedCount > 0 ? Math.round((r.weightedMultSum / r.weightedCount) * 100) / 100 : 0,
        avgNormalizedMultiple: r.weightedCount > 0 ? Math.round((r.normalizedMultSum / r.weightedCount) * 100) / 100 : 0,
      }
    }
  }

  const secondaryGenreStats: Record<string, { count: number; avgMultiple: number; avgNormalizedMultiple: number }> = {}
  for (const [k, r] of Object.entries(secGenreRaw)) {
    if (r.weightedCount >= 3) {
      secondaryGenreStats[k] = {
        count: Math.round(r.weightedCount),
        avgMultiple: r.weightedCount > 0 ? Math.round((r.weightedMultSum / r.weightedCount) * 100) / 100 : 0,
        avgNormalizedMultiple: r.weightedCount > 0 ? Math.round((r.normalizedMultSum / r.weightedCount) * 100) / 100 : 0,
      }
    }
  }

  const sorted = [...allMultiples].sort((a, b) => a - b)
  const len = sorted.length

  const productionHouseStats: Record<string, ProductionHouseStats> = {}
  for (const [k, r] of Object.entries(houseRaw)) {
    if (r.actualCount >= 3) {
      productionHouseStats[k] = {
        count: Math.round(r.weightedCount),
        filmCount: r.actualCount,
        avgMultiple: r.weightedCount > 0 ? Math.round((r.weightedMultSum / r.weightedCount) * 100) / 100 : 0,
        avgNormalizedMultiple: r.weightedCount > 0 ? Math.round((r.normalizedMultSum / r.weightedCount) * 100) / 100 : 0,
      }
    }
  }

  const maxYear = withFinance.reduce((m, f) => f.release_year !== null && f.release_year > m ? f.release_year : m, 0)
  const recentYearThreshold = Math.max(maxYear - 2, 2020)
  const genreTrajectory: Record<string, { recentWR: number | null; trajectory: 'up' | 'down' | 'stable' | null }> = {}
  for (const [genre, g] of Object.entries(genreStats)) {
    const recentFilms = withFinance.filter(f => f.primary_genre === genre && f.release_year !== null && f.release_year >= recentYearThreshold && f.gross_multiple !== null)
    const recentWins = recentFilms.filter(f => normalizedMultiple(f.gross_multiple!, f.budget_cr!, f.release_year) >= 1.0).length
    const recentCount = recentFilms.length
    const recentWR = recentCount >= 3 ? Math.round((recentWins / recentCount) * 100) : null
    const allWR = g.winRatePct
    let trajectory: 'up' | 'down' | 'stable' | null = null
    if (recentWR !== null && allWR > 0) {
      if (recentWR > allWR + 10) trajectory = 'up'
      else if (recentWR < allWR - 10) trajectory = 'down'
      else trajectory = 'stable'
    }
    genreTrajectory[genre] = { recentWR, trajectory }
    const gs = genreStats[genre]
    if (gs) {
      gs.recentWinRatePct = recentWR
      gs.trajectory = trajectory
    }
  }

  return {
    genreStats,
    actorTierStats,
    directorTierStats,
    comboStats,
    secondaryGenreStats,
    budgetBandStats: bandStats,
    genreBudgetStats,
    monthStats,
    productionHouseStats,
    grossMultiplePercentiles: {
      p10: sorted[Math.floor(len * 0.1)] ?? 0.17,
      p25: sorted[Math.floor(len * 0.25)] ?? 0.54,
      p50: sorted[Math.floor(len * 0.5)] ?? 1.50,
      p75: sorted[Math.floor(len * 0.75)] ?? 3.17,
      p90: sorted[Math.floor(len * 0.9)] ?? 5.29,
    },
  }
}
