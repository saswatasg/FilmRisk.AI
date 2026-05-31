import type { BollywoodFilm, DatasetSummary } from './types'

function parseNumber(val: string): number | null {
  if (!val || val.trim() === '') return null
  const n = Number(val)
  return isNaN(n) ? null : n
}

function parseIntSafe(val: string): number | null {
  if (!val || val.trim() === '') return null
  const n = parseInt(val, 10)
  return isNaN(n) ? null : n
}

function parseFloatSafe(val: string): number | null {
  if (!val || val.trim() === '') return null
  const n = parseFloat(val)
  return isNaN(n) ? null : n
}

export function parseFilm(row: Record<string, string>): BollywoodFilm {
  return {
    film_id: row.film_id ?? '',
    canonical_title: row.canonical_title ?? '',
    display_title: row.display_title ?? '',
    release_year: parseIntSafe(row.release_year) ?? 0,
    release_month: row.release_month ?? '',
    release_month_num: parseIntSafe(row.release_month_num) ?? 0,
    release_date: row.release_date ?? '',
    primary_genre: row.primary_genre ?? '',
    secondary_genre: row.secondary_genre ?? '',
    all_genres: row.all_genres ?? '',
    sequel_flag: parseIntSafe(row.sequel_flag) ?? 0,
    remake_flag: parseIntSafe(row.remake_flag) ?? 0,
    director: row.director ?? '',
    lead_actor_1: row.lead_actor_1 ?? '',
    lead_actor_2: row.lead_actor_2 ?? '',
    cast_list: row.cast_list ?? '',
    writer_list: row.writer_list ?? '',
    production_house: row.production_house ?? '',
    actor_rank_score: parseFloatSafe(row.actor_rank_score) ?? 0,
    actor_tier_proxy: row.actor_tier_proxy ?? '',
    director_rank_score: parseFloatSafe(row.director_rank_score) ?? 0,
    director_tier_proxy: row.director_tier_proxy ?? '',
    budget_cr: parseFloatSafe(row.budget_cr),
    worldwide_gross_cr: parseFloatSafe(row.worldwide_gross_cr),
    gross_multiple: parseFloatSafe(row.gross_multiple),
    gross_multiple_bucket: row.gross_multiple_bucket ?? '',
    budget_band: row.budget_band ?? '',
    box_office_source_type: row.box_office_source_type ?? '',
    verdict_raw: row.verdict_raw ?? '',
    hitflop_numeric: parseFloatSafe(row.hitflop_numeric),
    imdb_rating: parseFloatSafe(row.imdb_rating),
    imdb_votes: parseIntSafe(row.imdb_votes),
    imdb_weighted_rating: parseFloatSafe(row.imdb_weighted_rating),
    imdb_id: row.imdb_id ?? '',
    runtime_min: parseIntSafe(row.runtime_min),
    certificate: row.certificate ?? '',
    overview: row.overview ?? '',
    model_usage: row.model_usage ?? '',
    financial_data_confidence: row.financial_data_confidence ?? '',
    metadata_confidence: row.metadata_confidence ?? '',
    row_quality_score: row.row_quality_score ?? '',
    stage_allowed_greenlight: row.stage_allowed_greenlight ?? '',
    source_count: parseIntSafe(row.source_count) ?? 0,
    source_files: row.source_files ?? '',
    primary_source: row.primary_source ?? '',
    dedupe_key: row.dedupe_key ?? '',
    notes: row.notes ?? '',
    concept_clarity_score: parseFloatSafe(row.concept_clarity_score),
    novelty_score: parseFloatSafe(row.novelty_score),
    theatricality_score: parseFloatSafe(row.theatricality_score),
    mass_appeal_score: parseFloatSafe(row.mass_appeal_score),
    urban_appeal_score: parseFloatSafe(row.urban_appeal_score),
    youth_appeal_score: parseFloatSafe(row.youth_appeal_score),
    family_appeal_score: parseFloatSafe(row.family_appeal_score),
    music_dependency_score: parseFloatSafe(row.music_dependency_score),
  }
}

export function parseCSV(text: string): BollywoodFilm[] {
  const lines = text.split('\n').filter(line => line.trim())
  if (lines.length < 2) return []

  const headers = parseCSVLine(lines[0])
  const films: BollywoodFilm[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    if (values.length !== headers.length) continue

    const row: Record<string, string> = {}
    for (let j = 0; j < headers.length; j++) {
      row[headers[j].trim()] = values[j]?.trim() ?? ''
    }
    films.push(parseFilm(row))
  }

  return films
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  result.push(current)
  return result
}

export function computeDatasetSummary(films: BollywoodFilm[]): DatasetSummary {
  const years = films.map(f => f.release_year).filter(Boolean)
  const genres = [...new Set(films.map(f => f.primary_genre).filter(Boolean))]
  const verdicts: Record<string, number> = {}

  for (const f of films) {
    if (f.verdict_raw) {
      verdicts[f.verdict_raw] = (verdicts[f.verdict_raw] || 0) + 1
    }
  }

  return {
    totalFilms: films.length,
    filmsWithBudget: films.filter(f => f.budget_cr !== null && f.budget_cr > 0).length,
    filmsWithGross: films.filter(f => f.worldwide_gross_cr !== null && f.worldwide_gross_cr > 0).length,
    dateRange: {
      min: Math.min(...years),
      max: Math.max(...years),
    },
    genres: genres.sort(),
    verdicts,
  }
}
