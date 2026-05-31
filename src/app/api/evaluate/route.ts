import { NextRequest, NextResponse } from 'next/server'
import type { EvaluationInput, EvaluationResult } from '@/lib/types'
import { loadDataset } from '@/lib/dataset-loader'
import { calculateGreenlightScore, calculateFinancierRisk } from '@/lib/scoring-engine'
import { findComparableFilms } from '@/lib/comparable-films'
import { calculateFinancialProjection } from '@/lib/financial-simulator'
import { diagnoseRisk } from '@/lib/risk-diagnosis'
import { analyzeSensitivities } from '@/lib/sensitivity-analysis'
import { computePreSaleBenchmarks } from '@/lib/pre-sale-benchmark'
import { validateInputBackend, getDataQualityWarnings } from '@/lib/validate-input'

export async function POST(request: NextRequest) {
  try {
    const input: EvaluationInput = await request.json()

    const validationErrors = validateInputBackend(input)
    if (validationErrors.length > 0) {
      return NextResponse.json({ error: validationErrors.join('; ') }, { status: 400 })
    }

    const { films, stats } = loadDataset()

    const greenlight = calculateGreenlightScore(input, stats)
    const financierRisk = calculateFinancierRisk(input, stats)
    const comparableFilms = findComparableFilms(input, films, stats, 8)
    const financialProjection = calculateFinancialProjection(input, stats)
    const riskDiagnosis = diagnoseRisk(input, stats)
    const sensitivities = analyzeSensitivities(input, stats)
    const preSaleBenchmarks = computePreSaleBenchmarks(input)
    const dataQualityWarnings = getDataQualityWarnings(input)

    const result: EvaluationResult = {
      projectSummary: {
        title: input.filmTitle ?? 'Untitled Project',
        genre: input.primaryGenre,
        director: input.director,
        leadActor: input.leadActor1,
        totalBudgetCr: input.totalBudgetCr,
      },
      greenlight,
      financierRisk,
      comparableFilms,
      financialProjection,
      riskDiagnosis,
      sensitivities,
      preSaleBenchmarks,
      validationErrors,
      dataQualityWarnings,
      timestamp: new Date().toISOString(),
    }

    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: `Evaluation failed: ${message}` }, { status: 500 })
  }
}
