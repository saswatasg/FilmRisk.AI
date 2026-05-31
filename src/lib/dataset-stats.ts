import type { BollywoodFilm } from './types'

const BASE_SUCCESS_PRIOR = 0.30
const PRIOR_STRENGTH = 6

export interface GenreStats {
  count: number
  withGross: number
  avgBudget: number
  avgMultiple: number
  winRatePct: number
  adjustedWinRatePct: number
  recentWinRatePct: number | null
  trajectory: 'up' | 'down' | 'stable' | null
}

export interface ProductionHouseStats {
  count: number
  withGross: number
  adjustedWinRatePct: number
  avgMultiple: number
}

export interface TierStats {
  count: number
  withGross: number
  avgMultiple: number
  winRatePct: number
  adjustedWinRatePct: number
  avgScore: number
}

export interface BudgetBandStats {
  count: number
  winRatePct: number
  adjustedWinRatePct: number
  avgMultiple: number
}

export interface GenreBudgetInteraction {
  count: number
  winRatePct: number
  adjustedWinRatePct: number
  avgMultiple: number
}

export interface MonthStats {
  count: number
  winRatePct: number
  adjustedWinRatePct: number
  avgMultiple: number
}

export interface DatasetStats {
  genreStats: Record<string, GenreStats>
  actorTierStats: Record<string, TierStats>
  directorTierStats: Record<string, TierStats>
  comboStats: Record<string, { count: number; winRatePct: number; adjustedWinRatePct: number; avgMultiple: number }>
  budgetBandStats: Record<string, BudgetBandStats>
  genreBudgetStats: Record<string, GenreBudgetInteraction>
  monthStats: Record<number, MonthStats>
  productionHouseStats: Record<string, ProductionHouseStats>
  grossMultiplePercentiles: { p10: number; p25: number; p50: number; p75: number; p90: number }
}

function bayesianWR(wins: number, total: number, prior: number = BASE_SUCCESS_PRIOR, strength: number = PRIOR_STRENGTH): number {
  if (total === 0) return Math.round(prior * 100)
  const adjusted = (wins + prior * strength) / (total + strength)
  return Math.round(adjusted * 100)
}

function temporalWeight(year: number): number {
  if (year <= 2015) return 1.0
  if (year >= 2025) return 3.0
  return 1.0 + (year - 2015) * 0.2
}

function budgetBand(b: number): string {
  if (b < 10) return '<10'
  if (b < 30) return '10-30'
  if (b < 60) return '30-60'
  if (b < 100) return '60-100'
  if (b < 200) return '100-200'
  return '>200'
}

export function computeDatasetStats(films: BollywoodFilm[]): DatasetStats {
  const withFinance = films.filter(f => f.budget_cr !== null && f.budget_cr > 0)
  const allMultiples: number[] = []

  const genreRaw: Record<string, { wins: number; total: number; weightedBudget: number; weightedMultSum: number; weightedCount: number; actualWins: number; actualCount: number }> = {}
  const actorRaw: Record<string, { wins: number; total: number; weightedMultSum: number; weightedCount: number; scoreSum: number; actualWins: number; actualCount: number }> = {}
  const dirRaw: Record<string, { wins: number; total: number; weightedMultSum: number; weightedCount: number; scoreSum: number; actualWins: number; actualCount: number }> = {}
  const bandRaw: Record<string, { wins: number; total: number; weightedMultSum: number; weightedCount: number; actualWins: number; actualCount: number }> = {}
  const genreBudgetRaw: Record<string, { wins: number; total: number; weightedMultSum: number; weightedCount: number; actualWins: number; actualCount: number }> = {}
  const comboRaw: Record<string, { wins: number; total: number; weightedMultSum: number; weightedCount: number; actualWins: number; actualCount: number }> = {}
  const monthRaw: Record<number, { wins: number; total: number; weightedMultSum: number; weightedCount: number; actualWins: number; actualCount: number }> = {}
  const houseRaw: Record<string, { wins: number; total: number; weightedMultSum: number; weightedCount: number; actualWins: number; actualCount: number }> = {}

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

    if (!genreRaw[genre]) genreRaw[genre] = { wins: 0, total: 0, weightedBudget: 0, weightedMultSum: 0, weightedCount: 0, actualWins: 0, actualCount: 0 }
    genreRaw[genre].total += wt
    genreRaw[genre].weightedBudget += b * wt
    genreRaw[genre].weightedCount += wt

    if (month !== null) {
      if (!monthRaw[month]) monthRaw[month] = { wins: 0, total: 0, weightedMultSum: 0, weightedCount: 0, actualWins: 0, actualCount: 0 }
      monthRaw[month].total += wt
      monthRaw[month].weightedCount += wt
    }

    if (house) {
      if (!houseRaw[house]) houseRaw[house] = { wins: 0, total: 0, weightedMultSum: 0, weightedCount: 0, actualWins: 0, actualCount: 0 }
      houseRaw[house].total += wt
      houseRaw[house].weightedCount += wt
    }

    if (g !== null && g > 0 && mult !== null) {
      genreRaw[genre].weightedMultSum += mult * wt
      if (mult >= 1.5) { genreRaw[genre].wins += wt; genreRaw[genre].actualWins += 1 }
      genreRaw[genre].actualCount += 1
      allMultiples.push(mult)

      if (!bandRaw[band]) bandRaw[band] = { wins: 0, total: 0, weightedMultSum: 0, weightedCount: 0, actualWins: 0, actualCount: 0 }
      bandRaw[band].total += wt
      bandRaw[band].weightedMultSum += mult * wt
      bandRaw[band].weightedCount += wt
      if (mult >= 1.5) { bandRaw[band].wins += wt; bandRaw[band].actualWins += 1 }
      bandRaw[band].actualCount += 1

      const gbKey = `${genre}|${band}`
      if (!genreBudgetRaw[gbKey]) genreBudgetRaw[gbKey] = { wins: 0, total: 0, weightedMultSum: 0, weightedCount: 0, actualWins: 0, actualCount: 0 }
      genreBudgetRaw[gbKey].total += wt
      genreBudgetRaw[gbKey].weightedMultSum += mult * wt
      genreBudgetRaw[gbKey].weightedCount += wt
      if (mult >= 1.5) { genreBudgetRaw[gbKey].wins += wt; genreBudgetRaw[gbKey].actualWins += 1 }
      genreBudgetRaw[gbKey].actualCount += 1

      if (month !== null) {
        monthRaw[month].weightedMultSum += mult * wt
        if (mult >= 1.5) { monthRaw[month].wins += wt; monthRaw[month].actualWins += 1 }
        monthRaw[month].actualCount += 1
      }

      if (house) {
        houseRaw[house].weightedMultSum += mult * wt
        if (mult >= 1.5) { houseRaw[house].wins += wt; houseRaw[house].actualWins += 1 }
        houseRaw[house].actualCount += 1
      }
    }

    if (at) {
      if (!actorRaw[at]) actorRaw[at] = { wins: 0, total: 0, weightedMultSum: 0, weightedCount: 0, scoreSum: 0, actualWins: 0, actualCount: 0 }
      actorRaw[at].total += wt
      actorRaw[at].weightedCount += wt
      if (f.actor_rank_score !== null) actorRaw[at].scoreSum += f.actor_rank_score * wt
      if (mult !== null) {
        actorRaw[at].weightedMultSum += mult * wt
        if (mult >= 1.5) { actorRaw[at].wins += wt; actorRaw[at].actualWins += 1 }
        actorRaw[at].actualCount += 1
      }
    }

    if (dt) {
      if (!dirRaw[dt]) dirRaw[dt] = { wins: 0, total: 0, weightedMultSum: 0, weightedCount: 0, scoreSum: 0, actualWins: 0, actualCount: 0 }
      dirRaw[dt].total += wt
      dirRaw[dt].weightedCount += wt
      if (f.director_rank_score !== null) dirRaw[dt].scoreSum += f.director_rank_score * wt
      if (mult !== null) {
        dirRaw[dt].weightedMultSum += mult * wt
        if (mult >= 1.5) { dirRaw[dt].wins += wt; dirRaw[dt].actualWins += 1 }
        dirRaw[dt].actualCount += 1
      }
    }

    if (at && dt && mult !== null) {
      const key = `${dt}+${at}`
      if (!comboRaw[key]) comboRaw[key] = { wins: 0, total: 0, weightedMultSum: 0, weightedCount: 0, actualWins: 0, actualCount: 0 }
      comboRaw[key].total += wt
      comboRaw[key].weightedMultSum += mult * wt
      comboRaw[key].weightedCount += wt
      if (mult >= 1.5) { comboRaw[key].wins += wt; comboRaw[key].actualWins += 1 }
      comboRaw[key].actualCount += 1
    }
  }

  const genreStats: Record<string, GenreStats> = {}
  for (const [k, r] of Object.entries(genreRaw)) {
    const rawWR = r.weightedCount > 0 ? Math.round((r.wins / r.weightedCount) * 100) : 0
    genreStats[k] = {
      count: Math.round(r.weightedCount),
      withGross: Math.round(r.weightedCount),
      avgBudget: r.weightedCount > 0 ? Math.round(r.weightedBudget / r.weightedCount) : 0,
      avgMultiple: r.weightedCount > 0 ? Math.round((r.weightedMultSum / r.weightedCount) * 100) / 100 : 0,
      winRatePct: rawWR,
      adjustedWinRatePct: bayesianWR(r.actualWins, r.actualCount),
      recentWinRatePct: null,
      trajectory: null,
    }
  }

  const actorTierStats: Record<string, TierStats> = {}
  for (const [k, r] of Object.entries(actorRaw)) {
    actorTierStats[k] = {
      count: Math.round(r.weightedCount),
      withGross: Math.round(r.weightedCount),
      avgMultiple: r.weightedCount > 0 ? Math.round((r.weightedMultSum / r.weightedCount) * 100) / 100 : 0,
      winRatePct: r.weightedCount > 0 ? Math.round((r.wins / r.weightedCount) * 100) : 0,
      adjustedWinRatePct: bayesianWR(r.actualWins, r.actualCount),
      avgScore: r.weightedCount > 0 ? Math.round((r.scoreSum / r.weightedCount) * 100) / 100 : 0,
    }
  }

  const directorTierStats: Record<string, TierStats> = {}
  for (const [k, r] of Object.entries(dirRaw)) {
    directorTierStats[k] = {
      count: Math.round(r.weightedCount),
      withGross: Math.round(r.weightedCount),
      avgMultiple: r.weightedCount > 0 ? Math.round((r.weightedMultSum / r.weightedCount) * 100) / 100 : 0,
      winRatePct: r.weightedCount > 0 ? Math.round((r.wins / r.weightedCount) * 100) : 0,
      adjustedWinRatePct: bayesianWR(r.actualWins, r.actualCount),
      avgScore: r.weightedCount > 0 ? Math.round((r.scoreSum / r.weightedCount) * 100) / 100 : 0,
    }
  }

  const bandStats: Record<string, BudgetBandStats> = {}
  for (const [k, r] of Object.entries(bandRaw)) {
    bandStats[k] = {
      count: Math.round(r.weightedCount),
      winRatePct: r.weightedCount > 0 ? Math.round((r.wins / r.weightedCount) * 100) : 0,
      adjustedWinRatePct: bayesianWR(r.actualWins, r.actualCount),
      avgMultiple: r.weightedCount > 0 ? Math.round((r.weightedMultSum / r.weightedCount) * 100) / 100 : 0,
    }
  }

  const genreBudgetStats: Record<string, GenreBudgetInteraction> = {}
  for (const [k, r] of Object.entries(genreBudgetRaw)) {
    genreBudgetStats[k] = {
      count: Math.round(r.weightedCount),
      winRatePct: r.weightedCount > 0 ? Math.round((r.wins / r.weightedCount) * 100) : 0,
      adjustedWinRatePct: bayesianWR(r.actualWins, r.actualCount),
      avgMultiple: r.weightedCount > 0 ? Math.round((r.weightedMultSum / r.weightedCount) * 100) / 100 : 0,
    }
  }

  const monthStats: Record<number, MonthStats> = {}
  for (const [k, r] of Object.entries(monthRaw)) {
    const month = parseInt(k)
    monthStats[month] = {
      count: Math.round(r.weightedCount),
      winRatePct: r.weightedCount > 0 ? Math.round((r.wins / r.weightedCount) * 100) : 0,
      adjustedWinRatePct: bayesianWR(r.actualWins, r.actualCount),
      avgMultiple: r.weightedCount > 0 ? Math.round((r.weightedMultSum / r.weightedCount) * 100) / 100 : 0,
    }
  }

  const comboStats: Record<string, { count: number; winRatePct: number; adjustedWinRatePct: number; avgMultiple: number }> = {}
  for (const [k, r] of Object.entries(comboRaw)) {
    if (r.weightedCount >= 2) {
      comboStats[k] = {
        count: Math.round(r.weightedCount),
        winRatePct: r.weightedCount > 0 ? Math.round((r.wins / r.weightedCount) * 100) : 0,
        adjustedWinRatePct: bayesianWR(r.actualWins, r.actualCount),
        avgMultiple: r.weightedCount > 0 ? Math.round((r.weightedMultSum / r.weightedCount) * 100) / 100 : 0,
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
        withGross: r.actualCount,
        adjustedWinRatePct: bayesianWR(r.actualWins, r.actualCount),
        avgMultiple: r.weightedCount > 0 ? Math.round((r.weightedMultSum / r.weightedCount) * 100) / 100 : 0,
      }
    }
  }

  const genreTrajectory: Record<string, { recentWR: number | null; trajectory: 'up' | 'down' | 'stable' | null }> = {}
  for (const [genre, g] of Object.entries(genreStats)) {
    const recentFilms = withFinance.filter(f => f.primary_genre === genre && f.release_year >= 2023 && f.gross_multiple !== null)
    const recentWins = recentFilms.filter(f => f.gross_multiple! >= 1.5).length
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
    if (genreStats[genre]) {
      genreStats[genre].recentWinRatePct = recentWR
      genreStats[genre].trajectory = trajectory
    }
  }

  return {
    genreStats,
    actorTierStats,
    directorTierStats,
    comboStats,
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
