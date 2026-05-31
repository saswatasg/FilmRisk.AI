import { NextRequest, NextResponse } from 'next/server'
import type { EvaluationInput } from '@/lib/types'
import { loadDataset } from '@/lib/dataset-loader'
import { findComparableFilms } from '@/lib/comparable-films'

export async function POST(request: NextRequest) {
  try {
    const input: EvaluationInput = await request.json()
    const { films, stats } = loadDataset()
    const result = findComparableFilms(input, films, stats, 10)
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
