import { NextRequest, NextResponse } from 'next/server'
import type { EvaluationInput, EvaluationResult } from '@/lib/types'
import { loadDataset } from '@/lib/dataset-loader'
import { calculateGreenlightScore, calculateFinancierRisk } from '@/lib/scoring-engine'
import { findComparableFilms } from '@/lib/comparable-films'
import { calculateFinancialProjection } from '@/lib/financial-simulator'
import { diagnoseRisk } from '@/lib/risk-diagnosis'
import { analyzeScenarioMoves } from '@/lib/sensitivity-analysis'
import { computePreSaleBenchmarks } from '@/lib/pre-sale-benchmark'
import { validateInputBackend, getDataQualityWarnings } from '@/lib/validate-input'
import { fetchMarketSignals } from '@/lib/market-signals'
import { verifyToken, hasActivePurchase, markPurchaseEvaluated, findUserLatestPurchaseId } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  const token = authHeader?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const payload = verifyToken(token)
  if (!payload) return NextResponse.json({ error: 'invalid token' }, { status: 401 })
  if (!(await hasActivePurchase(payload.userId))) {
    return NextResponse.json({ error: 'purchase required' }, { status: 402 })
  }

  try {
    const input: EvaluationInput = await request.json()
    const validationErrors = validateInputBackend(input)
    if (validationErrors.length > 0) {
      return NextResponse.json({ error: validationErrors.join('; ') }, { status: 400 })
    }

    const { films, stats } = loadDataset()
    const marketSignals = await fetchMarketSignals()
    const greenlight = calculateGreenlightScore(input, stats, marketSignals)
    const financierRisk = calculateFinancierRisk(input, stats, marketSignals)
    const comparableFilms = findComparableFilms(input, films, stats, 8)
    const financialProjection = calculateFinancialProjection(input, stats, greenlight.adjustedScore)
    const riskDiagnosis = diagnoseRisk(input, stats)
    const { levers: sensitivities, immaterial: insensitiveLevers } = analyzeScenarioMoves(input, stats)
    const preSaleBenchmarks = computePreSaleBenchmarks(input)
    const dataQualityWarnings = getDataQualityWarnings(input, stats)

    const result: EvaluationResult = {
      projectSummary: {
        title: input.filmTitle?.trim() ? input.filmTitle : 'Untitled Project',
        genre: input.primaryGenre,
        director: input.director?.trim() ? input.director : `${input.directorTier}-tier director`,
        leadActor: input.leadActor1?.trim() ? input.leadActor1 : `${input.actorTier}-tier lead`,
        totalBudgetCr: input.totalBudgetCr,
      },
      greenlight,
      financierRisk,
      comparableFilms,
      financialProjection,
      riskDiagnosis,
      sensitivities,
      insensitiveLevers,
      preSaleBenchmarks,
      validationErrors,
      dataQualityWarnings,
      marketSignals,
      timestamp: new Date().toISOString(),
    }

    const purchaseId = await findUserLatestPurchaseId(payload.userId)
    if (purchaseId) await markPurchaseEvaluated(purchaseId)
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: `Evaluation failed: ${message}` }, { status: 500 })
  }
}
