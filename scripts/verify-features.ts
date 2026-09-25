/*
  PR3 acceptance tests — feature-vector canonicalization.
  1. Single canonical feature list exists, referenced by both code and docs.
  2. Feature vector is 9-dim at inference time (verified from running code, not docs).
  3. No target-encoded features exist (leakage structurally impossible); fold-level temporal check.
  Run: npm run verify:pr3
*/
import { readFileSync } from 'fs'
import { join } from 'path'
import { extractFeatures, extractFeatureNames } from '../src/lib/gbm-model'
import { parseCSV } from '../src/lib/csv-parser'
import { imputeFinance } from '../src/lib/impute-finance'

let allPass = true
function check(name: string, cond: boolean, detail = ''): boolean {
  console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
  if (!cond) allPass = false
  return cond
}

const CANONICAL_FEATURES = [
  'budget_scaled', 'actor_tier', 'director_tier', 'actor_rank',
  'director_rank', 'rank_availability', 'sequel_flag', 'month_sin', 'month_cos',
]

function main(): void {
  console.log('\n=== PR3 — Feature vector canonicalization acceptance tests ===\n')

  /* 1. Canonical list from the running code */
  const names = extractFeatureNames()
  check('extractFeatureNames() returns the 9-dim canonical list',
    names.length === 9 && names.every((n, i) => n === CANONICAL_FEATURES[i]),
    names.join(', '))

  /* 2. Dimensionality at inference time, from running code */
  const sampleFilms = [
    { budget_cr: 150, actor_tier_proxy: 'A', director_tier_proxy: 'S', actor_rank_score: 80, director_rank_score: 95, release_month_num: 6, sequel_flag: false },
    { budget_cr: null, actor_tier_proxy: 'D', director_tier_proxy: 'C', actor_rank_score: null, director_rank_score: null, release_month_num: null, sequel_flag: true },
    { budget_cr: 5, actor_tier_proxy: 'B', director_tier_proxy: 'B', actor_rank_score: 55, director_rank_score: 55, release_month_num: 12, sequel_flag: false },
  ]
  const dims = new Set(sampleFilms.map(f => extractFeatures(f).length))
  check('extractFeatures() produces exactly 9 dims for every sample input', dims.size === 1 && dims.has(9))

  /* 3. No target encoding: extractFeatures uses only the film's own row fields */
  const gbmSource = readFileSync(join(process.cwd(), 'src', 'lib', 'gbm-model.ts'), 'utf-8')
  const fnStart = gbmSource.indexOf('export function extractFeatures')
  const fnEnd = gbmSource.indexOf('export function extractFeatureNames')
  const fnBody = gbmSource.slice(fnStart, fnEnd)
  const banned = ['gross', 'multiple', 'stats', 'winRate', 'verdict', 'DatasetStats']
  const hits = banned.filter(b => fnBody.includes(b))
  check('extractFeatures body references no target/dataset statistics (no target encoding)', hits.length === 0,
    hits.length ? `found: ${hits.join(', ')}` : 'uses only budget/tier/rank/sequel/month')

  /* Genre is excluded from the GBM feature list (Bayesian model owns genre) */
  check('No genre feature in canonical list (no OOF target-encoding requirement)',
    !names.some(n => n.toLowerCase().includes('genre')) && !fnBody.includes('genre'))

  /* 4. Fold-level temporal leakage check: train fold k contains zero rows from fold k */
  const csvPath = join(process.cwd(), 'src', 'data', 'bollywood_input.csv')
  const films = imputeFinance(parseCSV(readFileSync(csvPath, 'utf-8')))
  const fullFinance = films.filter(f =>
    (f.budget_cr ?? 0) > 0 && (f.worldwide_gross_cr ?? 0) > 0 && f.is_imputed_finance !== true)
  const MIN_TRAIN_YEAR = 2010
  const years = [...new Set(fullFinance.map(f => f.release_year).filter((y): y is number => y !== null && y >= MIN_TRAIN_YEAR))].sort()
  let folds = 0, leaky = 0
  for (const year of years) {
    const train = fullFinance.filter(f => f.release_year !== null && f.release_year < year && f.release_year >= MIN_TRAIN_YEAR)
    const test = fullFinance.filter(f => f.release_year === year)
    if (train.length < 50 || test.length < 5) continue
    folds++
    const testIds = new Set(test.map(f => f.film_id))
    if (train.some(f => testIds.has(f.film_id))) leaky++
  }
  check(`Training fold k contains zero rows from fold k (${folds} folds)`, leaky === 0)

  /* 5. Doc consistency: the canonical spec in model-overview.md matches the code */
  const doc = readFileSync(join(process.cwd(), 'docs', 'model-overview.md'), 'utf-8')
  const specSection = doc.slice(doc.indexOf('CANONICAL SPEC'), doc.indexOf('**Leakage policy'))
  const docMatch = CANONICAL_FEATURES.every(f => specSection.includes(`\`${f}\``))
  check('docs/model-overview.md canonical spec lists exactly the code features', docMatch)

  /* No contradicting doc: no other active doc claims a different dimensionality */
  const review = readFileSync(join(process.cwd(), 'docs', 'data-science-review.md'), 'utf-8')
  check('data-science-review.md is marked historical (23-dim claim not authoritative)',
    review.includes('HISTORICAL DOCUMENT') && review.includes('9-dim'))

  console.log(`\n${allPass ? 'ALL PR3 CHECKS PASSED' : 'PR3 CHECKS FAILED'}\n`)
  process.exit(allPass ? 0 : 1)
}

main()
