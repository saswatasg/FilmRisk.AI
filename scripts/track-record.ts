/*
  PR6 — Out-of-sample track record report.
  Trains on all full-finance films released <= 2023, holds out 2024-2025
  (the most recent, buyer-recognizable releases). Per-film predicted score vs
  actual outcome, both naive baselines on the same holdout, and a calibration
  check: of films scored "high probability", what fraction actually hit.
  Regenerable: npm run track-record
  Emits: src/generated/track-record.json + docs/track-record.md
*/
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { computeDatasetStats } from '../src/lib/dataset-stats'
import { trainModels, predictMultiple } from '../src/lib/ml-predictor'
import { calculateGreenlightScore } from '../src/lib/scoring-engine'
import { wilsonCI } from '../src/lib/confidence-interval'
import {
  loadFinanceFilms, actualClass, isHit, correctness, classVerdict,
  actualNormalizedMultiple, makeInput, median, bandOf,
} from './backtest-helpers'

const HOLDOUT_START_YEAR = 2024

interface HoldoutRow {
  filmId: string
  title: string
  year: number
  budgetCr: number
  genre: string
  score: number
  realMarketPct: number
  verdict: string
  actual: string
  normalizedMultiple: number
  isHit: boolean
  gbmPrediction: number
  bandMedianPrediction: number
}

function main(): void {
  const all = loadFinanceFilms()
  const trainFilms = all.filter(f => (f.release_year ?? 0) <= HOLDOUT_START_YEAR - 1)
  const holdout = all.filter(f => (f.release_year ?? 0) >= HOLDOUT_START_YEAR)
    .sort((a, b) => (b.release_year ?? 0) - (a.release_year ?? 0))

  console.log(`Train (<=${HOLDOUT_START_YEAR - 1}): ${trainFilms.length} films`)
  console.log(`Holdout (>=${HOLDOUT_START_YEAR}): ${holdout.length} films\n`)

  const trainStats = computeDatasetStats(trainFilms)
  trainModels(trainFilms)

  /* Train-side band medians of the normalized target (leak-free baseline inputs) */
  const bandNorms: Record<string, number[]> = {}
  for (const f of trainFilms) {
    const b = bandOf(f.budget_cr)
    ;(bandNorms[b] ??= []).push(actualNormalizedMultiple(f))
  }
  const bandMedianNorm: Record<string, number> = {}
  for (const [b, arr] of Object.entries(bandNorms)) bandMedianNorm[b] = median(arr)
  const globalMedianNorm = median(trainFilms.map(actualNormalizedMultiple))
  const trainHits = trainFilms.filter(f => isHit(actualClass(actualNormalizedMultiple(f)))).length
  const trainHitRate = trainHits / trainFilms.length

  const rows: HoldoutRow[] = []
  let correct = 0, glCalls = 0, glHits = 0, allHits = 0
  let bandMedCorrect = 0, flopCorrect = 0
  let modelSqErr = 0, bandSqErr = 0

  for (const f of holdout) {
    const input = makeInput(f)
    const result = calculateGreenlightScore(input, trainStats, null)
    const normMult = actualNormalizedMultiple(f)
    const actual = actualClass(normMult)
    const hit = isHit(actual)
    const v = result.verdict.toUpperCase()
    const band = bandOf(f.budget_cr)
    const bandMedPred = bandMedianNorm[band] ?? globalMedianNorm
    const gbmPred = predictMultiple(input, trainStats) ?? bandMedPred

    rows.push({
      filmId: f.film_id,
      title: f.display_title,
      year: f.release_year ?? 0,
      budgetCr: f.budget_cr,
      genre: f.primary_genre,
      score: result.adjustedScore,
      realMarketPct: result.realMarketPct,
      verdict: v,
      actual,
      normalizedMultiple: Math.round(normMult * 100) / 100,
      isHit: hit,
      gbmPrediction: Math.round(gbmPred * 100) / 100,
      bandMedianPrediction: Math.round(bandMedPred * 100) / 100,
    })

    if (hit) allHits++
    if (v === 'GREENLIGHT') { glCalls++; if (hit) glHits++ }
    if (correctness(v, actual, hit)) correct++
    if (correctness(classVerdict(actualClass(bandMedPred)), actual, hit)) bandMedCorrect++
    if (correctness('DONT_INVEST', actual, hit)) flopCorrect++
    modelSqErr += (gbmPred - normMult) ** 2
    bandSqErr += (bandMedPred - normMult) ** 2
  }

  const n = rows.length
  const acc = correct / n
  const prec = glCalls > 0 ? glHits / glCalls : 0
  const rec = allHits > 0 ? glHits / allHits : 0
  const f1 = (prec + rec) > 0 ? 2 * prec * rec / (prec + rec) : 0
  const accCI = wilsonCI(correct, n)
  const precCI = glCalls > 0 ? wilsonCI(glHits, glCalls) : { lower: 0, upper: 1 }

  /* Calibration buckets by predicted market percentile */
  const buckets = [
    { name: 'P75+ (high)', test: (r: HoldoutRow) => r.realMarketPct >= 75 },
    { name: 'P60-74', test: (r: HoldoutRow) => r.realMarketPct >= 60 && r.realMarketPct < 75 },
    { name: 'P40-59', test: (r: HoldoutRow) => r.realMarketPct >= 40 && r.realMarketPct < 60 },
    { name: 'P<40 (low)', test: (r: HoldoutRow) => r.realMarketPct < 40 },
  ]
  const calibration = buckets.map(bk => {
    const inBucket = rows.filter(bk.test)
    const hits = inBucket.filter(r => r.isHit).length
    const ci = wilsonCI(hits, inBucket.length)
    return { bucket: bk.name, n: inBucket.length, hits, hitRate: inBucket.length ? hits / inBucket.length : 0, ci95: [ci.lower, ci.upper] as [number, number] }
  })

  const pct = (x: number) => Math.round(x * 1000) / 10
  const summary = {
    model: {
      accuracy: pct(acc), accuracyCI95: [pct(accCI.lower), pct(accCI.upper)],
      greenlightPrecision: pct(prec), precisionCI95: [pct(precCI.lower), pct(precCI.upper)],
      greenlightRecall: pct(rec), f1: pct(f1),
      greenlightCalls: glCalls, glHits, totalHits: allHits, n,
    },
    baselines: {
      alwaysFlopAccuracy: pct(flopCorrect / n),
      bandMedianAccuracy: pct(bandMedCorrect / n),
      bandMedianRmse: Math.round(Math.sqrt(bandSqErr / n) * 1000) / 1000,
      modelRmse: Math.round(Math.sqrt(modelSqErr / n) * 1000) / 1000,
      trainHitRatePrevalence: pct(trainHitRate),
    },
    calibration: calibration.map(c => ({
      ...c,
      hitRate: pct(c.hitRate),
      ci95: [pct(c.ci95[0]), pct(c.ci95[1])],
    })),
  }

  /* Fixture */
  const outDir = join(process.cwd(), 'src', 'generated')
  mkdirSync(outDir, { recursive: true })
  writeFileSync(join(outDir, 'track-record.json'), JSON.stringify({
    generatedAt: new Date().toISOString().slice(0, 10),
    trainFilms: trainFilms.length,
    holdoutYears: [HOLDOUT_START_YEAR, 2025],
    summary,
    films: rows,
  }, null, 2) + '\n')

  /* Markdown report */
  const md: string[] = []
  md.push(`# Out-of-Sample Track Record (2024–2025 Holdout)`)
  md.push(``)
  md.push(`> Regenerable: \`npm run track-record\`. Trained on ${trainFilms.length} full-finance films released ≤2023; tested on ${n} films released 2024–2025 that the model never saw. Fixture: \`src/generated/track-record.json\`.`)
  md.push(``)
  md.push(`## Headline (n=${n})`)
  md.push(``)
  md.push(`| Metric | Model | Naive baseline |`)
  md.push(`|---|---|---|`)
  md.push(`| Accuracy | ${pct(acc)}% [${pct(accCI.lower)}–${pct(accCI.upper)}] | always-flop ${pct(flopCorrect / n)}%, band-median ${pct(bandMedCorrect / n)}% |`)
  md.push(`| Greenlight precision | ${pct(prec)}% [${pct(precCI.lower)}–${pct(precCI.upper)}] | base hit rate ${pct(trainHitRate)}% |`)
  md.push(`| Greenlight recall | ${pct(rec)}% | — |`)
  md.push(`| F1 | ${pct(f1)}% | — |`)
  md.push(`| GL calls | ${glCalls} (${glHits} hits of ${allHits} total) | — |`)
  md.push(`| RMSE (normalized multiple) | ${summary.baselines.modelRmse} | band-median ${summary.baselines.bandMedianRmse} |`)
  md.push(``)
  md.push(`## Calibration — the financier's question`)
  md.push(``)
  md.push(`Of films the model scored "high probability", what fraction actually succeeded?`)
  md.push(``)
  md.push(`| Predicted bucket | n | Hits | Observed hit rate [95% CI] |`)
  md.push(`|---|---|---|---|`)
  for (const c of summary.calibration) {
    md.push(`| ${c.bucket} | ${c.n} | ${c.hits} | ${c.hitRate}% [${c.ci95[0]}–${c.ci95[1]}] |`)
  }
  md.push(``)
  md.push(`## Per-film record (every number traces to a film row)`)
  md.push(``)
  md.push(`| Film | Year | Budget | Actual | Predicted verdict | Score (Pctl) | Norm × | Hit? |`)
  md.push(`|---|---|---|---|---|---|---|---|`)
  for (const r of rows) {
    md.push(`| ${r.title} (\`${r.filmId}\`) | ${r.year} | ₹${r.budgetCr}Cr | ${r.actual} | ${r.verdict} | ${r.score} (P${r.realMarketPct}) | ${r.normalizedMultiple}× | ${r.isHit ? 'yes' : 'no'} |`)
  }
  md.push(``)
  md.push(`## Caveats`)
  md.push(``)
  md.push(`- n=${n} is small: calibration buckets carry wide confidence intervals. 2024–2025 follows the hardest walk-forward folds (2022/2024) — this is the toughest possible holdout, post-regime-change years.`)
  md.push(`- Concept scores (clarity/novelty) are estimated from verdicts and pre-sale rights from budget — the CSV contains neither (documented limitation, same inputs as the walk-forward benchmark).`)
  md.push(`- Imputed rows (236) are excluded from both training and the holdout.`)
  md.push(``)

  writeFileSync(join(process.cwd(), 'docs', 'track-record.md'), md.join('\n'))
  console.log(`\nTrack record: n=${n}, acc=${pct(acc)}%, prec=${pct(prec)}% [${pct(precCI.lower)}–${pct(precCI.upper)}], rec=${pct(rec)}%`)
  console.log(`Fixture: src/generated/track-record.json | Report: docs/track-record.md`)
}

main()
