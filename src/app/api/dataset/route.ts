import { NextResponse } from 'next/server'
import { loadDataset } from '@/lib/dataset-loader'
import { computeDatasetSummary } from '@/lib/csv-parser'

export async function GET() {
  try {
    /* Same pipeline as /api/evaluate (parse + impute), so counts agree across surfaces. */
    const { films } = loadDataset()
    return NextResponse.json({ summary: computeDatasetSummary(films), count: films.length })
  } catch {
    return NextResponse.json({ error: 'Failed to load dataset' }, { status: 500 })
  }
}
