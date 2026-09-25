/*
  Generates data-derived tier reference bands for the evaluate flow.
  Per tier: how many films, typical headline budget, dataset hit rate.
  S tier has no films in the data — scored by rank proxy, stated as such.
  Regenerate when the CSV changes: npm run tiers
  Emits: src/generated/tier-reference.json
*/
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { normalizedMultiple } from '../src/lib/industry-constants'
import { loadFinanceFilms, actualClass, isHit, median } from './backtest-helpers'

const DESCRIPTIONS: Record<string, string> = {
  S: 'Opens on name alone',
  A: 'Consistent headliner',
  B: 'Established face',
  C: 'Rising / recognisable',
  D: 'Newcomer / character actor',
}

function main(): void {
  const films = loadFinanceFilms()
  const ref: Record<string, Record<string, { label: string; desc: string; films: number; medianBudgetCr: number | null; hitRatePct: number | null }>> = {
    actor: {},
    director: {},
  }

  for (const role of ['actor', 'director'] as const) {
    for (const tier of ['S', 'A', 'B', 'C', 'D']) {
      const key = role === 'actor' ? 'actor_tier_proxy' : 'director_tier_proxy'
      const group = films.filter(f => f[key] === tier)
      if (group.length === 0) {
        ref[role]![tier] = {
          label: `${tier} tier`, desc: `${DESCRIPTIONS[tier]} — no track record in our data; scored by rank proxy`,
          films: 0, medianBudgetCr: null, hitRatePct: null,
        }
        continue
      }
      const budgets = group.map(f => f.budget_cr).sort((a, b) => a - b)
      const hits = group.filter(f => {
        const nm = normalizedMultiple(f.worldwide_gross_cr / f.budget_cr, f.budget_cr, f.release_year)
        return isHit(actualClass(nm))
      }).length
      ref[role]![tier] = {
        label: `${tier} tier`,
        desc: DESCRIPTIONS[tier]!,
        films: group.length,
        medianBudgetCr: Math.round(median(budgets) * 10) / 10,
        hitRatePct: Math.round((hits / group.length) * 1000) / 10,
      }
    }
  }

  const out = {
    generatedAt: new Date().toISOString().slice(0, 10),
    note: 'Computed from full-finance films. S tier has no data and is scored by rank proxy.',
    actor: ref.actor,
    director: ref.director,
  }
  const outDir = join(process.cwd(), 'src', 'generated')
  mkdirSync(outDir, { recursive: true })
  writeFileSync(join(outDir, 'tier-reference.json'), JSON.stringify(out, null, 2) + '\n')
  console.log('Tier reference written: src/generated/tier-reference.json')
  console.log(JSON.stringify(out, null, 2))
}

main()
