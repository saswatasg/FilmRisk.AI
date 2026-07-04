/* ───────── Pure-TS Gradient Boosted Regression Tree ───────── */

/* Seeded PRNG (Mulberry32) for deterministic training */
let rngState = 42
export function setSeed(seed: number): void { rngState = seed }
function seededRandom(): number {
  rngState |= 0; rngState = rngState + 0x6D2B79F5 | 0
  let t = Math.imul(rngState ^ rngState >>> 15, 1 | rngState)
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
  return ((t ^ t >>> 14) >>> 0) / 4294967296
}

export interface TreeNode {
  feature: number
  threshold: number
  value: number
  left?: TreeNode
  right?: TreeNode
  isLeaf: boolean
}

export interface GBMParams {
  nEstimators: number
  maxDepth: number
  minSamplesLeaf: number
  learningRate: number
  subsample: number
}

export interface GBMConfig {
  params: GBMParams
  trees: TreeNode[]
  basePrediction: number
  featureMeans: number[]
  featureStds: number[]
}

const DEFAULTS: GBMParams = {
  nEstimators: 200,
  maxDepth: 4,
  minSamplesLeaf: 3,
  learningRate: 0.08,
  subsample: 0.8,
}

/* ───── CART regression tree ───── */

function bestSplit(X: number[][], y: number[], indices: number[], minLeaf: number): { feature: number; threshold: number; gain: number } | null {
  const n = indices.length
  if (n < minLeaf * 2) return null

  const parentVar = (() => {
    let s = 0, sq = 0
    for (const i of indices) { s += y[i]!; sq += y[i]! * y[i]! }
    return (sq - s * s / n) / n
  })()
  if (parentVar < 1e-10) return null

  let best: { feature: number; threshold: number; gain: number } | null = null
  const nFeatures = X[0]!.length

  for (let f = 0; f < nFeatures; f++) {
    const pairs: [number, number][] = indices.map(i => [X[i]![f]!, y[i]!])
    pairs.sort((a, b) => a[0] - b[0])
    if (pairs[0]![0] === pairs[n - 1]![0]) continue

    let sumL = 0, sumSqL = 0
    let sumR = pairs.reduce((s, p) => s + p[1], 0)
    let sumSqR = pairs.reduce((s, p) => s + p[1] * p[1], 0)

    for (let i = 0; i < n - 1; i++) {
      const v = pairs[i]![1]
      sumL += v; sumSqL += v * v
      sumR -= v; sumSqR -= v * v
      if (pairs[i]![0] === pairs[i + 1]![0]) continue

      const nL = i + 1
      const nR = n - nL
      if (nL < minLeaf || nR < minLeaf) continue

      const varL = (sumSqL - sumL * sumL / nL) / nL
      const varR = (sumSqR - sumR * sumR / nR) / nR
      const gain = parentVar - (nL / n) * varL - (nR / n) * varR

      if (gain > 0 && (best === null || gain > best.gain)) {
        best = { feature: f, threshold: (pairs[i]![0] + pairs[i + 1]![0]) / 2, gain }
      }
    }
  }
  return best
}

function buildTree(X: number[][], y: number[], indices: number[], depth: number, params: GBMParams): TreeNode {
  const n = indices.length
  const mean = indices.reduce((s, i) => s + y[i]!, 0) / n

  if (depth >= params.maxDepth || n <= params.minSamplesLeaf) {
    return { feature: 0, threshold: 0, value: mean, isLeaf: true }
  }

  const split = bestSplit(X, y, indices, params.minSamplesLeaf)
  if (!split || split.gain < 1e-8) {
    return { feature: 0, threshold: 0, value: mean, isLeaf: true }
  }

  const leftIdx = indices.filter(i => X[i]![split.feature]! < split.threshold)
  const rightIdx = indices.filter(i => X[i]![split.feature]! >= split.threshold)

  if (leftIdx.length < params.minSamplesLeaf || rightIdx.length < params.minSamplesLeaf) {
    return { feature: 0, threshold: 0, value: mean, isLeaf: true }
  }

  return {
    feature: split.feature,
    threshold: split.threshold,
    value: mean,
    isLeaf: false,
    left: buildTree(X, y, leftIdx, depth + 1, params),
    right: buildTree(X, y, rightIdx, depth + 1, params),
  }
}

function predictTree(node: TreeNode, x: number[]): number {
  if (node.isLeaf) return node.value
  if (x[node.feature]! < node.threshold) return predictTree(node.left!, x)
  return predictTree(node.right!, x)
}

/* ───── Feature engineering helpers ───── */

function tierNum(t: string): number {
  const map: Record<string, number> = { 'S': 4, 'A': 3, 'B': 2, 'C': 1, 'D': 0 }
  return map[t] ?? -1
}

export function extractFeatures(film: {
  budget_cr: number | null
  actor_tier_proxy: string
  director_tier_proxy: string
  actor_rank_score: number | null
  director_rank_score: number | null
  release_month_num: number | null
  sequel_flag?: boolean
}): number[] {
  const budgets = [1, 3, 5, 10, 15, 25, 40, 60, 80, 110, 150, 200, 300]
  const budgetIdx = budgets.findIndex(b => (film.budget_cr ?? 0) <= b)
  const budgetFeature = budgetIdx >= 0 ? budgetIdx / budgets.length : 1.0

  const aRank = film.actor_rank_score !== null ? film.actor_rank_score / 100 : 0
  const dRank = film.director_rank_score !== null ? film.director_rank_score / 100 : 0
  const hasRank = (film.actor_rank_score !== null ? 1 : 0) + (film.director_rank_score !== null ? 1 : 0)

  return [
    budgetFeature,
    tierNum(film.actor_tier_proxy) / 4,
    tierNum(film.director_tier_proxy) / 4,
    aRank,
    dRank,
    hasRank / 2,
    film.sequel_flag ? 1 : 0,
    Math.sin(2 * Math.PI * (film.release_month_num ?? 6) / 12),
    Math.cos(2 * Math.PI * (film.release_month_num ?? 6) / 12),
  ]
}

export function extractFeatureNames(): string[] {
  return [
    'budget_scaled',
    'actor_tier',
    'director_tier',
    'actor_rank',
    'director_rank',
    'rank_availability',
    'sequel_flag',
    'month_sin',
    'month_cos',
  ]
}

/* ───── Gradient Boosting ───── */

export function crossValidateGBM(
  X: number[][],
  y: number[],
  yearLabels: number[],
  paramGrid: { nEstimators: number[]; maxDepth: number[]; learningRate: number[] }
): { bestParams: Partial<GBMParams>; cvResults: { params: string; mse: number }[] } {
  const CUTOFFS = [
    { name: 'fold1', trainMax: 2014, testMin: 2015, testMax: 2017 },
    { name: 'fold2', trainMax: 2017, testMin: 2018, testMax: 2020 },
    { name: 'fold3', trainMax: 2020, testMin: 2021, testMax: 2023 },
  ]
  const results: { params: string; mse: number }[] = []

  for (const nEstimators of paramGrid.nEstimators) {
    for (const maxDepth of paramGrid.maxDepth) {
      for (const learningRate of paramGrid.learningRate) {
        const params: Partial<GBMParams> = { nEstimators, maxDepth, learningRate, minSamplesLeaf: 3, subsample: 0.8 }
        let totalMSE = 0, foldCount = 0

        for (const fold of CUTOFFS) {
          const trainIdx = yearLabels.map((y, i) => y <= fold.trainMax ? i : -1).filter(i => i >= 0)
          const testIdx = yearLabels.map((y, i) => y >= fold.testMin && y <= fold.testMax ? i : -1).filter(i => i >= 0)
          if (trainIdx.length < 50 || testIdx.length < 5) continue

          const Xtrain = trainIdx.map(i => X[i]!)
          const ytrain = trainIdx.map(i => y[i]!)
          const Xtest = testIdx.map(i => X[i]!)
          const ytest = testIdx.map(i => y[i]!)

          const model = trainGBM(Xtrain, ytrain, params)
          let mse = 0
          for (let i = 0; i < Xtest.length; i++) {
            const pred = predictGBM(model, Xtest[i]!)
            mse += (pred - ytest[i]!) ** 2
          }
          totalMSE += mse / Xtest.length
          foldCount++
        }

        if (foldCount > 0) {
          results.push({ params: `${nEstimators}t_${maxDepth}d_${learningRate}lr`, mse: totalMSE / foldCount })
        }
      }
    }
  }

  results.sort((a, b) => a.mse - b.mse)
  if (results.length === 0) {
    return { bestParams: {}, cvResults: results }
  }
  const best = results[0]!
  const parts = best.params.split('_')
  return {
    bestParams: { nEstimators: parseInt(parts[0]!), maxDepth: parseInt(parts[1]!.replace('d', '')), learningRate: parseFloat(parts[2]!.replace('lr', '')) },
    cvResults: results,
  }
}

export function trainGBM(X: number[][], y: number[], params: Partial<GBMParams> = {}): GBMConfig {
  const p = { ...DEFAULTS, ...params }
  const n = X.length
  const nFeatures = X[0]!.length

  const featureMeans = new Array(nFeatures).fill(0)
  const featureStds = new Array(nFeatures).fill(1)
  for (let f = 0; f < nFeatures; f++) {
    const vals = X.map(r => r[f]!)
    const m = vals.reduce((s, v) => s + v, 0) / n
    const v = Math.sqrt(vals.reduce((s, vv) => s + (vv - m) ** 2, 0) / Math.max(1, n - 1))
    featureMeans[f] = m
    featureStds[f] = Math.max(v, 1e-8)
  }

  const Xnorm = X.map(r => r.map((v, i) => (v - featureMeans[i]!) / featureStds[i]!))

  const basePrediction = y.reduce((s, v) => s + v, 0) / n
  const residuals = y.map(v => v - basePrediction)

  const trees: TreeNode[] = []
  const allIndices = Xnorm.map((_, i) => i)

  for (let iter = 0; iter < p.nEstimators; iter++) {
    const rng = [...allIndices].sort(() => seededRandom() - 0.5)
    const sampleIdx = rng.slice(0, Math.floor(n * p.subsample))
    const res = residuals

    const tree = buildTree(Xnorm, res, sampleIdx, 0, p)
    trees.push(tree)

    for (let i = 0; i < n; i++) {
      residuals[i]! -= p.learningRate * predictTree(tree, Xnorm[i]!)
    }
  }

  return { params: p, trees, basePrediction, featureMeans, featureStds }
}

export function predictGBM(config: GBMConfig, x: number[]): number {
  const xnorm = x.map((v, i) => (v - config.featureMeans[i]!) / config.featureStds[i]!)
  let pred = config.basePrediction
  for (const tree of config.trees) {
    pred += config.params.learningRate * predictTree(tree, xnorm)
  }
  return Math.max(0.01, pred)
}

export function featureImportance(config: GBMConfig): { name: string; importance: number }[] {
  const counts: number[] = new Array(config.featureMeans.length).fill(0)
  function countSplits(node: TreeNode) {
    if (!node.isLeaf) {
      counts[node.feature]!++
      if (node.left) countSplits(node.left)
      if (node.right) countSplits(node.right)
    }
  }
  for (const tree of config.trees) countSplits(tree)
  const total = counts.reduce((s, v) => s + v, 0) || 1
  const names = extractFeatureNames()
  return counts.map((c, i) => ({ name: names[i]! ?? `f${i}`, importance: c / total })).sort((a, b) => b.importance - a.importance)
}

/* ───── Serialization ───── */

export function serializeGBM(config: GBMConfig): string {
  return JSON.stringify(config)
}

export function deserializeGBM(json: string): GBMConfig {
  return JSON.parse(json)
}
