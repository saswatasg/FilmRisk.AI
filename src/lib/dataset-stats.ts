import type { BollywoodFilm } from './types'

export interface GenreStats {
  count: number
  withGross: number
  avgBudget: number
  avgMultiple: number
  winRatePct: number
}

export interface TierStats {
  count: number
  withGross: number
  avgMultiple: number
  winRatePct: number
  avgScore: number
}

export interface BudgetBandStats {
  count: number
  winRatePct: number
  avgMultiple: number
}

export interface DatasetStats {
  genreStats: Record<string, GenreStats>
  actorTierStats: Record<string, TierStats>
  directorTierStats: Record<string, TierStats>
  comboStats: Record<string, { count: number; winRatePct: number; avgMultiple: number }>
  budgetBandStats: Record<string, BudgetBandStats>
  grossMultiplePercentiles: { p10: number; p25: number; p50: number; p75: number; p90: number }
  genreBudgetAdjustedWinRates: Record<string, number>
}

export function computeDatasetStats(films: BollywoodFilm[]): DatasetStats {
  const withFinance = films.filter(f => f.budget_cr !== null && f.budget_cr > 0)

  const genreMap: Record<string, GenreStats & { winners: number }> = {}
  const actorTierMap: Record<string, TierStats & { winners: number }> = {}
  const directorTierMap: Record<string, TierStats & { winners: number }> = {}
  const comboMap: Record<string, { count: number; withGross: number; winners: number; totalMult: number }> = {}
  const bandMap: Record<string, { count: number; winRatePct: number; avgMultiple: number; totalBudget: number; winners: number; withData: number }> = {
    '<10': { count: 0, winRatePct: 0, avgMultiple: 0, totalBudget: 0, winners: 0, withData: 0 },
    '10-30': { count: 0, winRatePct: 0, avgMultiple: 0, totalBudget: 0, winners: 0, withData: 0 },
    '30-60': { count: 0, winRatePct: 0, avgMultiple: 0, totalBudget: 0, winners: 0, withData: 0 },
    '60-100': { count: 0, winRatePct: 0, avgMultiple: 0, totalBudget: 0, winners: 0, withData: 0 },
    '100-200': { count: 0, winRatePct: 0, avgMultiple: 0, totalBudget: 0, winners: 0, withData: 0 },
    '>200': { count: 0, winRatePct: 0, avgMultiple: 0, totalBudget: 0, winners: 0, withData: 0 },
  }
  const allMultiples: number[] = []

  function budgetBand(b: number): string {
    if (b < 10) return '<10'
    if (b < 30) return '10-30'
    if (b < 60) return '30-60'
    if (b < 100) return '60-100'
    if (b < 200) return '100-200'
    return '>200'
  }

  for (const f of withFinance) {
    const b = f.budget_cr!
    const g = f.worldwide_gross_cr
    const mult = f.gross_multiple
    const genre = f.primary_genre
    const at = f.actor_tier_proxy
    const dt = f.director_tier_proxy

    if (!genreMap[genre]) genreMap[genre] = { count: 0, withGross: 0, avgBudget: 0, avgMultiple: 0, winRatePct: 0, winners: 0 }
    genreMap[genre].count++
    genreMap[genre].avgBudget += b

    if (g !== null && g > 0 && mult !== null) {
      genreMap[genre].withGross++
      genreMap[genre].avgMultiple += mult
      if (mult >= 1.5) genreMap[genre].winners++
    }

    const band = budgetBand(b)
    if (bandMap[band]) {
      bandMap[band].count++
      bandMap[band].totalBudget += b
      if (mult !== null) {
        bandMap[band].withData++
        bandMap[band].avgMultiple += mult
        if (mult >= 1.5) bandMap[band].winners++
      }
    }

    if (mult !== null) {
      allMultiples.push(mult)
    }

    if (at) {
      if (!actorTierMap[at]) actorTierMap[at] = { count: 0, withGross: 0, avgMultiple: 0, winRatePct: 0, avgScore: 0, winners: 0 }
      actorTierMap[at].count++
      if (f.actor_rank_score !== null) actorTierMap[at].avgScore += f.actor_rank_score
      if (mult !== null) {
        actorTierMap[at].withGross++
        actorTierMap[at].avgMultiple += mult
        if (mult >= 1.5) actorTierMap[at].winners++
      }
    }

    if (dt) {
      if (!directorTierMap[dt]) directorTierMap[dt] = { count: 0, withGross: 0, avgMultiple: 0, winRatePct: 0, avgScore: 0, winners: 0 }
      directorTierMap[dt].count++
      if (f.director_rank_score !== null) directorTierMap[dt].avgScore += f.director_rank_score
      if (mult !== null) {
        directorTierMap[dt].withGross++
        directorTierMap[dt].avgMultiple += mult
        if (mult >= 1.5) directorTierMap[dt].winners++
      }
    }

    if (at && dt) {
      const key = `${dt}+${at}`
      if (!comboMap[key]) comboMap[key] = { count: 0, withGross: 0, winners: 0, totalMult: 0 }
      comboMap[key].count++
      if (mult !== null) {
        comboMap[key].withGross++
        comboMap[key].totalMult += mult
        if (mult >= 1.5) comboMap[key].winners++
      }
    }
  }

  for (const g of Object.values(genreMap)) {
    g.avgBudget = Math.round(g.avgBudget / g.count)
    g.winRatePct = g.withGross > 0 ? Math.round((g.winners / g.withGross) * 100) : 0
    g.avgMultiple = g.withGross > 0 ? Math.round((g.avgMultiple / g.withGross) * 100) / 100 : 0
  }

  for (const t of Object.values(actorTierMap)) {
    t.avgScore = t.avgScore > 0 ? Math.round((t.avgScore / t.count) * 100) / 100 : 0
    t.winRatePct = t.withGross > 0 ? Math.round((t.winners / t.withGross) * 100) : 0
    t.avgMultiple = t.withGross > 0 ? Math.round((t.avgMultiple / t.withGross) * 100) / 100 : 0
  }

  for (const t of Object.values(directorTierMap)) {
    t.avgScore = t.avgScore > 0 ? Math.round((t.avgScore / t.count) * 100) / 100 : 0
    t.winRatePct = t.withGross > 0 ? Math.round((t.winners / t.withGross) * 100) : 0
    t.avgMultiple = t.withGross > 0 ? Math.round((t.avgMultiple / t.withGross) * 100) / 100 : 0
  }

  const bandStats: Record<string, BudgetBandStats> = {}
  for (const [band, data] of Object.entries(bandMap)) {
    bandStats[band] = {
      count: data.count,
      winRatePct: data.withData > 0 ? Math.round((data.winners / data.withData) * 100) : 0,
      avgMultiple: data.withData > 0 ? Math.round((data.avgMultiple / data.withData) * 100) / 100 : 0,
    }
  }

  const sortedMultiples = [...allMultiples].sort((a, b) => a - b)
  const len = sortedMultiples.length

  const getGenreBudgetWinRate = (films: BollywoodFilm[]): Record<string, number> => {
    const result: Record<string, number> = {}
    for (const g of Object.keys(genreMap)) {
      const genreFilms = films.filter(f => f.primary_genre === g && f.gross_multiple !== null)
      if (genreFilms.length >= 3) {
        const winners = genreFilms.filter(f => f.gross_multiple! >= 1.5)
        result[g] = Math.round((winners.length / genreFilms.length) * 100)
      }
    }
    return result
  }

  return {
    genreStats: genreMap,
    actorTierStats: actorTierMap,
    directorTierStats: directorTierMap,
    comboStats: Object.fromEntries(
      Object.entries(comboMap)
        .filter(([, v]) => v.count >= 3)
        .map(([k, v]) => [k, {
          count: v.count,
          winRatePct: v.withGross > 0 ? Math.round((v.winners / v.withGross) * 100) : 0,
          avgMultiple: v.withGross > 0 ? Math.round((v.totalMult / v.withGross) * 100) / 100 : 0,
        }])
    ),
    budgetBandStats: bandStats,
    grossMultiplePercentiles: {
      p10: len > 0 ? sortedMultiples[Math.floor(len * 0.1)] : 0.17,
      p25: len > 0 ? sortedMultiples[Math.floor(len * 0.25)] : 0.54,
      p50: len > 0 ? sortedMultiples[Math.floor(len * 0.5)] : 1.50,
      p75: len > 0 ? sortedMultiples[Math.floor(len * 0.75)] : 3.17,
      p90: len > 0 ? sortedMultiples[Math.floor(len * 0.9)] : 5.29,
    },
    genreBudgetAdjustedWinRates: getGenreBudgetWinRate(films),
  }
}

const CACHE: { films: BollywoodFilm[]; stats: DatasetStats } | null = null

export function loadStats(films: BollywoodFilm[]): DatasetStats {
  return computeDatasetStats(films)
}
