import type { EvaluationInput, PreSaleBenchmark } from './types'

interface MarketRange {
  category: string
  field: keyof EvaluationInput
  minPct: number
  maxPct: number
  tip: string
}

const RANGES: MarketRange[] = [
  { category: 'OTT / Digital', field: 'ottRightsCr', minPct: 0.30, maxPct: 0.60, tip: 'Performance-linked pricing standard; base ~40% of budget + slab increases' },
  { category: 'Satellite', field: 'satelliteRightsCr', minPct: 0.05, maxPct: 0.15, tip: 'Collapsed 50%+ post-pandemic; ~10% of budget typical' },
  { category: 'Music', field: 'musicRightsCr', minPct: 0.10, maxPct: 0.20, tip: 'Varies by music label and star power; emotional genres command premium' },
  { category: 'Overseas', field: 'overseasRightsCr', minPct: 0.10, maxPct: 0.25, tip: 'Heavily NRI diaspora dependent; action/masala films overperform' },
  { category: 'Brand Revenue', field: 'brandRevenueCr', minPct: 0.05, maxPct: 0.15, tip: 'Growing stream; highest for family and sports genres' },
]

export function computePreSaleBenchmarks(input: EvaluationInput): PreSaleBenchmark[] {
  const budget = input.totalBudgetCr
  if (budget <= 0) return []

  return RANGES.map(r => {
    const userValue = (input[r.field] as number) ?? 0
    const marketMin = Math.round(budget * r.minPct * 10) / 10
    const marketMax = Math.round(budget * r.maxPct * 10) / 10

    let status: 'below' | 'within' | 'above'
    if (userValue < marketMin) status = 'below'
    else if (userValue > marketMax) status = 'above'
    else status = 'within'

    return { category: r.category, userValue, marketMin, marketMax, status, tip: r.tip }
  })
}
