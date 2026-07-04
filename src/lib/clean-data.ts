import type { BollywoodFilm } from './types'

const TIER_TO_RANK: Record<string, number> = {
  S: 95, A: 80, B: 55, C: 30, D: 10,
}

export function cleanData(films: BollywoodFilm[]): BollywoodFilm[] {
  return films.map(f => ({
    ...f,
    actor_rank_score: f.actor_rank_score ?? TIER_TO_RANK[f.actor_tier_proxy] ?? null,
    director_rank_score: f.director_rank_score ?? TIER_TO_RANK[f.director_tier_proxy] ?? null,
  }))
}
