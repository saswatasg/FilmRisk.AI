import type { EvaluationInput } from './types'
import type { DatasetStats } from './dataset-stats'

export function validateInputBackend(input: EvaluationInput): string[] {
  const errors: string[] = []
  if (!input.filmTitle?.trim()) errors.push('Film title is required')
  if (!input.director?.trim()) errors.push('Director name is required')
  if (!input.leadActor1?.trim()) errors.push('Lead actor name is required')
  if (input.totalBudgetCr <= 0) errors.push('Total budget must be greater than 0')
  return errors
}

export function getDataQualityWarnings(input: EvaluationInput, stats?: DatasetStats): string[] {
  const warnings: string[] = []
  if (input.productionBudgetCr + input.pAndABudgetCr > input.totalBudgetCr * 1.05 && input.totalBudgetCr > 0) {
    warnings.push('Production + P&A exceeds Total Budget')
  }
  if (input.contingencyPercent < 5) {
    warnings.push('Contingency below 5% is below industry standard')
  }
  if (input.contingencyPercent > 25) {
    warnings.push('Contingency above 25% is unusually high')
  }
  const totalRights = input.ottRightsCr + input.satelliteRightsCr + input.musicRightsCr + input.overseasRightsCr + input.brandRevenueCr
  if (totalRights > input.totalBudgetCr * 0.9 && input.totalBudgetCr > 0) {
    warnings.push('Pre-sale rights exceed 90% of budget — verify deal values')
  }
  if (input.theatricalSharePercent > 55) {
    warnings.push('Theatrical share >55% is above realistic producer share (35-40% typical)')
  }
  if (input.theatricalSharePercent < 25) {
    warnings.push('Theatrical share <25% is below typical producer share')
  }
  if (input.primaryGenre && stats) {
    const gs = stats.genreStats[input.primaryGenre]
    if (gs && gs.count < 10) {
      warnings.push(`Genre "${input.primaryGenre}" has only ${gs.count} films with financial data — limited signal`)
    }
  }
  if (input.actorTier && stats) {
    const as = stats.actorTierStats[input.actorTier]
    if (as && as.count < 5) {
      warnings.push(`Actor tier "${input.actorTier}" has only ${as.count} sample films — weak estimate`)
    }
  }
  if (input.directorTier && stats) {
    const ds = stats.directorTierStats[input.directorTier]
    if (ds && ds.count < 5) {
      warnings.push(`Director tier "${input.directorTier}" has only ${ds.count} sample films — weak estimate`)
    }
  }
  if (input.productionHouse && stats) {
    const ps = stats.productionHouseStats[input.productionHouse]
    if (ps && ps.count < 3) {
      warnings.push(`Production house "${input.productionHouse}" has little or no financial data`)
    }
  }
  if (stats) {
    const totalWithFinancial = Object.values(stats.genreStats).reduce((s: number, g: { count: number }) => s + g.count, 0)
    if (totalWithFinancial < 700) {
      warnings.push('Only ~30% of films report financials — survivorship bias (real avg ~1.0× vs dataset 2.72×)')
    }
  }
  if (input.totalBudgetCr >= 200) {
    warnings.push(`₹${input.totalBudgetCr}Cr budget — limited high-budget comparables in dataset`)
  }
  return warnings
}
