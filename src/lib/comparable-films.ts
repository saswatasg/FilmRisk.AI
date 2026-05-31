import type { BollywoodFilm, ComparableFilm, ComparableResult, EvaluationInput } from './types'

const WEIGHTS = {
  genre: 0.20,
  budget: 0.18,
  talent: 0.15,
  year: 0.12,
  contentProfile: 0.12,
  sequelRemake: 0.08,
  runtime: 0.05,
  certificate: 0.05,
  productionHouse: 0.05,
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

function genreSimilarity(genre1: string, genre2: string): number {
  if (!genre1 || !genre2) return 0
  if (genre1 === genre2) return 1
  const g1 = genre1.toLowerCase().trim()
  const g2 = genre2.toLowerCase().trim()
  const related: Record<string, string[]> = {
    'action': ['thriller', 'crime', 'historical'],
    'comedy': ['drama', 'romance', 'family'],
    'drama': ['social', 'biopic', 'romance', 'comedy'],
    'romance': ['comedy', 'drama', 'musical'],
    'thriller': ['action', 'crime', 'horror'],
    'horror': ['thriller'],
    'musical': ['romance', 'comedy'],
    'biopic': ['drama', 'historical'],
    'historical': ['action', 'drama', 'biopic', 'mythological'],
    'crime': ['action', 'thriller', 'drama'],
    'social': ['drama'],
    'family': ['comedy', 'drama', 'animation'],
  }
  const relatedGenres = related[g1] ?? []
  if (relatedGenres.includes(g2)) return 0.5
  return 0.1
}

function budgetSimilarity(budgetA: number | null, budgetB: number | null): number {
  if (budgetA === null || budgetB === null || budgetA === 0 || budgetB === 0) return 0
  const ratio = Math.min(budgetA, budgetB) / Math.max(budgetA, budgetB)
  return ratio
}

function yearRecency(yearA: number, yearB: number): number {
  const diff = Math.abs(yearA - yearB)
  if (diff <= 2) return 1
  if (diff <= 5) return 0.8
  if (diff <= 10) return 0.5
  return Math.max(0, 1 - diff / 30)
}

function talentOverlap(input: EvaluationInput, film: BollywoodFilm): number {
  let score = 0
  if (input.director?.toLowerCase() === film.director?.toLowerCase()) score += 0.5
  if (input.leadActor1?.toLowerCase() === film.lead_actor_1?.toLowerCase()) score += 0.3
  if (input.leadActor2?.toLowerCase() === film.lead_actor_2?.toLowerCase()) score += 0.1
  if (input.leadActor1?.toLowerCase() === film.lead_actor_2?.toLowerCase()) score += 0.1
  return Math.min(1, score)
}

function contentProfileSimilarity(input: EvaluationInput, film: BollywoodFilm): number {
  const inputProfile = [input.conceptClarity / 10, input.novelty / 10]
  const filmProfile = [
    film.concept_clarity_score != null ? film.concept_clarity_score / 5 : 0.5,
    film.novelty_score != null ? film.novelty_score / 5 : 0.5,
  ]
  return cosineSimilarity(inputProfile, filmProfile)
}

function productionHouseMatch(input: EvaluationInput, film: BollywoodFilm): number {
  if (!input.productionHouse) return 0
  return input.productionHouse.toLowerCase() === film.production_house?.toLowerCase() ? 1 : 0
}

function certificateSimilarity(input: EvaluationInput, film: BollywoodFilm): number {
  return 0.5
}

function sequelRemakeSimilarity(input: EvaluationInput, film: BollywoodFilm): number {
  if (input.isSequel === !!film.sequel_flag && input.isRemake === !!film.remake_flag) return 1
  if (input.isSequel === !!film.sequel_flag || input.isRemake === !!film.remake_flag) return 0.5
  return 0
}

export function findComparableFilms(
  input: EvaluationInput,
  films: BollywoodFilm[],
  topN: number = 10
): ComparableResult {
  const scored: { film: BollywoodFilm; details: Record<string, number>; total: number }[] = []

  for (const film of films) {
    if (!film.budget_cr || film.budget_cr <= 0) continue

    const gs = genreSimilarity(input.primaryGenre, film.primary_genre)
    const bs = budgetSimilarity(input.totalBudgetCr, film.budget_cr)
    const ts = talentOverlap(input, film)
    const ys = yearRecency(new Date().getFullYear(), film.release_year)
    const cs = contentProfileSimilarity(input, film)
    const sr = sequelRemakeSimilarity(input, film)
    const ph = productionHouseMatch(input, film)

    const total = gs * WEIGHTS.genre
      + bs * WEIGHTS.budget
      + ts * WEIGHTS.talent
      + ys * WEIGHTS.year
      + cs * WEIGHTS.contentProfile
      + sr * WEIGHTS.sequelRemake
      + ph * WEIGHTS.productionHouse
      + 0.5 * WEIGHTS.certificate
      + 0.5 * WEIGHTS.runtime

    if (total > 0.3) {
      scored.push({
        film,
        details: {
          genre: Math.round(gs * 100),
          budget: Math.round(bs * 100),
          talent: Math.round(ts * 100),
          recency: Math.round(ys * 100),
          contentProfile: Math.round(cs * 100),
          sequelRemake: Math.round(sr * 100),
          productionHouse: Math.round(ph * 100),
        },
        total: Math.round(total * 1000) / 10,
      })
    }
  }

  scored.sort((a, b) => b.total - a.total)
  const top = scored.slice(0, topN)

  return {
    films: top.map(s => ({
      film: s.film,
      similarityScore: s.total,
      matchDetails: s.details,
    })),
    querySummary: `${input.primaryGenre} film with ₹${input.totalBudgetCr}Cr budget directed by ${input.director}, starring ${input.leadActor1}`,
  }
}
