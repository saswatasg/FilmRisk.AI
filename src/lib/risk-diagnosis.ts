import type { EvaluationInput, RiskDiagnosis, RiskFactor } from './types'
import type { DatasetStats } from './dataset-stats'

export function diagnoseRisk(input: EvaluationInput, stats: DatasetStats): RiskDiagnosis {
  const factors: RiskFactor[] = []

  const band = budgetBand(input.totalBudgetCr)
  const bandData = stats.budgetBandStats[band]
  const winRate = bandData ? bandData.winRatePct : 30

  if (winRate < 20) {
    factors.push({
      factor: 'High-Risk Budget Band',
      severity: 'high',
      description: `₹${input.totalBudgetCr}Cr budget (${band} band) has only ${winRate}% historical success rate — majority of films at this budget level underperform`,
      mitigation: 'Reduce budget to ₹30-60Cr range (37% success rate) or secure ≥60% pre-sale coverage before committing',
    })
  } else if (winRate < 40) {
    factors.push({
      factor: 'Below-Average Budget Band',
      severity: 'moderate',
      description: `${band} band: ${winRate}% historical win rate — below the ₹60-100Cr+ band averages`,
      mitigation: 'Consider increasing budget to the next band for better economics, or secure strong pre-sales',
    })
  }

  const genreData = stats.genreStats[input.primaryGenre]
  if (genreData && genreData.withGross >= 5) {
    const genreWR = Math.round(genreData.avgMultiple >= 1.5 ? 50 : 25)
    if (genreWR < 30 && input.totalBudgetCr > 60) {
      factors.push({
        factor: 'Genre-Budget Mismatch',
        severity: 'high',
        description: `${input.primaryGenre} (avg budget ₹${genreData.avgBudget}Cr, avg ${genreData.avgMultiple}x) with ₹${input.totalBudgetCr}Cr budget — genre historically underperforms at this scale`,
        mitigation: 'Reduce budget to align with genre benchmarks, or pivot genre positioning',
      })
    }
  }

  const comboKey = `${input.directorTier}+${input.actorTier}`
  const comboData = stats.comboStats[comboKey]
  if (comboData && comboData.winRatePct < 40) {
    factors.push({
      factor: 'Weak Talent Combination',
      severity: 'high',
      description: `${input.directorTier}-tier director + ${input.actorTier}-tier actor combo has only ${comboData.winRatePct}% historical win rate (${comboData.count} films)`,
      mitigation: 'Upgrade at least one talent tier to improve probability; consider A or B-tier lead for better pre-sale valuation',
    })
  } else if (comboData && comboData.winRatePct >= 80) {
    factors.push({
      factor: 'Strong Talent Track Record',
      severity: 'low',
      description: `${input.directorTier}+${input.actorTier} combo shows ${comboData.winRatePct}% historical success — strong foundation`,
      mitigation: 'Leverage combo for pre-sale negotiations; highlight in pitch deck',
    })
  }

  if (!comboData && genreData && input.totalBudgetCr > 80) {
    const actorData = stats.actorTierStats[input.actorTier]
    const dirData = stats.directorTierStats[input.directorTier]
    if (actorData && actorData.winRatePct < 30 && input.totalBudgetCr > 80) {
      factors.push({
        factor: 'Talent-Budget Gap',
        severity: 'moderate',
        description: `₹${input.totalBudgetCr}Cr budget with ${input.actorTier}-tier lead (${actorData.winRatePct}% success rate) — high budget requires stronger talent pull`,
        mitigation: 'Upgrade to A or B-tier lead, or reduce budget to ₹60Cr to align with talent tier',
      })
    }
  }

  const totalRights =
    input.ottRightsCr + input.satelliteRightsCr + input.musicRightsCr +
    input.overseasRightsCr + input.brandRevenueCr
  const coverageRatio = input.totalBudgetCr > 0 ? totalRights / input.totalBudgetCr : 0

  if (coverageRatio < 0.3) {
    factors.push({
      factor: 'Critical Pre-Sale Gap',
      severity: 'critical',
      description: `Only ${Math.round(coverageRatio * 100)}% budget covered (₹${totalRights.toFixed(1)}Cr / ₹${input.totalBudgetCr.toFixed(1)}Cr) — insufficient to mitigate production risk`,
      mitigation: 'Minimum 50% pre-sale coverage required; prioritize OTT and satellite deals before greenlight',
    })
  } else if (coverageRatio < 0.6) {
    factors.push({
      factor: 'Moderate Pre-Sale Gap',
      severity: 'high',
      description: `${Math.round(coverageRatio * 100)}% covered — ₹${(input.totalBudgetCr - totalRights).toFixed(1)}Cr unsecured`,
      mitigation: 'Target 60%+ coverage; explore brand integrations and overseas territory advances',
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

  const critical = factors.filter(f => f.severity === 'critical').length
  const high = factors.filter(f => f.severity === 'high').length
  const overallRisk = critical > 0 ? 'very_high' : high >= 3 ? 'high' : high >= 1 ? 'moderate' : 'low'

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

function budgetBand(b: number): string {
  if (b < 10) return '<10'
  if (b < 30) return '10-30'
  if (b < 60) return '30-60'
  if (b < 100) return '60-100'
  if (b < 200) return '100-200'
  return '>200'
}
