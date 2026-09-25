/*
  Flow acceptance tests — Typeform evaluate rebuild.
  1. FLOW_DEFAULTS score finite through the full engine (parity baseline).
  2. Tier-reference fixture matches recomputed CSV values (no drift).
  3. Nameless inputs pass backend validation (names/title optional).
  4. Flow outputs are deterministic.
  Run: npm run verify:flow
*/
import { readFileSync } from 'fs'
import { join } from 'path'
import { loadDataset } from '../src/lib/dataset-loader'
import { calculateGreenlightScore } from '../src/lib/scoring-engine'
import { validateInputBackend } from '../src/lib/validate-input'
import { normalizedMultiple } from '../src/lib/industry-constants'
import { FLOW_DEFAULTS } from '../src/lib/evaluate-defaults'
import { loadFinanceFilms, actualClass, isHit, median } from './backtest-helpers'

let allPass = true
function check(name: string, cond: boolean, detail = ''): boolean {
  console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
  if (!cond) allPass = false
  return cond
}

function main(): void {
  console.log('\n=== Flow — parity & defaults acceptance tests ===\n')

  const { stats } = loadDataset()

  /* 1. Defaults score finite through the full engine */
  const base = calculateGreenlightScore(FLOW_DEFAULTS, stats, null)
  check('FLOW_DEFAULTS produces a finite score through the full engine',
    Number.isFinite(base.totalScore) && Number.isFinite(base.adjustedScore),
    `total=${base.totalScore}, adjusted=${base.adjustedScore}, verdict=${base.verdict}`)

  /* Determinism */
  const again = calculateGreenlightScore(FLOW_DEFAULTS, stats, null)
  check('Flow default scoring is deterministic', JSON.stringify(base) === JSON.stringify(again))

  /* 2. Tier-reference fixture matches recomputed CSV values */
  const fixture = JSON.parse(readFileSync(join(process.cwd(), 'src', 'generated', 'tier-reference.json'), 'utf-8')) as {
    actor: Record<string, { films: number; medianBudgetCr: number | null; hitRatePct: number | null }>
    director: Record<string, { films: number; medianBudgetCr: number | null; hitRatePct: number | null }>
  }
  const films = loadFinanceFilms()
  let tierOk = true
  const tierDetail: string[] = []
  for (const role of ['actor', 'director'] as const) {
    const key = role === 'actor' ? 'actor_tier_proxy' : 'director_tier_proxy'
    for (const tier of ['S', 'A', 'B', 'C', 'D']) {
      const group = films.filter(f => f[key] === tier)
      const rec = fixture[role]?.[tier]
      if (!rec) { tierOk = false; tierDetail.push(`${role}/${tier}: missing`); continue }
      if (rec.films !== group.length) { tierOk = false; tierDetail.push(`${role}/${tier}: n ${rec.films} != ${group.length}`); continue }
      if (group.length === 0) {
        if (rec.medianBudgetCr !== null || rec.hitRatePct !== null) { tierOk = false; tierDetail.push(`${role}/${tier}: S must be null stats`) }
        continue
      }
      const budgets = group.map(f => f.budget_cr).sort((a, b) => a - b)
      const med = Math.round(median(budgets) * 10) / 10
      const hits = group.filter(f => isHit(actualClass(normalizedMultiple(f.worldwide_gross_cr / f.budget_cr, f.budget_cr, f.release_year)))).length
      const hr = Math.round((hits / group.length) * 1000) / 10
      if (rec.medianBudgetCr !== med || rec.hitRatePct !== hr) {
        tierOk = false
        tierDetail.push(`${role}/${tier}: fixture(₹${rec.medianBudgetCr}, ${rec.hitRatePct}%) != data(₹${med}, ${hr}%)`)
      }
    }
  }
  check('Tier-reference fixture matches recomputed CSV values (no drift)', tierOk, tierDetail.join('; ') || '5 tiers × 2 roles')

  /* S tier honestly marked as dataless */
  check('S tier marked as no-track-record (rank proxy stated)',
    fixture.actor['S']?.films === 0 && fixture.director['S']?.films === 0)

  /* 3. Nameless inputs pass validation */
  const nameless = { ...FLOW_DEFAULTS, filmTitle: '', director: '', leadActor1: '', logline: '' }
  check('Nameless input passes backend validation (names/title optional)', validateInputBackend(nameless).length === 0)
  const noBudget = { ...FLOW_DEFAULTS, totalBudgetCr: 0 }
  check('Zero budget still rejected (the one hard requirement)', validateInputBackend(noBudget).length > 0)
  const namelessResult = calculateGreenlightScore(nameless, stats, null)
  check('Nameless input scores finite end-to-end', Number.isFinite(namelessResult.adjustedScore))

  console.log(`\n${allPass ? 'ALL FLOW CHECKS PASSED' : 'FLOW CHECKS FAILED'}\n`)
  process.exit(allPass ? 0 : 1)
}

main()
