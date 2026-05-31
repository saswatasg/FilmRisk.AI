import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import type { EvaluationInput } from '@/lib/types'
import { parseCSV } from '@/lib/csv-parser'
import { findComparableFilms } from '@/lib/comparable-films'

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
    const films = loadFilms()
    const result = findComparableFilms(input, films, 10)
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
