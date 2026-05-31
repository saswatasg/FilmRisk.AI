import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import type { EvaluationInput, EvaluationResult } from '@/lib/types'
import { parseCSV } from '@/lib/csv-parser'
import { calculateGreenlightScore, calculateFinancierRisk } from '@/lib/scoring-engine'
import { findComparableFilms } from '@/lib/comparable-films'
import { calculateFinancialProjection } from '@/lib/financial-simulator'
import { diagnoseRisk } from '@/lib/risk-diagnosis'

let cachedFilms: ReturnType<typeof parseCSV> | null = null

function loadFilms() {
  if (cachedFilms) return cachedFilms
  const filePath = path.join(process.cwd(), 'src', 'data', 'bollywood_master_v0.csv')
  const text = fs.readFileSync(filePath, 'utf-8')
  cachedFilms = parseCSV(text)
  return cachedFilms
}

export async function POST(request: NextRequest) {
  try {
    const input: EvaluationInput = await request.json()

    if (!input.primaryGenre || !input.logline || !input.director || !input.leadActor1) {
      return NextResponse.json(
        { error: 'Missing required fields: primaryGenre, logline, director, leadActor1' },
        { status: 400 }
      )
    }

    const films = loadFilms()

    const greenlight = calculateGreenlightScore(input)
    const financierRisk = calculateFinancierRisk(input)
    const comparableFilms = findComparableFilms(input, films, 8)
    const financialProjection = calculateFinancialProjection(input)
    const riskDiagnosis = diagnoseRisk(input)

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
      timestamp: new Date().toISOString(),
    }

    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: `Evaluation failed: ${message}` }, { status: 500 })
  }
}
