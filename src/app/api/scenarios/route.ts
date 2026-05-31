import { NextRequest, NextResponse } from 'next/server'
import type { EvaluationInput } from '@/lib/types'
import { calculateFinancialProjection } from '@/lib/financial-simulator'

export async function POST(request: NextRequest) {
  try {
    const input: EvaluationInput = await request.json()
    const projection = calculateFinancialProjection(input)
    return NextResponse.json(projection)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
