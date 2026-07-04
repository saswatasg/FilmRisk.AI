import fs from 'fs'
import path from 'path'
import { parseCSV } from './csv-parser'
import { computeDatasetStats, type DatasetStats } from './dataset-stats'
import { imputeFinance } from './impute-finance'
import { trainModels } from './ml-predictor'
import type { BollywoodFilm } from './types'

let cached: { films: BollywoodFilm[]; stats: DatasetStats } | null = null
let modelsTrained = false

export function loadDataset(): { films: BollywoodFilm[]; stats: DatasetStats } {
  if (cached) return cached
  const filePath = path.join(process.cwd(), 'src', 'data', 'bollywood_input.csv')
  const text = fs.readFileSync(filePath, 'utf-8')
  const films = imputeFinance(parseCSV(text))
  const stats = computeDatasetStats(films)
  cached = { films, stats }
  if (!modelsTrained) {
    trainModels(films)
    modelsTrained = true
  }
  return cached
}
