import { readFileSync } from 'fs'
import { join } from 'path'
import { parseCSV } from '../src/lib/csv-parser'
import { computeDatasetStats } from '../src/lib/dataset-stats'
import { trainModels } from '../src/lib/ml-predictor'
import { calculateGreenlightScore } from '../src/lib/scoring-engine'
import { budgetBand, normalizedMultiple } from '../src/lib/industry-constants'
import { PERCENTILE_BUCKETS, BASE_PCT_THRESHOLDS, backtestRights, backtestConcept } from '../src/lib/config'
import type { EvaluationInput } from '../src/lib/types'

const csvPath = join(process.cwd(), 'src', 'data', 'bollywood_input.csv')
const text = readFileSync(csvPath, 'utf-8')
const films = parseCSV(text)
const stats = computeDatasetStats(films)
trainModels(films)

/* Filter to testable films (2023-2025 with budget+gross), treat as OOS */
const testable = films.filter(f =>
  f.budget_cr !== null && f.budget_cr > 0 &&
  f.worldwide_gross_cr !== null && f.worldwide_gross_cr > 0 &&
  f.release_year !== null && f.release_year >= 2023
)

interface TestFilm {
  budget: number
  genre: string
  actorTier: string
  directorTier: string
  month: number
  normMult: number
  releaseYear: number | null
  verdict: string
}

const testFilms: TestFilm[] = testable.map(f => ({
  budget: f.budget_cr!,
  genre: f.primary_genre,
  actorTier: f.actor_tier_proxy,
  directorTier: f.director_tier_proxy,
  month: f.release_month_num ?? 6,
  normMult: normalizedMultiple(f.worldwide_gross_cr! / f.budget_cr!, f.budget_cr!, f.release_year),
  releaseYear: f.release_year,
  verdict: f.verdict_raw,
}))

function makeInput(f: TestFilm): EvaluationInput {
  const rights = backtestRights(f.budget, f.releaseYear)
  const concept = backtestConcept()
  return {
    filmTitle: 'Calibration',
    secondaryGenre: '',
    sequelFlag: false,
    logline: 'Calibration test',
    primaryGenre: f.genre,
    director: 'Calibration',
    leadActor1: 'Calibration',
    productionHouse: '',
    directorTier: f.directorTier,
    actorTier: f.actorTier,
    totalBudgetCr: f.budget,
    productionBudgetCr: f.budget * 0.6,
    pAndABudgetCr: f.budget * 0.25,
    contingencyPercent: 10,
    releaseMonth: f.month,
    marketTiming: 'neutral',
    theatricalSharePercent: 40,
    financingCostCr: f.budget * 0.05,
    ottRightsCr: rights.ottRightsCr,
    satelliteRightsCr: rights.satelliteRightsCr,
    musicRightsCr: rights.musicRightsCr,
    overseasRightsCr: rights.overseasRightsCr,
    brandRevenueCr: rights.brandRevenueCr,
    conceptClarity: concept.conceptClarity,
    novelty: concept.novelty,
  }
}

function scoreToPct(score: number): number {
  return PERCENTILE_BUCKETS.find(([s]) => score >= s)?.[1] ?? 1
}

function actualClass(normMult: number): string {
  if (normMult >= 2.0) return 'BLOCKBUSTER'
  if (normMult >= 1.5) return 'HIT'
  if (normMult >= 1.0) return 'BREAK_EVEN'
  if (normMult >= 0.5) return 'BELOW_AVG'
  return 'FLOP'
}

function isHit(actual: string): boolean {
  return actual === 'HIT' || actual === 'BLOCKBUSTER'
}

console.log(`\n=== Threshold Calibration (full engine, n=${testFilms.length} OOS films) ===\n`)

/* Precompute all scores */
interface ScoreResult { score: number; pct: number; normMult: number; actual: string; band: string; isHit: boolean }
const allScores: ScoreResult[] = []

for (const f of testFilms) {
  const input = makeInput(f)
  const result = calculateGreenlightScore(input, stats, null)
  const pct = scoreToPct(result.adjustedScore)
  const actual = actualClass(f.normMult)
  allScores.push({ score: result.adjustedScore, pct, normMult: f.normMult, actual, band: budgetBand(f.budget), isHit: isHit(actual) })
}

/* Sweep offsets */
console.log('Offset  |  Acc   Prec   Rec    F1    GL calls  GL hits  All hits')
console.log('--------|------------------------------------------------------')

interface SweepResult { offset: number; accuracy: number; precision: number; recall: number; f1: number; glCalls: number; glHits: number; allHits: number }

let best: SweepResult | null = null
for (let offset = -15; offset <= 10; offset += 1) {
  let correct = 0, total = 0
  let glCalls = 0, glHits = 0, allHits = 0

  for (const s of allScores) {
    const base = BASE_PCT_THRESHOLDS[s.band] ?? BASE_PCT_THRESHOLDS['30-60']!
    const glThresh = Math.max(1, Math.min(99, base.gl + offset))
    const condThresh = Math.max(1, Math.min(99, base.cond + offset))

    let verdict: string
    if (s.pct >= glThresh) verdict = 'GREENLIGHT'
    else if (s.pct >= condThresh) verdict = 'CONDITIONAL'
    else verdict = 'DONT_INVEST'

    total++
    if (s.isHit) allHits++
    if (verdict === 'GREENLIGHT') {
      glCalls++
      if (s.isHit) glHits++
    }

    let c = false
    if (verdict === 'GREENLIGHT' && s.isHit) c = true
    else if (verdict === 'CONDITIONAL' && (s.actual === 'BREAK_EVEN' || s.actual === 'BELOW_AVG')) c = true
    else if (verdict === 'DONT_INVEST' && (s.actual === 'FLOP' || s.actual === 'BELOW_AVG')) c = true
    if (c) correct++
  }

  const prec = glCalls > 0 ? glHits / glCalls : 0
  const rec = allHits > 0 ? glHits / allHits : 0
  const f1 = (prec + rec) > 0 ? 2 * prec * rec / (prec + rec) : 0
  const r: SweepResult = { offset, accuracy: correct / total, precision: prec, recall: rec, f1, glCalls, glHits, allHits }

  console.log(`  ${offset > 0 ? '+' : ''}${offset}    | ${(r.accuracy * 100).toFixed(1)}  ${(r.precision * 100).toFixed(1)}  ${(r.recall * 100).toFixed(1)}  ${(r.f1 * 100).toFixed(1)}   ${glCalls}        ${glHits}       ${allHits}`)

  if (!best || r.f1 > best.f1) best = r
}

if (best) {
  console.log(`\nOptimal: offset ${best.offset > 0 ? '+' : ''}${best.offset} ` +
    `(F1=${(best.f1 * 100).toFixed(1)}%, prec=${(best.precision * 100).toFixed(1)}%, rec=${(best.recall * 100).toFixed(1)}%, ` +
    `GL calls=${best.glCalls}, GL hits=${best.glHits}/${best.allHits} total hits)`)
  console.log(`\nRecommend updating PCT_THRESHOLDS with offset ${best.offset > 0 ? '+' : ''}${best.offset}`)

  /* Show per-band scores */
  console.log('\nScore distribution by band:')
  for (const [band, base] of Object.entries(BASE_PCT_THRESHOLDS)) {
    const bandScores = allScores.filter(s => s.band === band)
    if (bandScores.length === 0) continue
    const adjustedGl = Math.max(1, Math.min(99, base.gl + best.offset))
    const bandHits = bandScores.filter(s => s.isHit).length
    const bandGlPreds = bandScores.filter(s => s.pct >= adjustedGl)
    const bandGlHits = bandGlPreds.filter(s => s.isHit).length
    console.log(`  ${band}: n=${bandScores.length}, hits=${bandHits}, ` +
      `GL threshold=P${adjustedGl}, GL pred=${bandGlPreds.length}, GL prec=${bandGlPreds.length > 0 ? (bandGlHits / bandGlPreds.length * 100).toFixed(1) : 'N/A'}%`)
  }
}

/* Score distribution summary */
const scoreVals = allScores.map(s => s.score).sort((a, b) => a - b)
const n = scoreVals.length
console.log(`\nScore range: ${scoreVals[0]!.toFixed(1)}–${scoreVals[n - 1]!.toFixed(1)}`)
console.log(`Percentiles: P25=${scoreVals[Math.floor(n * 0.25)]!.toFixed(1)} P50=${scoreVals[Math.floor(n * 0.5)]!.toFixed(1)} P75=${scoreVals[Math.floor(n * 0.75)]!.toFixed(1)}`)
