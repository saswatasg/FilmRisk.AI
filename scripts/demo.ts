/*
  PR9 — buyer demo: end-to-end pipeline in a single command.
  Loads the raw CSV → trains models → scores three frozen synthetic demo films →
  prints a summary and writes docs/demo-output.md. Zero manual steps.
  Run: npm run demo
*/
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { loadDataset } from '../src/lib/dataset-loader'
import { calculateGreenlightScore } from '../src/lib/scoring-engine'
import { analyzeSensitivities } from '../src/lib/sensitivity-analysis'
import type { EvaluationInput } from '../src/lib/types'

/* Frozen synthetic demo films (not real projects). Mid-size drama, big action, small horror. */
const DEMO_FILMS: EvaluationInput[] = [
  {
    filmTitle: 'Demo: Mid-size Drama',
    primaryGenre: 'Drama', secondaryGenre: '', sequelFlag: false,
    logline: 'A family drama set in small-town India.',
    conceptClarity: 7, novelty: 5,
    director: 'Demo Director', leadActor1: 'Demo Actor',
    directorTier: 'B', actorTier: 'B', productionHouse: 'Maddock Films',
    totalBudgetCr: 35, productionBudgetCr: 21, pAndABudgetCr: 9, contingencyPercent: 10,
    ottRightsCr: 8, satelliteRightsCr: 2, musicRightsCr: 2, overseasRightsCr: 3, brandRevenueCr: 1,
    financingCostCr: 1.75, theatricalSharePercent: 40,
    marketTiming: 'neutral', releaseMonth: 10,
  },
  {
    filmTitle: 'Demo: Big Action Film',
    primaryGenre: 'Action', secondaryGenre: '', sequelFlag: false,
    logline: 'A large-scale action spectacle.',
    conceptClarity: 6, novelty: 6,
    director: 'Demo Director', leadActor1: 'Demo Star',
    directorTier: 'A', actorTier: 'S', productionHouse: 'Yash Raj Films',
    totalBudgetCr: 180, productionBudgetCr: 108, pAndABudgetCr: 45, contingencyPercent: 10,
    ottRightsCr: 45, satelliteRightsCr: 10, musicRightsCr: 8, overseasRightsCr: 15, brandRevenueCr: 5,
    financingCostCr: 9, theatricalSharePercent: 42,
    marketTiming: 'strong', releaseMonth: 8,
  },
  {
    filmTitle: 'Demo: Small Horror Film',
    primaryGenre: 'Horror', secondaryGenre: '', sequelFlag: false,
    logline: 'A contained horror film with a new cast.',
    conceptClarity: 8, novelty: 7,
    director: 'Demo Director', leadActor1: 'Demo Newcomer',
    directorTier: 'C', actorTier: 'C', productionHouse: '',
    totalBudgetCr: 8, productionBudgetCr: 5, pAndABudgetCr: 2, contingencyPercent: 10,
    ottRightsCr: 1, satelliteRightsCr: 0, musicRightsCr: 0, overseasRightsCr: 0, brandRevenueCr: 0,
    financingCostCr: 0.4, theatricalSharePercent: 38,
    marketTiming: 'neutral', releaseMonth: 6,
  },
]

function main(): void {
  console.log('\n=== FilmRisk.AI demo — raw CSV to scored films ===\n')

  const { films, stats } = loadDataset()
  console.log(`Dataset: ${films.length} films loaded, models trained.\n`)

  const fixture = JSON.parse(readFileSync(join(process.cwd(), 'src', 'generated', 'benchmark-results.json'), 'utf-8')) as {
    metrics: { accuracy: { value: number }; greenlightPrecision: { value: number } }
    folds: { count: number; testedFilms: number }
  }
  console.log(`Benchmark (walk-forward fixture): accuracy ${fixture.metrics.accuracy.value}%, ` +
    `GL precision ${fixture.metrics.greenlightPrecision.value}% — ${fixture.folds.count} folds, ${fixture.folds.testedFilms} films.\n`)

  const md: string[] = []
  md.push(`# Demo Output (regenerable: \`npm run demo\`)`)
  md.push(``)
  md.push(`Three frozen synthetic films scored end-to-end from the raw CSV. Not real projects.`)
  md.push(``)

  for (const input of DEMO_FILMS) {
    const result = calculateGreenlightScore(input, stats, null)
    const levers = analyzeSensitivities(input, stats)
    const drivers = result.mlAttribution
      ? [...result.mlAttribution.features].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)).slice(0, 3)
      : []

    console.log(`${input.filmTitle}`)
    console.log(`  Score ${result.adjustedScore}/100 · ${result.verdict.toUpperCase()} · P${result.realMarketPct} · CI ±${result.confidenceInterval.upper}`)
    console.log(`  Top levers: ${levers.slice(0, 3).map(l => `${l.label} (${l.potentialGain >= 0 ? '+' : ''}${l.potentialGain})`).join(', ') || 'none material'}\n`)

    md.push(`## ${input.filmTitle}`)
    md.push(``)
    md.push(`- Score: **${result.adjustedScore}/100** — verdict **${result.verdict.toUpperCase()}** — market rank P${result.realMarketPct} (±${result.confidenceInterval.upper} CI)`)
    md.push(`- Evidence ${result.evidenceScore}/100 (${result.evidencePct}% dataset-derived) · Input ${result.inputScore}/100`)
    if (drivers.length > 0) {
      md.push(`- Top ML drivers: ${drivers.map(d => `${d.name} (${d.contribution >= 0 ? '+' : ''}${d.contribution.toFixed(2)}×)`).join(', ')}`)
    }
    md.push(`- Levers: ${levers.map(l => `${l.label} (${l.potentialGain >= 0 ? '+' : ''}${l.potentialGain} pts)`).join('; ') || 'no single change moves the score materially'}`)
    md.push(``)
  }

  writeFileSync(join(process.cwd(), 'docs', 'demo-output.md'), md.join('\n'))
  console.log('Report written: docs/demo-output.md')
}

main()
