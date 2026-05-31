import type { BollywoodFilm, DatasetSummary } from './types'

function p(v: string | undefined): string { return v?.trim() ?? '' }
function n(v: string | undefined): number | null {
  const s = p(v); if (!s) return null
  const x = Number(s); return isNaN(x) ? null : x
}

export function parseFilm(row: Record<string, string>, idx: number): BollywoodFilm {
  const budget = n(row.budget_cr)
  const gross = n(row.worldwide_gross_cr)
  let computedMultiple: number | null = null
  if (budget !== null && gross !== null && budget > 0) {
    computedMultiple = Math.round((gross / budget) * 100) / 100
  }

  return {
    film_id: p(row.film_id),
    canonical_title: p(row.canonical_title),
    display_title: p(row.display_title),
    release_year: n(row.release_year) ?? 0,
    primary_genre: p(row.primary_genre),
    director: p(row.director),
    lead_actor_1: p(row.lead_actor_1),
    lead_actor_2: p(row.lead_actor_2),
    production_house: p(row.production_house),
    actor_rank_score: n(row.actor_rank_score),
    actor_tier_proxy: p(row.actor_tier_proxy),
    director_rank_score: n(row.director_rank_score),
    director_tier_proxy: p(row.director_tier_proxy),
    budget_cr: budget,
    worldwide_gross_cr: gross,
    gross_multiple: computedMultiple,
    verdict_raw: p(row.verdict_raw),
    hitflop_numeric: n(row.hitflop_numeric),
    imdb_rating: n(row.imdb_rating),
    imdb_votes: n(row.imdb_votes),
    runtime_min: n(row.runtime_min),
    model_usage: p(row.model_usage),
    financial_data_confidence: p(row.financial_data_confidence),
  }
}

function parseCSVLine(line: string): string[] {
  const r: string[] = []; let c = '', q = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (q && i + 1 < line.length && line[i + 1] === '"') { c += '"'; i++ }
      else q = !q
    } else if (ch === ',' && !q) { r.push(c); c = '' }
    else c += ch
  }
  r.push(c)
  return r
}

export function parseCSV(text: string): BollywoodFilm[] {
  const lines = text.split('\n').filter(l => l.trim())
  if (lines.length < 2) return []
  const headers = parseCSVLine(lines[0]).map(h => h.trim())
  const films: BollywoodFilm[] = []
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    if (values.length !== headers.length) continue
    const row: Record<string, string> = {}
    for (let j = 0; j < headers.length; j++) row[headers[j]] = values[j] ?? ''
    films.push(parseFilm(row, i))
  }
  return films
}

export function computeDatasetSummary(films: BollywoodFilm[]): DatasetSummary {
  const years = films.map(f => f.release_year).filter(Boolean)
  const genres = [...new Set(films.map(f => f.primary_genre).filter(Boolean))].sort()
  const verdicts: Record<string, number> = {}
  for (const f of films) {
    if (f.verdict_raw) verdicts[f.verdict_raw] = (verdicts[f.verdict_raw] || 0) + 1
  }
  return {
    totalFilms: films.length,
    filmsWithBudget: films.filter(f => f.budget_cr !== null && f.budget_cr > 0).length,
    filmsWithGross: films.filter(f => f.worldwide_gross_cr !== null && f.worldwide_gross_cr > 0).length,
    dateRange: { min: Math.min(...years), max: Math.max(...years) },
    genres,
    verdicts,
  }
}
