/*
  Recalibrates PERCENTILE_BUCKETS to the CURRENT engine (neutral backtest concepts).
  Scores all 729 trainable films with the production scoring path and reads off
  empirical cutoffs at the fixed percentile ladder. Deterministic (seeded models).
  Human step afterwards: paste the printed table into src/lib/config.ts and
  document the method + date in the comment above PERCENTILE_BUCKETS.
  Run: npx tsx scripts/recalibrate-percentiles.ts
*/
import { loadDataset } from '../src/lib/dataset-loader'
import { calculateGreenlightScore } from '../src/lib/scoring-engine'
import { loadFinanceFilms, makeInput } from './backtest-helpers'

const LADDER = [98, 95, 90, 82, 72, 60, 48, 38, 28, 18, 10, 5]

function main(): void {
  const { stats } = loadDataset()
  const films = loadFinanceFilms()
  const scores = films.map(f => calculateGreenlightScore(makeInput(f), stats, null).adjustedScore)
    .sort((a, b) => a - b)
  console.log(`n=${scores.length} min=${scores[0]!.toFixed(1)} max=${scores[scores.length - 1]!.toFixed(1)}`)
  console.log('\nEmpirical cutoffs (score at-or-above => percentile):')
  console.log('PERCENTILE_BUCKETS: [number, number][] = [')
  for (const p of LADDER) {
    const idx = Math.min(scores.length - 1, Math.ceil((p / 100) * scores.length) - 1)
    const cut = Math.round(scores[Math.max(0, idx)]! * 10) / 10
    console.log(`  [${cut.toFixed(1)}, ${p}],`)
  }
  console.log(']')
}

main()
