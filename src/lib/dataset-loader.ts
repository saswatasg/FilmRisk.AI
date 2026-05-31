import fs from 'fs'
import path from 'path'
import { parseCSV } from './csv-parser'
import { computeDatasetStats, type DatasetStats } from './dataset-stats'
import type { BollywoodFilm } from './types'

let cached: { films: BollywoodFilm[]; stats: DatasetStats } | null = null

export function loadDataset(): { films: BollywoodFilm[]; stats: DatasetStats } {
  if (cached) return cached
  const filePath = path.join(process.cwd(), 'src', 'data', 'bollywood_master_v0.csv')
  const text = fs.readFileSync(filePath, 'utf-8')
  const films = parseCSV(text)
  const stats = computeDatasetStats(films)
  cached = { films, stats }
  return cached
}
