/*
  APPENDIX benchmark — 75-25 random split (in-distribution upper bound).
  Random splitting leaks future films into training, inflating metrics.
  This is NOT a headline benchmark: walk-forward (npm run benchmark) is primary.
  Emits: src/generated/benchmark-75-25.json (labeled appendix).
  Run: npm run benchmark:75-25
*/
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { parseCSV } from '../src/lib/csv-parser'
import { computeDatasetStats } from '../src/lib/dataset-stats'
import { imputeFinance } from '../src/lib/impute-finance'
import { trainModels, getModelStatus } from '../src/lib/ml-predictor'
import { calculateGreenlightScore } from '../src/lib/scoring-engine'
import { budgetBand, normalizedMultiple } from '../src/lib/industry-constants'
import { BASE_PCT_THRESHOLDS, backtestRights, backtestConcept } from '../src/lib/config'
import type { EvaluationInput } from '../src/lib/types'

const csvPath = join(process.cwd(), 'src', 'data', 'bollywood_input.csv')
const text = readFileSync(csvPath, 'utf-8')
const films = imputeFinance(parseCSV(text))

/* Seeded PRNG (Mulberry32) for reproducible split */
let rngState = 42
function seededRandom(): number {
  rngState |= 0; rngState = rngState + 0x6D2B79F5 | 0
  let t = Math.imul(rngState ^ rngState >>> 15, 1 | rngState)
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
  return ((t ^ t >>> 14) >>> 0) / 4294967296
}

/* Fisher-Yates shuffle */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(seededRandom() * (i + 1))
    const tmp = a[i]!
    a[i] = a[j]!
    a[j] = tmp
  }
  return a
}

/* Filter to films with budget+gross (exclude imputed rows) */
const withFinance = films.filter(f =>
  f.budget_cr !== null && f.budget_cr > 0 &&
  f.worldwide_gross_cr !== null && f.worldwide_gross_cr > 0 &&
  !f.is_imputed_finance
)

const shuffled = shuffle(withFinance)
const splitIdx = Math.floor(shuffled.length * 0.75)
const trainFilms = shuffled.slice(0, splitIdx)
const testFilms = shuffled.slice(splitIdx)

console.log(`Total films with finance: ${withFinance.length}`)
console.log(`Train: ${trainFilms.length} (75%), Test: ${testFilms.length} (25%)`)

/* Train on 75% */
console.log('\nTraining models...')
const trainStats = computeDatasetStats(trainFilms)
trainModels(trainFilms)
console.log(`ML model status: GBM=${getModelStatus().gbm}, Bayes=${getModelStatus().bayes}, trained on ${getModelStatus().filmCount} films`)

/* Score training set for data-driven percentiles */
interface TrainScore { score: number }
const trainScores: TrainScore[] = []
for (const f of trainFilms) {
  const rights = backtestRights(f.budget_cr!, f.release_year)
  const concept = backtestConcept()
  const input: EvaluationInput = {
    filmTitle: f.display_title ?? 'Train',
    secondaryGenre: f.secondary_genre ?? '',
    sequelFlag: f.sequel_flag,
    logline: 'Train',
    primaryGenre: f.primary_genre,
    director: f.director ?? 'Unknown',
    leadActor1: f.lead_actor_1 ?? 'Unknown',
    productionHouse: f.production_house ?? '',
    directorTier: f.director_tier_proxy,
    actorTier: f.actor_tier_proxy,
    totalBudgetCr: f.budget_cr!,
    productionBudgetCr: f.budget_cr! * 0.6,
    pAndABudgetCr: f.budget_cr! * 0.25,
    contingencyPercent: 10,
    releaseMonth: f.release_month_num ?? 6,
    marketTiming: 'neutral',
    theatricalSharePercent: 40,
    financingCostCr: f.budget_cr! * 0.05,
    ottRightsCr: rights.ottRightsCr,
    satelliteRightsCr: rights.satelliteRightsCr,
    musicRightsCr: rights.musicRightsCr,
    overseasRightsCr: rights.overseasRightsCr,
    brandRevenueCr: rights.brandRevenueCr,
    conceptClarity: concept.conceptClarity,
    novelty: concept.novelty,
  }
  const result = calculateGreenlightScore(input, trainStats, null)
  trainScores.push({ score: result.adjustedScore })
}

/* Compute data-driven percentile buckets from training set */
const sortedTrain = [...trainScores].map(s => s.score).sort((a, b) => a - b)
const n = sortedTrain.length
const dataPercentiles: [number, number][] = [
  [98, sortedTrain[Math.floor(n * 0.98)]!],
  [95, sortedTrain[Math.floor(n * 0.95)]!],
  [90, sortedTrain[Math.floor(n * 0.90)]!],
  [82, sortedTrain[Math.floor(n * 0.82)]!],
  [72, sortedTrain[Math.floor(n * 0.72)]!],
  [60, sortedTrain[Math.floor(n * 0.60)]!],
  [48, sortedTrain[Math.floor(n * 0.48)]!],
  [38, sortedTrain[Math.floor(n * 0.38)]!],
  [28, sortedTrain[Math.floor(n * 0.28)]!],
  [18, sortedTrain[Math.floor(n * 0.18)]!],
  [10, sortedTrain[Math.floor(n * 0.10)]!],
  [5, sortedTrain[Math.floor(n * 0.05)]!],
]

console.log('\nData-driven percentile buckets (from training set):')
for (const [pct, score] of dataPercentiles) {
  console.log(`  P${pct} = score ${score.toFixed(1)}`)
}

/* Map test score to data-driven percentile */
function scoreToDataPct(score: number): number {
  for (const [pct, s] of dataPercentiles) {
    if (score >= s) return pct
  }
  return 1
}

/* Score test set */
interface Result {
  score: number
  pct: number
  dataPct: number
  normMult: number
  actual: string
  isHit: boolean
  band: string
  verdict: string
  riskCapped: boolean
  budget: number
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

const results: Result[] = []
for (const f of testFilms) {
  const rights = backtestRights(f.budget_cr!, f.release_year)
  const concept = backtestConcept()
  const input: EvaluationInput = {
    filmTitle: f.display_title ?? 'Test',
    secondaryGenre: f.secondary_genre ?? '',
    sequelFlag: f.sequel_flag,
    logline: 'Evaluation',
    primaryGenre: f.primary_genre,
    director: f.director ?? 'Unknown',
    leadActor1: f.lead_actor_1 ?? 'Unknown',
    productionHouse: f.production_house ?? '',
    directorTier: f.director_tier_proxy,
    actorTier: f.actor_tier_proxy,
    totalBudgetCr: f.budget_cr!,
    productionBudgetCr: f.budget_cr! * 0.6,
    pAndABudgetCr: f.budget_cr! * 0.25,
    contingencyPercent: 10,
    releaseMonth: f.release_month_num ?? 6,
    marketTiming: 'neutral',
    theatricalSharePercent: 40,
    financingCostCr: f.budget_cr! * 0.05,
    ottRightsCr: rights.ottRightsCr,
    satelliteRightsCr: rights.satelliteRightsCr,
    musicRightsCr: rights.musicRightsCr,
    overseasRightsCr: rights.overseasRightsCr,
    brandRevenueCr: rights.brandRevenueCr,
    conceptClarity: concept.conceptClarity,
    novelty: concept.novelty,
  }

  const result = calculateGreenlightScore(input, trainStats, null)
  const normMult = normalizedMultiple(f.worldwide_gross_cr! / f.budget_cr!, f.budget_cr!, f.release_year)
  const actual = actualClass(normMult)

  const uncapped75 = (() => {
    const t = BASE_PCT_THRESHOLDS[budgetBand(f.budget_cr!)] ?? BASE_PCT_THRESHOLDS['30-60']!
    return result.realMarketPct >= t.gl ? 'GREENLIGHT' : result.realMarketPct >= t.cond ? 'CONDITIONAL' : 'DONT_INVEST'
  })()
  results.push({
    score: result.adjustedScore,
    pct: result.realMarketPct,
    riskCapped: uncapped75 === 'GREENLIGHT' && result.verdict.toUpperCase() !== 'GREENLIGHT',
    dataPct: scoreToDataPct(result.adjustedScore),
    normMult,
    actual,
    isHit: isHit(actual),
    band: budgetBand(f.budget_cr!),
    verdict: result.verdict,
    budget: f.budget_cr!,
  })
}

/* Compute metrics */
const total = results.length
let correct = 0
let glCalls = 0, glHits = 0, allHits = 0
  let condCalls = 0
  let dontInvestCalls = 0

const confusion: Record<string, Record<string, number>> = {
  GREENLIGHT: { HIT: 0, BLOCKBUSTER: 0, BREAK_EVEN: 0, BELOW_AVG: 0, FLOP: 0 },
  CONDITIONAL: { HIT: 0, BLOCKBUSTER: 0, BREAK_EVEN: 0, BELOW_AVG: 0, FLOP: 0 },
  DONT_INVEST: { HIT: 0, BLOCKBUSTER: 0, BREAK_EVEN: 0, BELOW_AVG: 0, FLOP: 0 },
}

for (const r of results) {
  const v = r.verdict.toUpperCase()
  const row = confusion[v]!
  row[r.actual] = (row[r.actual] ?? 0) + 1

  if (r.isHit) allHits++
  if (v === 'GREENLIGHT') {
    glCalls++
    if (r.isHit) glHits++
  }
  if (v === 'CONDITIONAL') condCalls++
  if (v === 'DONT_INVEST') dontInvestCalls++

  let c = false
  if (v === 'GREENLIGHT' && r.isHit) c = true
  else if (v === 'CONDITIONAL' && (r.actual === 'BREAK_EVEN' || r.actual === 'BELOW_AVG')) c = true
  else if (v === 'DONT_INVEST' && (r.actual === 'FLOP' || r.actual === 'BELOW_AVG')) c = true
  if (c) correct++
}

const accuracy = correct / total
const precision = glCalls > 0 ? glHits / glCalls : 0
const recall = allHits > 0 ? glHits / allHits : 0
const f1 = (precision + recall) > 0 ? 2 * precision * recall / (precision + recall) : 0

/* Wilson 95% CI */
function wilsonCI(pos: number, n: number, z = 1.96): { lower: number; upper: number } {
  if (n === 0) return { lower: 0, upper: 1 }
  const p = pos / n
  const denom = 1 + z * z / n
  const centre = (p + z * z / (2 * n)) / denom
  const margin = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / denom
  return { lower: Math.max(0, centre - margin), upper: Math.min(1, centre + margin) }
}

const accCI = wilsonCI(correct, total)
const precCI = glCalls > 0 ? wilsonCI(glHits, glCalls) : { lower: 0, upper: 1 }
const recCI = allHits > 0 ? wilsonCI(glHits, allHits) : { lower: 0, upper: 1 }

console.log(`\n=== 75-25 RANDOM SPLIT EVALUATION (full engine) ===`)
console.log(`APPENDIX ONLY — in-distribution upper bound. Temporal leakage: future films`)
console.log(`leak into training under random splitting, so these numbers are INFLATED.`)
console.log(`The primary benchmark is walk-forward: npm run benchmark (src/generated/benchmark-results.json).\n`)

console.log(`Overall Accuracy: ${(accuracy * 100).toFixed(1)}% (${correct}/${total})`)
console.log(`  Wilson 95% CI: [${(accCI.lower * 100).toFixed(1)}%, ${(accCI.upper * 100).toFixed(1)}%]\n`)

console.log(`Greenlight Precision: ${(precision * 100).toFixed(1)}%`)
console.log(`  Wilson 95% CI: [${(precCI.lower * 100).toFixed(1)}%, ${(precCI.upper * 100).toFixed(1)}%]`)
console.log(`Greenlight Recall: ${(recall * 100).toFixed(1)}%`)
console.log(`  Wilson 95% CI: [${(recCI.lower * 100).toFixed(1)}%, ${(recCI.upper * 100).toFixed(1)}%]`)
console.log(`F1 Score: ${(f1 * 100).toFixed(1)}%\n`)

console.log(`Greenlight Calls: ${glCalls} (${glHits} hits)`)
console.log(`Conditional Calls: ${condCalls}`)
console.log(`Don't Invest Calls: ${dontInvestCalls}\n`)

/* Naive baselines */
const flops = results.filter(r => r.actual === 'FLOP').length
console.log('Naive baselines:')
console.log(`  Always predict "flop" accuracy: ${(flops / total * 100).toFixed(1)}%`)

/* Confusion matrix */
console.log('\nConfusion Matrix:')
console.log('               | BLOCKBUSTER | HIT | BREAK_EVEN | BELOW_AVG | FLOP')
console.log('  GREENLIGHT   |' + ['BLOCKBUSTER', 'HIT', 'BREAK_EVEN', 'BELOW_AVG', 'FLOP'].map(k => ` ${String(confusion.GREENLIGHT![k] ?? 0).padStart(10)}`).join(' |'))
console.log('  CONDITIONAL  |' + ['BLOCKBUSTER', 'HIT', 'BREAK_EVEN', 'BELOW_AVG', 'FLOP'].map(k => ` ${String(confusion.CONDITIONAL![k] ?? 0).padStart(10)}`).join(' |'))
console.log('  DONT_INVEST  |' + ['BLOCKBUSTER', 'HIT', 'BREAK_EVEN', 'BELOW_AVG', 'FLOP'].map(k => ` ${String(confusion.DONT_INVEST![k] ?? 0).padStart(10)}`).join(' |'))

/* Per-band breakdown */
console.log('\nPer-band breakdown:')
const bands = ['<10', '10-30', '30-60', '60-100', '100-200', '200-300', '>300']
for (const band of bands) {
  const bandResults = results.filter(r => r.band === band)
  if (bandResults.length === 0) continue
  const bandHits = bandResults.filter(r => r.isHit).length
  const bandGL = bandResults.filter(r => r.verdict.toUpperCase() === 'GREENLIGHT').length
  const bandGLHits = bandResults.filter(r => r.verdict.toUpperCase() === 'GREENLIGHT' && r.isHit).length
  const bandPrec = bandGL > 0 ? bandGLHits / bandGL : 0
  console.log(`  ${band}: n=${bandResults.length}, hits=${bandHits}, GL=${bandGL}, GL prec=${(bandPrec * 100).toFixed(1)}%`)
}


function sweepVerdict75(pct: number, band: string, offset: number, riskCapped: boolean): string {
  const base = BASE_PCT_THRESHOLDS[band] ?? BASE_PCT_THRESHOLDS['30-60']!
  const glThresh = Math.max(1, Math.min(99, base.gl + offset))
  const condThresh = Math.max(1, Math.min(99, base.cond + offset))
  let verdict: string
  if (pct >= glThresh) verdict = 'GREENLIGHT'
  else if (pct >= condThresh) verdict = 'CONDITIONAL'
  else verdict = 'DONT_INVEST'
  if (verdict === 'GREENLIGHT' && riskCapped) verdict = 'CONDITIONAL'
  return verdict
}

/* ───── Threshold calibration sweep ───── */
console.log('\n\n=== Threshold Sweep (75-25 split) ===')
console.log('Offset  |  Acc    Prec   Rec    F1     GL calls  GL hits  All hits')
console.log('--------|---------------------------------------------------------')

interface SweepRow { offset: number; acc: number; prec: number; rec: number; f1: number; glCalls: number; glHits: number; allHits: number }
let bestSweep: SweepRow | null = null

for (let offset = -15; offset <= 20; offset += 1) {
  let correct = 0, total = 0
  let glCalls = 0, glHits = 0, allHits = 0

  for (const r of results) {
    const verdict = sweepVerdict75(r.pct, r.band, offset, r.riskCapped)

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

  if (!bestSweep || row.f1 > bestSweep.f1) bestSweep = row
}

if (bestSweep) {
  console.log(`\nOptimal (hardcoded PCT): offset ${bestSweep.offset > 0 ? '+' : ''}${bestSweep.offset} ` +
    `(F1=${(bestSweep.f1 * 100).toFixed(1)}%, acc=${(bestSweep.acc * 100).toFixed(1)}%, ` +
    `prec=${(bestSweep.prec * 100).toFixed(1)}%, rec=${(bestSweep.rec * 100).toFixed(1)}%, ` +
    `GL calls=${bestSweep.glCalls}, GL hits=${bestSweep.glHits}/${bestSweep.allHits})`)
}

/* ───── Data-driven percentile sweep ───── */
console.log('\n\n=== Data-Driven Percentile Sweep ===')
console.log('Offset  |  Acc    Prec   Rec    F1     GL calls  GL hits  All hits')
console.log('--------|---------------------------------------------------------')

let bestData: SweepRow | null = null

for (let offset = -15; offset <= 20; offset += 1) {
  let correct = 0, total = 0
  let glCalls = 0, glHits = 0, allHits = 0

  for (const r of results) {
    const verdict = sweepVerdict75(r.dataPct, r.band, offset, r.riskCapped)

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

  if (!bestData || row.f1 > bestData.f1) bestData = row
}

if (bestData) {
  console.log(`\nOptimal (data-driven PCT): offset ${bestData.offset > 0 ? '+' : ''}${bestData.offset} ` +
    `(F1=${(bestData.f1 * 100).toFixed(1)}%, acc=${(bestData.acc * 100).toFixed(1)}%, ` +
    `prec=${(bestData.prec * 100).toFixed(1)}%, rec=${(bestData.rec * 100).toFixed(1)}%, ` +
    `GL calls=${bestData.glCalls}, GL hits=${bestData.glHits}/${bestData.allHits})`)

  /* Show confusion at best data-driven offset */
  console.log('\nConfusion at optimal data-driven offset:')
  const bestConf: Record<string, Record<string, number>> = {
    GREENLIGHT: { HIT: 0, BLOCKBUSTER: 0, BREAK_EVEN: 0, BELOW_AVG: 0, FLOP: 0 },
    CONDITIONAL: { HIT: 0, BLOCKBUSTER: 0, BREAK_EVEN: 0, BELOW_AVG: 0, FLOP: 0 },
    DONT_INVEST: { HIT: 0, BLOCKBUSTER: 0, BREAK_EVEN: 0, BELOW_AVG: 0, FLOP: 0 },
  }
  for (const r of results) {
    const verdict = sweepVerdict75(r.dataPct, r.band, bestData.offset, r.riskCapped)
    const bcRow = bestConf[verdict]!
    bcRow[r.actual] = (bcRow[r.actual] ?? 0) + 1
  }
  console.log('               | BLOCKBUSTER | HIT | BREAK_EVEN | BELOW_AVG | FLOP')
  console.log('  GREENLIGHT   |' + ['BLOCKBUSTER', 'HIT', 'BREAK_EVEN', 'BELOW_AVG', 'FLOP'].map(k => ` ${String(bestConf.GREENLIGHT![k] ?? 0).padStart(10)}`).join(' |'))
  console.log('  CONDITIONAL  |' + ['BLOCKBUSTER', 'HIT', 'BREAK_EVEN', 'BELOW_AVG', 'FLOP'].map(k => ` ${String(bestConf.CONDITIONAL![k] ?? 0).padStart(10)}`).join(' |'))
  console.log('  DONT_INVEST  |' + ['BLOCKBUSTER', 'HIT', 'BREAK_EVEN', 'BELOW_AVG', 'FLOP'].map(k => ` ${String(bestConf.DONT_INVEST![k] ?? 0).padStart(10)}`).join(' |'))
}

/* Sample errors (top 10) using data-driven optimal offset */
const optOffset = bestData ? bestData.offset : 0
console.log('\nSample errors with optimal data-driven offset:')
const evalWithOffset = results.map(r => {
  const verdict = sweepVerdict75(r.dataPct, r.band, optOffset, r.riskCapped)

  let correct = false
  if (verdict === 'GREENLIGHT' && r.isHit) correct = true
  else if (verdict === 'CONDITIONAL' && (r.actual === 'BREAK_EVEN' || r.actual === 'BELOW_AVG')) correct = true
  else if (verdict === 'DONT_INVEST' && (r.actual === 'FLOP' || r.actual === 'BELOW_AVG')) correct = true

  return { ...r, verdict, correct }
}).filter(r => !r.correct).sort((a, b) => Math.abs(b.dataPct - 50) - Math.abs(a.dataPct - 50)).slice(0, 10)

for (const r of evalWithOffset) {
  console.log(`  ₹${r.budget}Cr, ${r.normMult.toFixed(2)}x norm, actual=${r.actual}, pred=${r.verdict} (score=${r.score}, dataPct=${r.dataPct})`)
}

/* ───── Appendix fixture ───── */
const pct = (x: number) => Math.round(x * 1000) / 10
const fixture = {
  benchmark: '75-25-random-split',
  primary: false,
  appendixOnly: true,
  caveat: 'In-distribution upper bound. Inflated by temporal leakage (future films leak into training). Never quote as a headline metric.',
  generatedAt: new Date().toISOString().slice(0, 10),
  trainFilms: trainFilms.length,
  testFilms: total,
  metrics: {
    accuracy: { value: pct(accuracy), ci95: [pct(accCI.lower), pct(accCI.upper)] },
    greenlightPrecision: { value: pct(precision), ci95: [pct(precCI.lower), pct(precCI.upper)] },
    greenlightRecall: { value: pct(recall), ci95: [pct(recCI.lower), pct(recCI.upper)] },
    f1: { value: pct(f1) },
    greenlightCalls: { calls: glCalls, hits: glHits, totalHits: allHits },
  },
  naiveBaseline: { alwaysFlopAccuracy: pct(flops / total) },
}

const outDir = join(process.cwd(), 'src', 'generated')
mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'benchmark-75-25.json'), JSON.stringify(fixture, null, 2) + '\n')
console.log(`\nAppendix fixture written: src/generated/benchmark-75-25.json`)
