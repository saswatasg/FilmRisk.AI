import { readFileSync } from 'fs'
import { join } from 'path'
import { parseCSV } from '../src/lib/csv-parser'
import { computeDatasetStats } from '../src/lib/dataset-stats'
import { imputeFinance } from '../src/lib/impute-finance'
import { trainModels } from '../src/lib/ml-predictor'
import { calculateGreenlightScore } from '../src/lib/scoring-engine'
import { budgetBand, normalizedMultiple } from '../src/lib/industry-constants'
import { BASE_PCT_THRESHOLDS, backtestRights, backtestConcept } from '../src/lib/config'
import { wilsonCI } from '../src/lib/confidence-interval'
import type { EvaluationInput } from '../src/lib/types'

const csvPath = join(__dirname, '..', 'src', 'data', 'bollywood_input.csv')
const text = readFileSync(csvPath, 'utf-8')
const allFilms = imputeFinance(parseCSV(text))

const withFinance = allFilms.filter(f =>
  f.budget_cr !== null && f.budget_cr > 0 &&
  f.worldwide_gross_cr !== null && f.worldwide_gross_cr > 0 &&
  !f.is_imputed_finance
)

const MIN_TRAIN_YEAR = 2010
const years = [...new Set(withFinance.map(f => f.release_year).filter((y): y is number => y !== null && y >= MIN_TRAIN_YEAR))].sort()

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

function makeInput(f: typeof withFinance[number]): EvaluationInput {
  const rights = backtestRights(f.budget_cr!, f.release_year)
  const concept = backtestConcept(f.verdict_raw)
  return {
    filmTitle: f.display_title,
    secondaryGenre: f.secondary_genre,
    sequelFlag: f.sequel_flag,
    logline: '',
    primaryGenre: f.primary_genre,
    director: f.director,
    leadActor1: f.lead_actor_1,
    directorTier: f.director_tier_proxy,
    actorTier: f.actor_tier_proxy,
    productionHouse: f.production_house,
    totalBudgetCr: f.budget_cr!,
    productionBudgetCr: f.budget_cr! * 0.6,
    pAndABudgetCr: f.budget_cr! * 0.25,
    contingencyPercent: 10,
    ottRightsCr: rights.ottRightsCr,
    satelliteRightsCr: rights.satelliteRightsCr,
    musicRightsCr: rights.musicRightsCr,
    overseasRightsCr: rights.overseasRightsCr,
    brandRevenueCr: rights.brandRevenueCr,
    financingCostCr: f.budget_cr! * 0.05,
    theatricalSharePercent: 40,
    marketTiming: 'neutral',
    releaseMonth: f.release_month_num ?? 6,
    conceptClarity: concept.conceptClarity,
    novelty: concept.novelty,
  }
}

interface FoldResult {
  year: number
  n: number
  accuracy: number
  precision: number
  recall: number
  f1: number
  glCalls: number
  glHits: number
  allHits: number
}

/* Per-film record for threshold sweep */
interface FilmRecord {
  score: number
  realMarketPct: number
  normMult: number
  actual: string
  isHit: boolean
  band: string
  budget: number
}

const foldResults: FoldResult[] = []
const allFilmRecords: FilmRecord[] = []

for (const year of years) {
  const trainFilms = withFinance.filter(f => f.release_year !== null && f.release_year < year && f.release_year >= MIN_TRAIN_YEAR)
  const testFilms = withFinance.filter(f => f.release_year !== null && f.release_year === year)
  if (trainFilms.length < 50 || testFilms.length < 5) continue

  const trainStats = computeDatasetStats(trainFilms)
  trainModels(trainFilms)

  let correct = 0, total = 0
  let glCalls = 0, glHits = 0, allHits = 0

  for (const f of testFilms) {
    const input = makeInput(f)
    const result = calculateGreenlightScore(input, trainStats, null)
    const normMult = normalizedMultiple(f.worldwide_gross_cr! / f.budget_cr!, f.budget_cr!, f.release_year)
    const actual = actualClass(normMult)
    const hit = isHit(actual)
    const v = result.verdict.toUpperCase()

    /* Store for sweep */
    allFilmRecords.push({
      score: result.adjustedScore,
      realMarketPct: result.realMarketPct,
      normMult,
      actual,
      isHit: hit,
      band: budgetBand(f.budget_cr!),
      budget: f.budget_cr!,
    })

    total++
    if (hit) allHits++
    if (v === 'GREENLIGHT') {
      glCalls++
      if (hit) glHits++
    }
    let c = false
    if (v === 'GREENLIGHT' && hit) c = true
    else if (v === 'CONDITIONAL' && (actual === 'BREAK_EVEN' || actual === 'BELOW_AVG')) c = true
    else if (v === 'DONT_INVEST' && (actual === 'FLOP' || actual === 'BELOW_AVG')) c = true
    if (c) correct++
  }

  const accuracy = correct / total
  const precision = glCalls > 0 ? glHits / glCalls : 0
  const recall = allHits > 0 ? glHits / allHits : 0
  const f1 = (precision + recall) > 0 ? 2 * precision * recall / (precision + recall) : 0

  foldResults.push({ year, n: total, accuracy, precision, recall, f1, glCalls, glHits, allHits })
  console.log(`  ${year}: n=${total}, acc=${(accuracy*100).toFixed(1)}%, prec=${(precision*100).toFixed(1)}%, rec=${(recall*100).toFixed(1)}%, F1=${(f1*100).toFixed(1)}%, GL=${glCalls}(${glHits}h)`)
}

/* ───── Aggregate metrics ───── */
const totalTests = foldResults.reduce((s, r) => s + r.n, 0)
const totalCorrect = foldResults.reduce((s, r) => s + Math.round(r.accuracy * r.n), 0)
const totalGLCalls = foldResults.reduce((s, r) => s + r.glCalls, 0)
const totalGLHits = foldResults.reduce((s, r) => s + r.glHits, 0)
const totalAllHits = foldResults.reduce((s, r) => s + r.allHits, 0)

const avgAcc = totalCorrect / totalTests
const avgPrec = totalGLCalls > 0 ? totalGLHits / totalGLCalls : 0
const avgRec = totalAllHits > 0 ? totalGLHits / totalAllHits : 0
const avgF1 = (avgPrec + avgRec) > 0 ? 2 * avgPrec * avgRec / (avgPrec + avgRec) : 0

const accCI = wilsonCI(totalCorrect, totalTests)
const precCI = totalGLCalls > 0 ? wilsonCI(totalGLHits, totalGLCalls) : { lower: 0, upper: 1 }

/* Naive baselines */
const allNormMults = withFinance.map(f => normalizedMultiple(f.worldwide_gross_cr! / f.budget_cr!, f.budget_cr!, f.release_year))
const flopRate = allNormMults.filter(n => n < 1.0).length / allNormMults.length

console.log(`\n=== FORWARD-CHAINING EVALUATION (${foldResults.length} folds, ${totalTests} films) ===\n`)
console.log(`Accuracy: ${(avgAcc*100).toFixed(1)}% [${(accCI.lower*100).toFixed(1)}%, ${(accCI.upper*100).toFixed(1)}%]`)
console.log(`Greenlight Precision: ${(avgPrec*100).toFixed(1)}% [${(precCI.lower*100).toFixed(1)}%, ${(precCI.upper*100).toFixed(1)}%]`)
console.log(`Greenlight Recall: ${(avgRec*100).toFixed(1)}%`)
console.log(`F1 Score: ${(avgF1*100).toFixed(1)}%`)
console.log(`Greenlight Calls: ${totalGLCalls} (${totalGLHits} hits of ${totalAllHits} total)`)

console.log(`\nNaive baselines:`)
console.log(`  Always-flop accuracy: ${(Math.max(flopRate, 1-flopRate)*100).toFixed(1)}%`)

/* ───── Threshold sweep ───── */
console.log(`\n=== THRESHOLD SWEEP (forward-chaining, ${totalTests} films) ===`)
console.log('Offset  |  Acc    Prec   Rec    F1     GL calls  GL hits  All hits')
console.log('--------|---------------------------------------------------------')

interface SweepRow { offset: number; acc: number; prec: number; rec: number; f1: number; glCalls: number; glHits: number; allHits: number }
let bestF1: SweepRow | null = null
let bestAcc: SweepRow | null = null

for (let offset = -15; offset <= 20; offset += 1) {
  let correct = 0, total = 0
  let glCalls = 0, glHits = 0, allHits = 0

  for (const r of allFilmRecords) {
    const base = BASE_PCT_THRESHOLDS[r.band] ?? BASE_PCT_THRESHOLDS['30-60']!
    const glThresh = Math.max(1, Math.min(99, base.gl + offset))
    const condThresh = Math.max(1, Math.min(99, base.cond + offset))

    let verdict: string
    if (r.realMarketPct >= glThresh) verdict = 'GREENLIGHT'
    else if (r.realMarketPct >= condThresh) verdict = 'CONDITIONAL'
    else verdict = 'DONT_INVEST'

    total++
    if (r.isHit) allHits++
    if (verdict === 'GREENLIGHT') {
      glCalls++
      if (r.isHit) glHits++
    }

    let c = false
    if (verdict === 'GREENLIGHT' && r.isHit) c = true
    else if (verdict === 'CONDITIONAL' && (r.actual === 'BREAK_EVEN' || r.actual === 'BELOW_AVG')) c = true
    else if (verdict === 'DONT_INVEST' && (r.actual === 'FLOP' || r.actual === 'BELOW_AVG')) c = true
    if (c) correct++
  }

  const prec = glCalls > 0 ? glHits / glCalls : 0
  const rec = allHits > 0 ? glHits / allHits : 0
  const f1 = (prec + rec) > 0 ? 2 * prec * rec / (prec + rec) : 0
  const row: SweepRow = { offset, acc: correct / total, prec, rec, f1, glCalls, glHits, allHits }

  console.log(`  ${offset > 0 ? '+' : ''}${offset}    | ${(row.acc * 100).toFixed(1)}   ${(row.prec * 100).toFixed(1)}   ${(row.rec * 100).toFixed(1)}   ${(row.f1 * 100).toFixed(1)}   ${String(glCalls).padStart(7)}   ${glHits}        ${allHits}`)

  if (!bestF1 || row.f1 > bestF1.f1) bestF1 = row
  if (!bestAcc || row.acc > bestAcc.acc) bestAcc = row
}

if (bestF1) {
  console.log(`\nBest by F1: offset ${bestF1.offset > 0 ? '+' : ''}${bestF1.offset} ` +
    `(F1=${(bestF1.f1 * 100).toFixed(1)}%, acc=${(bestF1.acc * 100).toFixed(1)}%, ` +
    `prec=${(bestF1.prec * 100).toFixed(1)}%, rec=${(bestF1.rec * 100).toFixed(1)}%, ` +
    `GL calls=${bestF1.glCalls}, GL hits=${bestF1.glHits}/${bestF1.allHits})`)
}
if (bestAcc) {
  console.log(`Best by Acc: offset ${bestAcc.offset > 0 ? '+' : ''}${bestAcc.offset} ` +
    `(acc=${(bestAcc.acc * 100).toFixed(1)}%, F1=${(bestAcc.f1 * 100).toFixed(1)}%, ` +
    `prec=${(bestAcc.prec * 100).toFixed(1)}%, rec=${(bestAcc.rec * 100).toFixed(1)}%, ` +
    `GL calls=${bestAcc.glCalls}, GL hits=${bestAcc.glHits}/${bestAcc.allHits})`)

  /* Confusion at best-F1 offset */
  const opt = bestF1!.offset
  const conf: Record<string, Record<string, number>> = {
    GREENLIGHT: { HIT: 0, BLOCKBUSTER: 0, BREAK_EVEN: 0, BELOW_AVG: 0, FLOP: 0 },
    CONDITIONAL: { HIT: 0, BLOCKBUSTER: 0, BREAK_EVEN: 0, BELOW_AVG: 0, FLOP: 0 },
    DONT_INVEST: { HIT: 0, BLOCKBUSTER: 0, BREAK_EVEN: 0, BELOW_AVG: 0, FLOP: 0 },
  }
  for (const r of allFilmRecords) {
    const base = BASE_PCT_THRESHOLDS[r.band] ?? BASE_PCT_THRESHOLDS['30-60']!
    const glThresh = Math.max(1, Math.min(99, base.gl + opt))
    const condThresh = Math.max(1, Math.min(99, base.cond + opt))
    let verdict: string
    if (r.realMarketPct >= glThresh) verdict = 'GREENLIGHT'
    else if (r.realMarketPct >= condThresh) verdict = 'CONDITIONAL'
    else verdict = 'DONT_INVEST'
    const row = conf[verdict]!
    row[r.actual] = (row[r.actual] ?? 0) + 1
  }
  console.log('\nConfusion at best-F1 offset:')
  console.log('               | BLOCKBUSTER | HIT | BREAK_EVEN | BELOW_AVG | FLOP')
  console.log('  GREENLIGHT   |' + ['BLOCKBUSTER', 'HIT', 'BREAK_EVEN', 'BELOW_AVG', 'FLOP'].map(k => ` ${String(conf.GREENLIGHT![k] ?? 0).padStart(10)}`).join(' |'))
  console.log('  CONDITIONAL  |' + ['BLOCKBUSTER', 'HIT', 'BREAK_EVEN', 'BELOW_AVG', 'FLOP'].map(k => ` ${String(conf.CONDITIONAL![k] ?? 0).padStart(10)}`).join(' |'))
  console.log('  DONT_INVEST  |' + ['BLOCKBUSTER', 'HIT', 'BREAK_EVEN', 'BELOW_AVG', 'FLOP'].map(k => ` ${String(conf.DONT_INVEST![k] ?? 0).padStart(10)}`).join(' |'))
}

/* ───── Walk-forward detail ───── */
console.log(`\n=== WALK-FORWARD DETAIL BY YEAR ===`)
for (const r of foldResults) {
  console.log(`  ${r.year}: n=${r.n} acc=${(r.accuracy*100).toFixed(1)}% prec=${(r.precision*100).toFixed(1)}% rec=${(r.recall*100).toFixed(1)}% F1=${(r.f1*100).toFixed(1)}% GL=${r.glCalls}(${r.glHits}h)`)
}
console.log(`\nAggregated: ${totalTests} films, avg acc=${(avgAcc*100).toFixed(1)}% (always-flop=${(Math.max(flopRate, 1-flopRate)*100).toFixed(1)}%)`)
