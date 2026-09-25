/*
  PRIMARY benchmark — walk-forward (forward-chaining) evaluation.
  Train on films released before year Y, test on year Y, rolling 2010-2025.
  Full scoring engine (ML blend + Bayesian + components) retrained per fold.
  Emits the canonical results fixture consumed by the UI and docs:
  src/generated/benchmark-results.json
  Run: npm run benchmark
*/
import { writeFileSync, mkdirSync } from 'fs'
import { createHash, } from 'crypto'
import { readFileSync } from 'fs'
import { join } from 'path'
import { computeDatasetStats } from '../src/lib/dataset-stats'
import { trainModels, predictMultiple } from '../src/lib/ml-predictor'
import { calculateGreenlightScore } from '../src/lib/scoring-engine'
import { budgetBand } from '../src/lib/industry-constants'
import { BASE_PCT_THRESHOLDS } from '../src/lib/config'
import { wilsonCI, bootstrapCI, setCISeed } from '../src/lib/confidence-interval'
import {
  MIN_TRAIN_YEAR, loadFinanceFilms, loadAllFilms, actualClass, isHit, verdictFromPct,
  correctness, classVerdict, actualNormalizedMultiple, makeInput,
} from './backtest-helpers'

const csvPath = join(process.cwd(), 'src', 'data', 'bollywood_input.csv')
const text = readFileSync(csvPath, 'utf-8')
const datasetSha = createHash('sha256').update(text).digest('hex').slice(0, 16)

const withFinance = loadFinanceFilms()
const totalRows = loadAllFilms().length
const years = [...new Set(withFinance.map(f => f.release_year).filter((y): y is number => y !== null && y >= MIN_TRAIN_YEAR))].sort()

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
  alwaysFlopCorrect: number
  bandMedianCorrect: number
}

interface FilmRecord {
  score: number
  realMarketPct: number
  normMult: number
  actual: string
  isHit: boolean
  band: string
  budget: number
  title: string
  filmId: string
  gbmPrediction: number
  bandMedianPrediction: number
  riskCapped: boolean
}

function sweepVerdict(r: FilmRecord, offset: number): string {
  const base = BASE_PCT_THRESHOLDS[r.band] ?? BASE_PCT_THRESHOLDS['30-60']!
  const glThresh = Math.max(1, Math.min(99, base.gl + offset))
  const condThresh = Math.max(1, Math.min(99, base.cond + offset))
  let verdict: string
  if (r.realMarketPct >= glThresh) verdict = 'GREENLIGHT'
  else if (r.realMarketPct >= condThresh) verdict = 'CONDITIONAL'
  else verdict = 'DONT_INVEST'
  /* The risk cap is offset-independent (risk doesn't move with thresholds) */
  if (verdict === 'GREENLIGHT' && r.riskCapped) verdict = 'CONDITIONAL'
  return verdict
}

const foldResults: FoldResult[] = []
const allFilmRecords: FilmRecord[] = []

/* Aggregate baseline accumulators (train-side, leak-free) */
let trainHitsTotal = 0, trainNTotal = 0
let modelSqErr = 0, bandSqErr = 0, rmseN = 0
let alwaysFlopCorrectTotal = 0
let bandMedianCorrectTotal = 0
let baselineNTotal = 0

for (const year of years) {
  const trainFilms = withFinance.filter(f => f.release_year !== null && f.release_year < year && f.release_year >= MIN_TRAIN_YEAR)
  const testFilms = withFinance.filter(f => f.release_year !== null && f.release_year === year)
  if (trainFilms.length < 50 || testFilms.length < 5) continue

  const trainStats = computeDatasetStats(trainFilms)
  trainModels(trainFilms)

  /* Train-side band medians of the normalized target (leak-free baseline inputs) */
  const bandNorms: Record<string, number[]> = {}
  const trainNorms: number[] = []
  for (const f of trainFilms) {
    const nm = actualNormalizedMultiple(f)
    trainNorms.push(nm)
    const b = budgetBand(f.budget_cr!)
    ;(bandNorms[b] ??= []).push(nm)
  }
  const median = (arr: number[]): number => {
    const s = [...arr].sort((a, b) => a - b)
    const mid = Math.floor(s.length / 2)
    return s.length % 2 === 0 ? (s[mid - 1]! + s[mid]!) / 2 : s[mid]!
  }
  const bandMedianNorm: Record<string, number> = {}
  for (const [b, arr] of Object.entries(bandNorms)) bandMedianNorm[b] = median(arr)
  const globalMedianNorm = median(trainNorms)
  const trainFlopRate = trainNorms.filter(n => n < 1.0).length / trainNorms.length
  const trainHitRate = trainFilms.filter(f => isHit(actualClass(actualNormalizedMultiple(f)))).length / trainFilms.length
  trainHitsTotal += trainHitRate * trainFilms.length
  trainNTotal += trainFilms.length

  let correct = 0, total = 0
  let glCalls = 0, glHits = 0, allHits = 0
  let flopBaselineCorrect = 0
  let bandMedCorrect = 0

  for (const f of testFilms) {
    const input = makeInput(f)
    const result = calculateGreenlightScore(input, trainStats, null)
    const normMult = actualNormalizedMultiple(f)
    const actual = actualClass(normMult)
    const hit = isHit(actual)
    const v = result.verdict.toUpperCase()

    /* Baseline: always predict band-median normalized multiple (train-side medians) */
    const band = budgetBand(f.budget_cr!)
    const bandMedPred = bandMedianNorm[band] ?? globalMedianNorm
    const bandMedClass = actualClass(bandMedPred)
    const bandMedVerdict = classVerdict(bandMedClass)
    if (correctness(bandMedVerdict, actual, hit)) bandMedCorrect++

    /* Baseline: always-flop (majority class of train era) */
    if (correctness('DONT_INVEST', actual, hit) && trainFlopRate >= 0.5) flopBaselineCorrect++

    /* Model RMSE vs band-median RMSE on the normalized target */
    const gbmPred = predictMultiple(input, trainStats) ?? bandMedPred
    modelSqErr += (gbmPred - normMult) ** 2
    bandSqErr += (bandMedPred - normMult) ** 2
    rmseN++

    allFilmRecords.push({
      score: result.adjustedScore,
      realMarketPct: result.realMarketPct,
      normMult, actual, isHit: hit, band, budget: f.budget_cr!,
      title: f.display_title, filmId: f.film_id,
      gbmPrediction: gbmPred, bandMedianPrediction: bandMedPred,
      riskCapped: verdictFromPct(result.realMarketPct, band) === 'GREENLIGHT' && v !== 'GREENLIGHT',
    })

    total++
    if (hit) allHits++
    if (v === 'GREENLIGHT') {
      glCalls++
      if (hit) glHits++
    }
    if (correctness(v, actual, hit)) correct++
    baselineNTotal++
  }

  const accuracy = correct / total
  const precision = glCalls > 0 ? glHits / glCalls : 0
  const recall = allHits > 0 ? glHits / allHits : 0
  const f1 = (precision + recall) > 0 ? 2 * precision * recall / (precision + recall) : 0

  foldResults.push({ year, n: total, accuracy, precision, recall, f1, glCalls, glHits, allHits, alwaysFlopCorrect: flopBaselineCorrect, bandMedianCorrect: bandMedCorrect })
  alwaysFlopCorrectTotal += flopBaselineCorrect
  bandMedianCorrectTotal += bandMedCorrect
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
const recCI = totalAllHits > 0 ? wilsonCI(totalGLHits, totalAllHits) : { lower: 0, upper: 1 }

/* Bootstrap CI for F1 (seeded, deterministic) */
setCISeed(42)
const f1CI = bootstrapCI(allFilmRecords, (sample) => {
  let glC = 0, glH = 0, hits = 0
  for (const r of sample) {
    const v = sweepVerdict(r, 0)
    if (r.isHit) hits++
    if (v === 'GREENLIGHT') { glC++; if (r.isHit) glH++ }
  }
  const p = glC > 0 ? glH / glC : 0
  const rc = hits > 0 ? glH / hits : 0
  return (p + rc) > 0 ? 2 * p * rc / (p + rc) : 0
}, 1000)

/* ───── Naive baselines ───── */
const trainHitRate = trainHitsTotal / trainNTotal
const alwaysFlopAccuracy = alwaysFlopCorrectTotal / baselineNTotal
const bandMedianAccuracy = bandMedianCorrectTotal / baselineNTotal
const modelRmse = Math.sqrt(modelSqErr / rmseN)
const bandMedianRmse = Math.sqrt(bandSqErr / rmseN)

console.log(`\n=== FORWARD-CHAINING EVALUATION (${foldResults.length} folds, ${totalTests} films) ===\n`)
console.log(`Accuracy: ${(avgAcc*100).toFixed(1)}% [${(accCI.lower*100).toFixed(1)}%, ${(accCI.upper*100).toFixed(1)}%]`)
console.log(`Greenlight Precision: ${(avgPrec*100).toFixed(1)}% [${(precCI.lower*100).toFixed(1)}%, ${(precCI.upper*100).toFixed(1)}%]`)
console.log(`Greenlight Recall: ${(avgRec*100).toFixed(1)}% [${(recCI.lower*100).toFixed(1)}%, ${(recCI.upper*100).toFixed(1)}%]`)
console.log(`F1 Score: ${(avgF1*100).toFixed(1)}% [${(f1CI.lower*100).toFixed(1)}%, ${(f1CI.upper*100).toFixed(1)}%]`)
console.log(`Greenlight Calls: ${totalGLCalls} (${totalGLHits} hits of ${totalAllHits} total)`)

console.log(`\nNaive baselines (same folds, same rule):`)
console.log(`  Always-flop accuracy: ${(alwaysFlopAccuracy*100).toFixed(1)}%`)
console.log(`  Band-median-multiple accuracy: ${(bandMedianAccuracy*100).toFixed(1)}%`)
console.log(`  RMSE on normalized multiple — model: ${modelRmse.toFixed(3)}, band-median baseline: ${bandMedianRmse.toFixed(3)}`)
console.log(`  Train-set hit rate (GL-at-prevalence expected precision): ${(trainHitRate*100).toFixed(1)}%`)

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
    const verdict = sweepVerdict(r, offset)

    total++
    if (r.isHit) allHits++
    if (verdict === 'GREENLIGHT') {
      glCalls++
      if (r.isHit) glHits++
    }
    if (correctness(verdict, r.actual, r.isHit)) correct++
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

  const opt = bestF1!.offset
  const conf: Record<string, Record<string, number>> = {
    GREENLIGHT: { HIT: 0, BLOCKBUSTER: 0, BREAK_EVEN: 0, BELOW_AVG: 0, FLOP: 0 },
    CONDITIONAL: { HIT: 0, BLOCKBUSTER: 0, BREAK_EVEN: 0, BELOW_AVG: 0, FLOP: 0 },
    DONT_INVEST: { HIT: 0, BLOCKBUSTER: 0, BREAK_EVEN: 0, BELOW_AVG: 0, FLOP: 0 },
  }
  for (const r of allFilmRecords) {
    const verdict = sweepVerdict(r, opt)
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
console.log(`\nAggregated: ${totalTests} films, avg acc=${(avgAcc*100).toFixed(1)}% (always-flop=${(alwaysFlopAccuracy*100).toFixed(1)}%)`)

/* ───── Canonical results fixture ───── */
const pct = (x: number) => Math.round(x * 1000) / 10
const fixture = {
  benchmark: 'walk-forward-forward-chaining',
  primary: true,
  generatedAt: new Date().toISOString().slice(0, 10),
  dataset: { file: 'src/data/bollywood_input.csv', sha256: datasetSha, rows: totalRows, trainableFilms: withFinance.length },
  folds: { count: foldResults.length, minTrainYear: MIN_TRAIN_YEAR, testedFilms: totalTests },
  metrics: {
    accuracy: { value: pct(avgAcc), ci95: [pct(accCI.lower), pct(accCI.upper)] },
    greenlightPrecision: { value: pct(avgPrec), ci95: [pct(precCI.lower), pct(precCI.upper)] },
    greenlightRecall: { value: pct(avgRec), ci95: [pct(recCI.lower), pct(recCI.upper)] },
    f1: { value: pct(avgF1), ci95: [pct(f1CI.lower), pct(f1CI.upper)] },
    greenlightCalls: { calls: totalGLCalls, hits: totalGLHits, totalHits: totalAllHits },
  },
  baselines: {
    alwaysFlopAccuracy: { value: pct(alwaysFlopAccuracy), note: 'majority-class: predict DONT_INVEST for every film, fold train-side flop rate > 50%' },
    bandMedianMultiple: { accuracy: pct(bandMedianAccuracy), rmse: Math.round(modelRmse === 0 ? 0 : bandMedianRmse * 1000) / 1000, note: 'predict the training-set band-median normalized multiple for every film' },
    modelRmseNormalizedMultiple: { value: Math.round(modelRmse * 1000) / 1000, note: 'GBM RMSE on the normalized multiple vs the band-median baseline RMSE above' },
    trainHitRatePrevalence: { value: pct(trainHitRate), note: 'expected GL precision if greenlighting at random = base hit rate' },
  },
  byYear: foldResults.map(r => ({
    year: r.year, n: r.n,
    accuracy: pct(r.accuracy), precision: pct(r.precision), recall: pct(r.recall), f1: pct(r.f1),
    glCalls: r.glCalls, glHits: r.glHits,
  })),
  thresholdSweep: bestF1 ? { bestF1Offset: bestF1.offset, bestF1: pct(bestF1.f1), currentOffset: 0 } : null,
}

const outDir = join(process.cwd(), 'src', 'generated')
mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'benchmark-results.json'), JSON.stringify(fixture, null, 2) + '\n')
console.log(`\nFixture written: src/generated/benchmark-results.json (dataset ${datasetSha})`)
