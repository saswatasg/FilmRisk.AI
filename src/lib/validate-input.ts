import type { EvaluationInput } from './types'

export function validateInputBackend(input: EvaluationInput): string[] {
  const errors: string[] = []
  if (!input.filmTitle?.trim()) errors.push('Film title is required')
  if (!input.logline?.trim()) errors.push('Logline / concept summary is required')
  if (!input.director?.trim()) errors.push('Director name is required')
  if (!input.leadActor1?.trim()) errors.push('Lead actor name is required')
  if (input.totalBudgetCr <= 0) errors.push('Total budget must be greater than 0')
  if (input.productionBudgetCr <= 0) errors.push('Production budget must be greater than 0')
  if (input.contingencyPercent < 0 || input.contingencyPercent > 25) errors.push('Contingency should be 0-25%')
  if (input.theatricalSharePercent < 10 || input.theatricalSharePercent > 70) errors.push('Theatrical share should be 10-70%')
  return errors
}

export function getDataQualityWarnings(input: EvaluationInput): string[] {
  const warnings: string[] = []
  if (input.productionBudgetCr + input.pAndABudgetCr > input.totalBudgetCr * 1.05) {
    warnings.push('Production + P&A exceeds Total Budget — check your allocations')
  }
  if (input.contingencyPercent < 5) {
    warnings.push('Contingency below 5% is below industry standard')
  }
  const totalRights = input.ottRightsCr + input.satelliteRightsCr + input.musicRightsCr + input.overseasRightsCr + input.brandRevenueCr
  if (totalRights > input.totalBudgetCr * 0.9 && input.totalBudgetCr > 0) {
    warnings.push('Pre-sale rights exceed 90% of budget — verify deal values are firm')
  }
  if (input.theatricalSharePercent > 50) {
    warnings.push('Theatrical share >50% is above realistic producer share (35-40% typical)')
  }
  return warnings
}
