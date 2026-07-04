/* Seeded PRNG (Mulberry32) for deterministic bootstrap */
let rngState = 42
export function setCISeed(seed: number): void { rngState = seed }
function seededRandom(): number {
  rngState |= 0; rngState = rngState + 0x6D2B79F5 | 0
  let t = Math.imul(rngState ^ rngState >>> 15, 1 | rngState)
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
  return ((t ^ t >>> 14) >>> 0) / 4294967296
}

/* Wilson score interval for binomial proportions */
export function wilsonCI(pos: number, n: number, z: number = 1.96): { lower: number; upper: number } {
  if (n === 0) return { lower: 0, upper: 1 }
  const p = pos / n
  const denom = 1 + z * z / n
  const centre = (p + z * z / (2 * n)) / denom
  const margin = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / denom
  return {
    lower: Math.max(0, centre - margin),
    upper: Math.min(1, centre + margin),
  }
}

/* Bootstrap confidence interval for arbitrary metrics */
export function bootstrapCI<T>(
  values: T[],
  metricFn: (sample: T[]) => number,
  nResamples: number = 1000,
  alpha: number = 0.05,
): { lower: number; upper: number; point: number } {
  const n = values.length
  const point = metricFn(values)

  const stats: number[] = []
  for (let i = 0; i < nResamples; i++) {
    const sample: T[] = []
    for (let j = 0; j < n; j++) {
      sample.push(values[Math.floor(seededRandom() * n)]!)
    }
    stats.push(metricFn(sample))
  }
  stats.sort((a, b) => a - b)
  const lo = Math.floor(nResamples * alpha / 2)
  const hi = Math.ceil(nResamples * (1 - alpha / 2)) - 1
  return {
    lower: stats[lo]!,
    upper: stats[hi]!,
    point,
  }
}

/* Known test case: Wilson CI for 9/10 */
export function testWilsonCI(): boolean {
  const ci = wilsonCI(9, 10)
  const ok = ci.lower > 0.55 && ci.lower < 0.65 && ci.upper > 0.90 && ci.upper < 1.0
  console.log(`wilsonCI(9, 10) = [${(ci.lower * 100).toFixed(1)}%, ${(ci.upper * 100).toFixed(1)}%] — ${ok ? 'PASS' : 'FAIL'}`)
  return ok
}
