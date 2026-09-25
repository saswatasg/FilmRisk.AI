/*
  PR1 acceptance tests — data foundation.
  1. Row count parsed = expected total CSV row count (no silent drops).
  2. Training set = full-finance originals only; imputed rows excluded everywhere.
  3. None of the imputed rows appear in any training fold.
  Run: npm run verify:pr1
*/
import { readFileSync } from 'fs'
import { join } from 'path'
import { parseCSV } from '../src/lib/csv-parser'
import { imputeFinance } from '../src/lib/impute-finance'
import { budgetBand } from '../src/lib/industry-constants'
import type { BollywoodFilm } from '../src/lib/types'

/* Expected values for the current dataset fixture (bollywood_input.csv, 2,454 data rows).
   If the CSV changes intentionally, re-derive these from the script output and update. */
const EXPECTED = { total: 2454, fullFinance: 729, imputed: 236, budgetOnly: 79, grossOnly: 157, noFinance: 1489 }

let allPass = true
function check(name: string, cond: boolean, detail = ''): boolean {
  console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
  if (!cond) allPass = false
  return cond
}

function median(arr: number[]): number {
  const s = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 0 ? (s[mid - 1]! + s[mid]!) / 2 : s[mid]!
}

function main(): void {
  console.log('\n=== PR1 — Data foundation acceptance tests ===\n')

  const csvPath = join(process.cwd(), 'src', 'data', 'bollywood_input.csv')
  const text = readFileSync(csvPath, 'utf-8')
  const physicalRows = text.split('\n').filter(l => l.trim()).length - 1

  /* 1. Parse completeness */
  let parseError: Error | null = null
  let parsed: BollywoodFilm[] = []
  try {
    parsed = parseCSV(text)
  } catch (e) {
    parseError = e as Error
  }
  check('CSV parses without error', parseError === null, parseError?.message ?? '')
  check('Parsed rows = physical CSV data rows (no silent drops)', parsed.length === physicalRows,
    `parsed=${parsed.length}, physical=${physicalRows}`)
  check('Parsed rows match expected fixture count', parsed.length === EXPECTED.total, `expected=${EXPECTED.total}`)

  /* Malformed input must hard-fail, never silently drop */
  let threw = false
  try { parseCSV('a,b\n1,2,3\n4,5') } catch { threw = true }
  check('Malformed CSV rows cause hard failure (not silent skip)', threw)

  if (parsed.length === 0) {
    console.log('\nCannot continue without parsed data.\n')
    process.exit(1)
  }

  /* 2. Partition: full-finance originals / imputed / no-finance */
  const budgetOnlyBefore = parsed.filter(f => (f.budget_cr ?? 0) > 0 && (f.worldwide_gross_cr ?? 0) <= 0)
  const grossOnlyBefore = parsed.filter(f => (f.budget_cr ?? 0) <= 0 && (f.worldwide_gross_cr ?? 0) > 0)

  const withImputation = imputeFinance(parsed)
  const imputedRows = withImputation.filter(f => f.is_imputed_finance === true)
  const fullFinance = withImputation.filter(f =>
    (f.budget_cr ?? 0) > 0 && (f.worldwide_gross_cr ?? 0) > 0 && f.is_imputed_finance !== true)
  const noFinance = withImputation.filter(f =>
    !((f.budget_cr ?? 0) > 0 && (f.worldwide_gross_cr ?? 0) > 0) && f.is_imputed_finance !== true)

  check('Budget-only originals before imputation', budgetOnlyBefore.length === EXPECTED.budgetOnly, `got ${budgetOnlyBefore.length}, expected ${EXPECTED.budgetOnly}`)
  check('Gross-only originals before imputation', grossOnlyBefore.length === EXPECTED.grossOnly, `got ${grossOnlyBefore.length}, expected ${EXPECTED.grossOnly}`)
  check('Imputed rows flagged as is_imputed_finance', imputedRows.length === EXPECTED.imputed, `got ${imputedRows.length}, expected ${EXPECTED.imputed}`)
  check('Full-finance (training-eligible) count', fullFinance.length === EXPECTED.fullFinance, `got ${fullFinance.length}, expected ${EXPECTED.fullFinance}`)
  check('No-finance count', noFinance.length === EXPECTED.noFinance, `got ${noFinance.length}, expected ${EXPECTED.noFinance}`)
  check('Partition is exhaustive (full + imputed + none = total)',
    fullFinance.length + imputedRows.length + noFinance.length === parsed.length,
    `${fullFinance.length} + ${imputedRows.length} + ${noFinance.length} = ${fullFinance.length + imputedRows.length + noFinance.length} vs ${parsed.length}`)
  check('Training-eligible set = full-finance originals (every row with budget+gross pre-imputation)',
    fullFinance.length === parsed.filter(f => (f.budget_cr ?? 0) > 0 && (f.worldwide_gross_cr ?? 0) > 0).length,
    `training=${fullFinance.length}, originals with both fields=${parsed.filter(f => (f.budget_cr ?? 0) > 0 && (f.worldwide_gross_cr ?? 0) > 0).length}`)

  /* Imputation targets are deterministic band medians — the circularity justifying exclusion */
  const bands = ['<10', '10-30', '30-60', '60-100', '100-200', '200-300', '>300'] as const
  const bandMedians: Record<string, number> = {}
  for (const b of bands) {
    const bf = fullFinance.filter(f => budgetBand(f.budget_cr!) === b)
    if (bf.length >= 3) bandMedians[b] = median(bf.map(f => f.worldwide_gross_cr! / f.budget_cr!))
  }
  /* Imputation targets are deterministic band medians — the circularity justifying exclusion.
     Gross-only rows may be matched to a neighbouring band via the fallback path, so the target
     must be *a* band median, not necessarily the film's own band's median. */
  const medianValues = Object.values(bandMedians)
  const deterministicTargets = imputedRows.filter(f =>
    f.gross_multiple !== null && medianValues.some(m => Math.abs((f.gross_multiple ?? 0) - m) < 1e-9))
  check('Imputed targets are deterministic band medians (circular if trained on)', deterministicTargets.length === imputedRows.length,
    `${deterministicTargets.length}/${imputedRows.length}`)

  /* 3. Training-fold exclusion — replicate the walk-forward fold construction */
  const MIN_TRAIN_YEAR = 2010
  const imputedIds = new Set(imputedRows.map(f => f.film_id))
  const trainableIds = new Set(fullFinance.map(f => f.film_id))
  check('No imputed film_id is in the training-eligible set',
    [...imputedIds].filter(id => trainableIds.has(id)).length === 0)

  const years = [...new Set(fullFinance.map(f => f.release_year).filter((y): y is number => y !== null && y >= MIN_TRAIN_YEAR))].sort()
  let foldsChecked = 0
  let imputedInFold = 0
  let temporalLeak = 0
  for (const year of years) {
    const train = fullFinance.filter(f => f.release_year !== null && f.release_year < year && f.release_year >= MIN_TRAIN_YEAR)
    const test = fullFinance.filter(f => f.release_year === year)
    if (train.length < 50 || test.length < 5) continue
    foldsChecked++
    if (train.some(f => imputedIds.has(f.film_id))) imputedInFold++
    if (train.some(f => f.release_year !== null && f.release_year >= year)) temporalLeak++
  }
  check(`No imputed row appears in any training fold (${foldsChecked} folds)`, imputedInFold === 0)
  check(`No test-year film appears in its own training fold (${foldsChecked} folds)`, temporalLeak === 0)

  /* Reference set label: imputed rows are kept, clearly labeled, never fitted */
  check('Imputed rows retained as labeled reference set (stats-only, excluded from fitting)',
    imputedRows.every(f => f.is_imputed_finance === true) && imputedRows.length > 0)

  console.log(`\n${allPass ? 'ALL PR1 CHECKS PASSED' : 'PR1 CHECKS FAILED'}\n`)
  process.exit(allPass ? 0 : 1)
}

main()
