import type { BollywoodFilm, ComparableFilm, ComparableResult, EvaluationInput } from './types'
import type { DatasetStats } from './dataset-stats'

const WEIGHTS = {
  genre: 0.25,
  budget: 0.22,
  talentActor: 0.15,
  talentDirector: 0.10,
  year: 0.15,
  actorScore: 0.08,
  directorScore: 0.05,
}

const TIER_RANK: Record<string, number> = { A: 4, B: 3, C: 2, D: 1 }

export function findComparableFilms(
  input: EvaluationInput,
  films: BollywoodFilm[],
  stats: DatasetStats,
  topN: number = 10
): ComparableResult {
  const targetBand = budgetBand(input.totalBudgetCr)
  const scored: { film: BollywoodFilm; details: Record<string, number>; total: number }[] = []

  for (const film of films) {
    if (!film.budget_cr || film.budget_cr <= 0) continue

    const gs = genreSimilarity(input.primaryGenre, film.primary_genre)
    const bs = budgetSimilarity(input.totalBudgetCr, film.budget_cr)
    const actorTierSim = tierDistance(input.actorTier, film.actor_tier_proxy)
    const dirTierSim = tierDistance(input.directorTier, film.director_tier_proxy)
    const ys = yearRecency(film.release_year)
    const actorSc = actorScoreSimilarity(input, film)
    const dirSc = dirScoreSimilarity(input, film)

    const total = gs * WEIGHTS.genre
      + bs * WEIGHTS.budget
      + actorTierSim * WEIGHTS.talentActor
      + dirTierSim * WEIGHTS.talentDirector
      + ys * WEIGHTS.year
      + actorSc * WEIGHTS.actorScore
      + dirSc * WEIGHTS.directorScore

    if (total > 0.2) {
      scored.push({
        film,
        details: {
          genre: Math.round(gs * 100),
          budget: Math.round(bs * 100),
          actorTier: Math.round(actorTierSim * 100),
          directorTier: Math.round(dirTierSim * 100),
          recency: Math.round(ys * 100),
        },
        total: Math.round(total * 1000) / 10,
      })
    }
  }

  scored.sort((a, b) => b.total - a.total)

  return {
    films: scored.slice(0, topN).map(s => ({
      film: s.film,
      similarityScore: s.total,
      matchDetails: s.details,
    })),
    querySummary: `${input.primaryGenre} · ₹${input.totalBudgetCr}Cr · ${input.directorTier}-tier director · ${input.actorTier}-tier actor`,
  }
}

function tierDistance(t1: string, t2: string): number {
  if (!t1 || !t2) return 0.2
  if (t1 === t2) return 1
  const r1 = TIER_RANK[t1] ?? 0
  const r2 = TIER_RANK[t2] ?? 0
  if (r1 === 0 || r2 === 0) return 0.2
  const diff = Math.abs(r1 - r2)
  if (diff === 1) return 0.7
  if (diff === 2) return 0.4
  return 0.2
}

function genreSimilarity(g1: string, g2: string): number {
  if (!g1 || !g2) return 0
  if (g1 === g2) return 1
  const a = g1.toLowerCase().trim(), b = g2.toLowerCase().trim()
  const related: Record<string, string[]> = {
    action: ['thriller', 'crime', 'adventure'],
    comedy: ['drama', 'romance', 'family'],
    drama: ['romance', 'comedy', 'biography', 'social'],
    romance: ['comedy', 'drama', 'musical'],
    thriller: ['action', 'crime', 'horror', 'mystery'],
    horror: ['thriller', 'mystery'],
    musical: ['romance', 'comedy', 'drama'],
    biography: ['drama', 'historical'],
    crime: ['action', 'thriller', 'drama', 'mystery'],
    fantasy: ['action', 'adventure'],
    history: ['drama', 'biography'],
  }
  return related[a]?.includes(b) ? 0.5 : 0.1
}

function budgetSimilarity(a: number, b: number): number {
  if (a <= 0 || b <= 0) return 0
  return Math.min(a, b) / Math.max(a, b)
}

function yearRecency(year: number): number {
  const diff = Math.abs(2025 - year)
  if (diff <= 2) return 1
  if (diff <= 5) return 0.8
  if (diff <= 10) return 0.5
  return Math.max(0.1, 1 - diff / 30)
}

function actorScoreSimilarity(input: EvaluationInput, film: BollywoodFilm): number {
  if (input.leadActor1.toLowerCase() === film.lead_actor_1?.toLowerCase()) return 1
  if (input.leadActor1.toLowerCase() === film.lead_actor_2?.toLowerCase()) return 0.7
  return 0
}

function dirScoreSimilarity(input: EvaluationInput, film: BollywoodFilm): number {
  return input.director.toLowerCase() === film.director?.toLowerCase() ? 1 : 0
}

function budgetBand(b: number): string {
  if (b < 10) return '<10'
  if (b < 30) return '10-30'
  if (b < 60) return '30-60'
  if (b < 100) return '60-100'
  if (b < 200) return '100-200'
  return '>200'
}
