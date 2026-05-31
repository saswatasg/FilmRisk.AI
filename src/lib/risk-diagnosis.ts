import type { EvaluationInput, RiskDiagnosis, RiskFactor } from './types'
import type { DatasetStats } from './dataset-stats'

export function diagnoseRisk(input: EvaluationInput, stats: DatasetStats): RiskDiagnosis {
  const factors: RiskFactor[] = []

  const band = budgetBand(input.totalBudgetCr)
  const bandData = stats.budgetBandStats[band]
  const bandAdjWR = bandData ? bandData.adjustedWinRatePct : 30

  if (bandAdjWR < 25) {
    factors.push({
      factor: 'High-Risk Budget Band',
      severity: 'high',
      description: `₹${input.totalBudgetCr}Cr (${band} band): ~${bandAdjWR}% adjusted success rate — majority of films at this budget underperform`,
      mitigation: 'Target ₹30-100Cr range for better historical outcomes, or secure ≥60% pre-sale coverage',
    })
  } else if (bandAdjWR < 45) {
    factors.push({
      factor: 'Below-Average Budget Band',
      severity: 'moderate',
      description: `${band} band: ~${bandAdjWR}% adjusted WR — below ₹60Cr+ band averages`,
      mitigation: 'Increase budget or secure strong pre-sales to compensate',
    })
  }

  const gbKey = `${input.primaryGenre}|${band}`
  const gbData = stats.genreBudgetStats[gbKey]
  if (gbData && gbData.count >= 2 && gbData.adjustedWinRatePct < 35) {
    factors.push({
      factor: 'Genre-Budget Mismatch',
      severity: 'high',
      description: `${input.primaryGenre} + ${band} combo has ${gbData.adjustedWinRatePct}% adjusted WR (${gbData.count} films) — this specific genre-budget pairing historically struggles`,
      mitigation: 'Adjust budget to a better-performing band for this genre, or strengthen pre-sale coverage',
    })
  }

  const comboKey = `${input.directorTier}+${input.actorTier}`
  const comboData = stats.comboStats[comboKey]
  if (comboData && comboData.adjustedWinRatePct < 35) {
    factors.push({
      factor: 'Weak Talent Combination',
      severity: 'high',
      description: `${input.directorTier}-tier director + ${input.actorTier}-tier actor: ${comboData.adjustedWinRatePct}% adjusted WR (${comboData.count} films)`,
      mitigation: 'Upgrade at least one talent tier; A or B-tier lead improves pre-sale valuation',
    })
  } else if (comboData && comboData.adjustedWinRatePct >= 80) {
    factors.push({
      factor: 'Strong Talent Track Record',
      severity: 'low',
      description: `${input.directorTier}+${input.actorTier}: ${comboData.adjustedWinRatePct}% adjusted WR — proven combo`,
      mitigation: 'Leverage combo in pre-sale negotiations and pitch deck',
    })
  }

  if (!comboData) {
    const actorData = stats.actorTierStats[input.actorTier]
    const dirData = stats.directorTierStats[input.directorTier]
    if (actorData && actorData.adjustedWinRatePct < 35 && input.totalBudgetCr > 80) {
      factors.push({
        factor: 'Talent-Budget Gap',
        severity: 'moderate',
        description: `₹${input.totalBudgetCr}Cr budget with ${input.actorTier}-tier lead (~${actorData.adjustedWinRatePct}% adjusted WR)`,
        mitigation: 'Upgrade lead or reduce budget to match talent tier',
      })
    }
    if (dirData && dirData.adjustedWinRatePct < 35 && input.totalBudgetCr > 80) {
      factors.push({
        factor: 'Director-Budget Gap',
        severity: 'moderate',
        description: `₹${input.totalBudgetCr}Cr budget with ${input.directorTier}-tier director (~${dirData.adjustedWinRatePct}% adjusted WR)`,
        mitigation: 'Upgrade director or reduce budget to match director tier',
      })
    }
  }

  const totalRights =
    input.ottRightsCr + input.satelliteRightsCr + input.musicRightsCr +
    input.overseasRightsCr + input.brandRevenueCr
  const coverageRatio = input.totalBudgetCr > 0 ? totalRights / input.totalBudgetCr : 0

  const criticalThreshold = input.totalBudgetCr > 100 ? 0.20 : input.totalBudgetCr > 30 ? 0.25 : 0.30
  const warningThreshold = input.totalBudgetCr > 100 ? 0.40 : input.totalBudgetCr > 30 ? 0.50 : 0.60

  if (coverageRatio < criticalThreshold) {
    factors.push({
      factor: 'Critical Pre-Sale Gap',
      severity: 'critical',
      description: `Only ${Math.round(coverageRatio * 100)}% budget covered (₹${totalRights.toFixed(1)}Cr / ₹${input.totalBudgetCr.toFixed(1)}Cr) — insufficient to mitigate production risk`,
      mitigation: `Minimum ${Math.round(criticalThreshold * 100)}% pre-sale coverage required; prioritize OTT and satellite deals before greenlight`,
    })
  } else if (coverageRatio < warningThreshold) {
    factors.push({
      factor: 'Moderate Pre-Sale Gap',
      severity: 'high',
      description: `${Math.round(coverageRatio * 100)}% covered — ₹${(input.totalBudgetCr - totalRights).toFixed(1)}Cr unsecured`,
      mitigation: `Target ${Math.round(warningThreshold * 100)}%+ coverage; explore brand integrations and overseas territory advances`,
    })
  }

  const ms = stats.monthStats[input.releaseMonth]
  if (ms && ms.count >= 3 && ms.adjustedWinRatePct < 40) {
    factors.push({
      factor: 'Weak Release Month',
      severity: 'moderate',
      description: `${monthName(input.releaseMonth)}: ${ms.adjustedWinRatePct}% adjusted WR (${ms.count} films) — historically underperforms`,
      mitigation: 'Move release to a stronger month (e.g., Diwali, Eid, or Christmas window)',
    })
  }

  if (input.conceptClarity < 5 || input.novelty < 4) {
    factors.push({
      factor: 'Weak Concept Foundation',
      severity: 'high',
      description: `Concept clarity ${input.conceptClarity}/10, novelty ${input.novelty}/10 — weak premise weakens all downstream projections`,
      mitigation: 'Invest in script development and test with target audiences before greenlight',
    })
  }

  if (input.contingencyPercent < 5) {
    factors.push({
      factor: 'Insufficient Contingency',
      severity: 'moderate',
      description: `${input.contingencyPercent}% contingency below 5-15% industry standard`,
      mitigation: 'Increase contingency to minimum 5% of total budget',
    })
  }

  const prodRatio = input.totalBudgetCr > 0 ? input.productionBudgetCr / input.totalBudgetCr : 0
  if (prodRatio > 0.8) {
    factors.push({
      factor: 'Under-allocated P&A',
      severity: 'moderate',
      description: `Production at ${Math.round(prodRatio * 100)}% of budget — P&A at ${Math.round((1 - prodRatio) * 100)}% may limit theatrical reach`,
      mitigation: 'Reallocate to minimum 20% P&A for competitive release',
    })
  }

  if (input.financingCostCr > 0 && input.totalBudgetCr > 0) {
    const finRatio = input.financingCostCr / input.totalBudgetCr
    if (finRatio > 0.15) {
      factors.push({
        factor: 'High Financing Cost',
        severity: 'moderate',
        description: `Financing cost ${Math.round(finRatio * 100)}% of budget significantly erodes returns`,
        mitigation: 'Seek alternative financing; negotiate better terms against pre-sale collateral',
      })
    }
  }

  const severityScore: Record<string, number> = { critical: 4, high: 3, moderate: 2, low: 1 }
  const totalSeverity = factors.reduce((s, f) => s + severityScore[f.severity], 0)
  const maxSeverity = Math.max(...factors.map(f => severityScore[f.severity]), 0)

  const overallRisk = maxSeverity >= 4 ? 'very_high' : totalSeverity >= 8 ? 'high' : totalSeverity >= 3 ? 'moderate' : 'low'

  const recommendations: string[] = []
  const bySeverity = ['critical', 'high', 'moderate', 'low']
  for (const sev of bySeverity) {
    for (const f of factors) {
      if (f.severity === sev && !recommendations.includes(f.mitigation)) {
        recommendations.push(f.mitigation)
      }
      if (recommendations.length >= 5) break
    }
    if (recommendations.length >= 5) break
  }

  if (recommendations.length === 0) {
    recommendations.push('Project shows strong fundamentals across all data-driven metrics — proceed with standard due diligence')
  }

  return { overallRisk, factors, topRecommendations: recommendations }
}

function monthName(m: number): string {
  const names = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return names[m] ?? `Month ${m}`
}

function budgetBand(b: number): string {
  if (b < 10) return '<10'
  if (b < 30) return '10-30'
  if (b < 60) return '30-60'
  if (b < 100) return '60-100'
  if (b < 200) return '100-200'
  return '>200'
}
