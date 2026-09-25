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
import { authenticate, extractToken, getEntitlement, consumeRun } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const token = extractToken(request.headers.get('Authorization')) ?? request.cookies.get('token')?.value ?? null
  const payload = await authenticate(token)
  if (!payload) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  try {
    const body = (await request.json()) as EvaluationInput & { preview?: boolean }
    const { preview, ...rest } = body
    const isPreview = preview === true
    const input = rest as EvaluationInput

    if (!isPreview) {
      const ent = await getEntitlement(payload.userId)
      if (!ent.purchased) {
        return NextResponse.json(
          { error: 'purchase required', code: 'payment_required' },
          { status: 402 }
        )
      }
      if (ent.editsLeft <= 0) {
        return NextResponse.json(
          { error: 'edits exhausted', code: 'edits_exhausted' },
          { status: 402 }
        )
      }
    }

    const validationErrors = validateInputBackend(input as EvaluationInput)
    if (validationErrors.length > 0) {
      return NextResponse.json({ error: validationErrors.join('; ') }, { status: 400 })
    }

    const { films, stats } = loadDataset()
    const marketSignals = await fetchMarketSignals()
    const greenlight = calculateGreenlightScore(input as EvaluationInput, stats, marketSignals)

    if (isPreview) {
      return NextResponse.json({
        preview: true,
        greenlight: {
          verdict: greenlight.verdict,
          adjustedScore: greenlight.adjustedScore,
          realMarketPct: greenlight.realMarketPct,
          confidenceInterval: greenlight.confidenceInterval,
        },
      })
    }

    const financierRisk = calculateFinancierRisk(input as EvaluationInput, stats, marketSignals)
    const comparableFilms = findComparableFilms(input as EvaluationInput, films, stats, 8)
    const financialProjection = calculateFinancialProjection(input as EvaluationInput, stats, greenlight.adjustedScore)
    const riskDiagnosis = diagnoseRisk(input as EvaluationInput, stats)
    const { levers: sensitivities, immaterial: insensitiveLevers } = analyzeScenarioMoves(input as EvaluationInput, stats)
    const preSaleBenchmarks = computePreSaleBenchmarks(input as EvaluationInput)
    const dataQualityWarnings = getDataQualityWarnings(input as EvaluationInput, stats)

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

    await consumeRun(payload.userId)
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: `Evaluation failed: ${message}` }, { status: 500 })
  }
}
