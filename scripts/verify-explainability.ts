/*
  PR7 acceptance tests — explainability & sensitivity.
  1. Component contributions sum exactly to the reported total (additive breakdown).
  2. ML path attribution is internally consistent (base + offset + Σ = prediction;
     top driver direction matches the prediction's direction from base).
  3. ≥3 distinct input perturbations produce different, finite scores (no silent no-ops).
  4. Sensitivity levers are consistent with direct re-scores (display-string bug class).
  5. CIs accompany every point estimate in the evaluation output.
  Run: npm run verify:pr7
*/
import { loadDataset } from '../src/lib/dataset-loader'
import { calculateGreenlightScore, } from '../src/lib/scoring-engine'
import { calculateFinancierRisk } from '../src/lib/scoring-engine'
import { calculateFinancialProjection } from '../src/lib/financial-simulator'
import { analyzeSensitivities, analyzeScenarioMoves } from '../src/lib/sensitivity-analysis'
import { loadFinanceFilms, makeInput } from './backtest-helpers'
import type { EvaluationInput } from '../src/lib/types'

let allPass = true
function check(name: string, cond: boolean, detail = ''): boolean {
  console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
  if (!cond) allPass = false
  return cond
}

const TEST_INPUT: EvaluationInput = {
  filmTitle: 'Acceptance Test Film',
  primaryGenre: 'Action',
  secondaryGenre: '',
  sequelFlag: false,
  logline: 'test',
  conceptClarity: 6,
  novelty: 5,
  director: 'Test Director',
  leadActor1: 'Test Actor',
  directorTier: 'B',
  actorTier: 'B',
  productionHouse: '',
  totalBudgetCr: 45,
  productionBudgetCr: 27,
  pAndABudgetCr: 11,
  contingencyPercent: 10,
  ottRightsCr: 5,
  satelliteRightsCr: 2,
  musicRightsCr: 1,
  overseasRightsCr: 2,
  brandRevenueCr: 1,
  financingCostCr: 2,
  theatricalSharePercent: 40,
  marketTiming: 'neutral',
  releaseMonth: 6,
}

function main(): void {
  console.log('\n=== PR7 — Explainability & sensitivity acceptance tests ===\n')

  const { stats } = loadDataset()
  const fullFinance = loadFinanceFilms().sort((a, b) => a.film_id.localeCompare(b.film_id))
  const sample = [0, 100, 200, 300, 400].map(i => fullFinance[i]!).filter(Boolean)
  check('Sample of 5 films available for consistency checks', sample.length === 5, `got ${sample.length}`)

  /* 1 + 2. Additive components + attribution consistency on 5 films */
  let additiveOk = 0, attributionOk = 0, directionOk = 0
  const titles: string[] = []
  for (const f of sample) {
    const input = makeInput(f)
    const result = calculateGreenlightScore(input, stats, null)
    titles.push(f.display_title)

    const sumContrib = result.components.reduce((s, c) => s + (c.contribution || 0), 0)
    if (Math.abs(sumContrib * 10 - result.totalScore) <= 0.05) additiveOk++

    const attr = result.mlAttribution
    if (attr) {
      const attrSum = attr.features.reduce((s, x) => s + x.contribution, 0)
      if (Math.abs(attr.base + attr.offset + attrSum - attr.prediction) < 1e-3) attributionOk++
      const attributed = attr.prediction - attr.base - attr.offset
      const top3 = [...attr.features].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)).slice(0, 3)
      const top3Net = top3.reduce((s, x) => s + x.contribution, 0)
      if (Math.abs(top3Net) < 0.01 || Math.sign(top3Net) === Math.sign(attributed) || attributed === 0) directionOk++
    }
  }
  check('Component contributions sum to totalScore on 5 films (additive breakdown)', additiveOk === 5, `${additiveOk}/5 — ${titles.join(', ')}`)
  check('ML attribution identity holds (base + offset + Σ = prediction) on 5 films', attributionOk === 5, `${attributionOk}/5`)
  check('Top attribution driver direction matches prediction direction on 5 films', directionOk === 5, `${directionOk}/5`)

  /* 3. Engine responds to ≥3 distinct perturbations (no silent no-ops) */
  const base = calculateGreenlightScore(TEST_INPUT, stats, null)
  const perturbations: { name: string; input: EvaluationInput }[] = [
    { name: 'budget overrun +20%', input: { ...TEST_INPUT, totalBudgetCr: 54 } },
    { name: 'actor tier B→A', input: { ...TEST_INPUT, actorTier: 'A' } },
    { name: 'release month 6→12', input: { ...TEST_INPUT, releaseMonth: 12 } },
  ]
  let distinctOk = 0
  for (const p of perturbations) {
    const r = calculateGreenlightScore(p.input, stats, null)
    const ok = Number.isFinite(r.totalScore) && r.totalScore !== base.totalScore
    if (ok) distinctOk++
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  perturbation "${p.name}" → ${base.totalScore} → ${r.totalScore}`)
    if (!ok) allPass = false
  }
  check('≥3 distinct perturbations produce different, finite scores', distinctOk >= 3, `${distinctOk}/3`)

  /* 4. Tool-level consistency: levers match direct re-scores */
  const levers = analyzeSensitivities(TEST_INPUT, stats)
  const { immaterial } = analyzeScenarioMoves(TEST_INPUT, stats)
  const finiteGains = levers.every(l => Number.isFinite(l.potentialGain) && Math.abs(l.potentialGain) > 0.5)
  check('All returned levers carry finite, material gains', finiteGains, `${levers.length} levers`)

  const leversAgain = analyzeSensitivities(TEST_INPUT, stats)
  check('Sensitivity output is deterministic across runs', JSON.stringify(levers) === JSON.stringify(leversAgain))

  /* Overrun lever must appear when the overrun effect is material (anti silent-drop) */
  const overrunRescore = calculateGreenlightScore({ ...TEST_INPUT, totalBudgetCr: 54 }, stats, null)
  const overrunGain = Math.round((overrunRescore.totalScore - base.totalScore) * 10) / 10
  const overrunMaterial = overrunGain < -0.5
  const overrunPresent = levers.some(l => l.label === 'Budget Overrun')
  check('Budget Overrun lever present when its effect is material (no silent no-op)',
    !overrunMaterial || overrunPresent, `overrun gain=${overrunGain}`)

  /* Tier lever must appear when the upgrade effect is material */
  const tierRescore = calculateGreenlightScore({ ...TEST_INPUT, actorTier: 'A' }, stats, null)
  const tierGain = Math.round((tierRescore.totalScore - base.totalScore) * 10) / 10
  const tierMaterial = tierGain > 0.5
  const tierPresent = levers.some(l => l.label === 'Actor Tier')
  check('Actor Tier lever present when its upgrade effect is material (typed test values)',
    !tierMaterial || tierPresent, `tier gain=${tierGain}`)

  /* Immaterial moves: tested, negligible, disjoint from material levers */
  const immaterialFinite = immaterial.every(m => Number.isFinite(m.gain) && Math.abs(m.gain) <= 0.5)
  check('Immaterial moves are finite and negligible (|gain| ≤ 0.5)', immaterialFinite, `${immaterial.length} moves`)
  const leverLabels = new Set(levers.map(l => l.label))
  const disjoint = immaterial.every(m => !leverLabels.has(m.label))
  check('Immaterial moves are disjoint from material levers (no double-counting)', disjoint)
  const immaterialAgain = analyzeScenarioMoves(TEST_INPUT, stats).immaterial
  check('Immaterial output is deterministic across runs', JSON.stringify(immaterial) === JSON.stringify(immaterialAgain))

  /* Budget downshift classified consistently with its direct re-score */
  const downRescore = calculateGreenlightScore({ ...TEST_INPUT, totalBudgetCr: 36 }, stats, null)
  const downGain = Math.round((downRescore.totalScore - base.totalScore) * 10) / 10
  const downInLevers = levers.some(l => l.label === 'Budget Downshift')
  const downInImmaterial = immaterial.some(m => m.label === 'Budget Downshift')
  const downConsistent = (Math.abs(downGain) > 0.5 && downInLevers) || (Math.abs(downGain) <= 0.5 && downInImmaterial)
  check('Budget Downshift appears in exactly the right list for its effect size',
    downConsistent, `downshift gain=${downGain}`)

  /* 5. CIs alongside every point estimate */
  const fin = calculateFinancierRisk(TEST_INPUT, stats, null)
  const proj = calculateFinancialProjection(TEST_INPUT, stats, base.adjustedScore)
  check('Greenlight score carries a finite confidence interval', Number.isFinite(base.confidenceInterval.upper))
  check('Financier risk carries a finite confidence interval', Number.isFinite(fin.confidenceInterval.upper))
  check('Monte Carlo carries p10–p90 bands (uncertainty, not a point)', [proj.monteCarlo.p10, proj.monteCarlo.p50, proj.monteCarlo.p90].every(s => Number.isFinite(s.grossCr)))

  console.log(`\n${allPass ? 'ALL PR7 CHECKS PASSED' : 'PR7 CHECKS FAILED'}\n`)
  process.exit(allPass ? 0 : 1)
}

main()
