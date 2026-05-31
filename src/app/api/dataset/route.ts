import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { parseCSV, computeDatasetSummary } from '@/lib/csv-parser'

let cachedFilms: ReturnType<typeof parseCSV> | null = null
let cachedSummary: ReturnType<typeof computeDatasetSummary> | null = null

function loadFilms() {
  if (cachedFilms) return cachedFilms
  const filePath = path.join(process.cwd(), 'src', 'data', 'bollywood_master_v0.csv')
  const text = fs.readFileSync(filePath, 'utf-8')
  cachedFilms = parseCSV(text)
  return cachedFilms
}

export async function GET() {
  try {
    const films = loadFilms()
    if (!cachedSummary) {
      cachedSummary = computeDatasetSummary(films)
    }
    return NextResponse.json({ summary: cachedSummary, count: films.length })
  } catch (err) {
    return NextResponse.json({ error: 'Failed to load dataset' }, { status: 500 })
  }
}
