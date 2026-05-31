import type { EvaluationInput, RiskDiagnosis, RiskFactor } from './types'

export function diagnoseRisk(input: EvaluationInput): RiskDiagnosis {
  const factors: RiskFactor[] = []

  if (input.totalBudgetCr > 150) {
    factors.push({
      factor: 'High Budget Exposure',
      severity: 'high',
      description: `₹${input.totalBudgetCr}Cr budget is in the top decile — recovery requires strong box office performance across all territories`,
      mitigation: 'Strengthen pre-sale coverage to at least 60% before production start',
    })
  }

  if (input.totalBudgetCr > 0 && input.totalBudgetCr < 10) {
    factors.push({
      factor: 'Micro-Budget Constraints',
      severity: 'moderate',
      description: 'Sub-₹10Cr budget limits marketing reach and talent acquisition',
      mitigation: 'Consider digital-first release strategy to maximize ROI',
    })
  }

  const totalRights =
    (input.ottRightsCr ?? 0) +
    (input.satelliteRightsCr ?? 0) +
    (input.musicRightsCr ?? 0) +
    (input.overseasRightsCr ?? 0) +
    (input.brandRevenueCr ?? 0)

  const coverageRatio = input.totalBudgetCr > 0 ? totalRights / input.totalBudgetCr : 0

  if (coverageRatio < 0.3) {
    factors.push({
      factor: 'Low Pre-Sale Coverage',
      severity: 'critical',
      description: `Only ${(coverageRatio * 100).toFixed(0)}% of budget covered by pre-sales (₹${totalRights.toFixed(1)}Cr / ₹${input.totalBudgetCr.toFixed(1)}Cr)`,
      mitigation: 'Aggressively pursue OTT and satellite pre-sales before greenlight; consider co-production to share risk',
    })
  } else if (coverageRatio < 0.6) {
    factors.push({
      factor: 'Moderate Pre-Sale Coverage',
      severity: 'high',
      description: `${(coverageRatio * 100).toFixed(0)}% covered — gap of ₹${(input.totalBudgetCr - totalRights).toFixed(1)}Cr remains at risk`,
      mitigation: 'Target minimum 60% coverage; explore brand integrations and overseas territory advances',
    })
  }

  if (input.actorTier && ['C', 'D', 'unknown'].includes(input.actorTier)) {
    factors.push({
      factor: 'Limited Star Power',
      severity: input.actorTier === 'unknown' ? 'high' : 'moderate',
      description: `${input.leadActor1} (${input.actorTier}-tier) has limited box office pull — recovery depends on content strength`,
      mitigation: 'Consider casting a higher-tier lead for better pre-sale valuation; strengthen script to compensate',
    })
  }

  if (input.directorTier && ['C', 'D', 'unknown'].includes(input.directorTier)) {
    factors.push({
      factor: 'Inexperienced Director',
      severity: input.directorTier === 'unknown' ? 'high' : 'moderate',
      description: `${input.director} has limited track record — execution and delivery risk is elevated`,
      mitigation: 'Pair with an experienced producer or co-director; ensure strong script supervision',
    })
  }

  const highRiskGenres = ['Horror', 'Sci-Fi', 'Fantasy', 'Documentary', 'Mythological']
  if (highRiskGenres.includes(input.primaryGenre) && input.totalBudgetCr > 60) {
    factors.push({
      factor: 'Genre-Budget Mismatch',
      severity: 'high',
      description: `${input.primaryGenre} with ₹${input.totalBudgetCr}Cr budget is high-risk — these genres have limited recovery track records at this scale`,
      mitigation: 'Reduce budget to ₹60Cr or lower, or secure minimum 70% pre-sale coverage before proceeding',
    })
  }

  const prodRatio = input.totalBudgetCr > 0
    ? input.productionBudgetCr / input.totalBudgetCr
    : 0

  if (prodRatio > 0.8) {
    factors.push({
      factor: 'Under-allocated P&A Budget',
      severity: 'high',
      description: `Production consumes ${(prodRatio * 100).toFixed(0)}% of budget — P&A at ${((1 - prodRatio) * 100).toFixed(0)}% may be insufficient for theatrical release`,
      mitigation: 'Reallocate budget to minimum 20% P&A; consider partner for marketing costs',
    })
  }

  if (prodRatio < 0.3 && input.totalBudgetCr > 20) {
    factors.push({
      factor: 'Over-allocated P&A / Overheads',
      severity: 'moderate',
      description: `Only ${(prodRatio * 100).toFixed(0)}% allocated to production — check for inflated overhead or distribution fees`,
      mitigation: 'Review cost structure; ensure production quality is not compromised by overheads',
    })
  }

  if (input.contingencyPercent < 5) {
    factors.push({
      factor: 'Insufficient Contingency',
      severity: 'moderate',
      description: `${input.contingencyPercent}% contingency is below the 5-15% industry standard — no buffer for production overruns`,
      mitigation: 'Increase contingency to minimum 5% of total budget',
    })
  }

  if (input.marketTiming === 'weak') {
    factors.push({
      factor: 'Unfavorable Release Window',
      severity: 'moderate',
      description: 'Crowded release calendar or off-season timing may suppress opening weekend',
      mitigation: 'Consider shifting release date; secure extra marketing spend to cut through competition',
    })
  }

  if (input.financingCostCr > 0 && input.totalBudgetCr > 0) {
    const costRatio = input.financingCostCr / input.totalBudgetCr
    if (costRatio > 0.15) {
      factors.push({
        factor: 'High Financing Cost',
        severity: 'high',
        description: `Financing cost of ${(costRatio * 100).toFixed(0)}% of budget significantly erodes potential returns`,
        mitigation: 'Explore alternative financing with lower cost; negotiate better terms against pre-sale collateral',
      })
    }
  }

  if (conceptIsWeak(input)) {
    factors.push({
      factor: 'Weak Concept Foundation',
      severity: 'high',
      description: `Low concept clarity (${input.conceptClarity}/10) or novelty (${input.novelty}/10) weakens every downstream risk factor`,
      mitigation: 'Invest in script development; conduct test audiences; refine logline before committing talent',
    })
  }

  const criticalCount = factors.filter(f => f.severity === 'critical').length
  const highCount = factors.filter(f => f.severity === 'high').length

  const overallRisk = criticalCount > 0 ? 'very_high'
    : highCount >= 3 ? 'high'
      : highCount >= 1 ? 'moderate'
        : 'low'

  const topRecommendations = buildRecommendations(factors)

  return { overallRisk, factors, topRecommendations }
}

function conceptIsWeak(input: EvaluationInput): boolean {
  return input.conceptClarity < 5 || input.novelty < 4
}

function buildRecommendations(factors: RiskFactor[]): string[] {
  const recs: string[] = []

  const critical = factors.filter(f => f.severity === 'critical')
  const high = factors.filter(f => f.severity === 'high')
  const moderate = factors.filter(f => f.severity === 'moderate')

  for (const f of [...critical, ...high, ...moderate]) {
    if (!recs.includes(f.mitigation)) {
      recs.push(f.mitigation)
    }
    if (recs.length >= 5) break
  }

  if (recs.length === 0) {
    recs.push('Project shows strong fundamentals — proceed with standard due diligence')
  }

  return recs
}
