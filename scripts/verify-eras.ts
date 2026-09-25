/*
  PR2 acceptance tests — era-aware break-even constants.
  1. Break-even multiples for pre-2015 films differ measurably from post-2015 films at the same budget band.
  2. No single global rights_coverage constant remains in the codebase.
  3. Era constants match the documented fixtures (VERIFIED — do not alter).
  4. Mature-era band multiples reproduce the verified values (3.50x sub-10 Cr, 1.90x 100-200 Cr).
  Run: npm run verify:pr2
*/
import { readFileSync, existsSync, readdirSync } from 'fs'
import { join } from 'path'
import {
  eraByYear, eraRightsCoverage, eraPARatio, estimatedBreakeven,
  PRODUCER_REALISATION_RATE, PA_RATIO, ESTIMATED_RIGHTS_COVERAGE, type Era,
} from '../src/lib/industry-constants'

let allPass = true
function check(name: string, cond: boolean, detail = ''): boolean {
  console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
  if (!cond) allPass = false
  return cond
}

/* Recorded fixtures of the verified era tables (docs/era-constants-sources.md) */
const FIXTURE_PA_RATIO: Record<Era, Record<string, number>> = {
  pre_ott:   { '<10': 0.35, '10-30': 0.30, '30-60': 0.25, '60-100': 0.25, '100-200': 0.30, '200-300': 0.35, '>300': 0.45 },
  ott_growth:{ '<10': 0.35, '10-30': 0.30, '30-60': 0.27, '60-100': 0.27, '100-200': 0.32, '200-300': 0.37, '>300': 0.47 },
  covid:     { '<10': 0.40, '10-30': 0.35, '30-60': 0.30, '60-100': 0.30, '100-200': 0.35, '200-300': 0.40, '>300': 0.50 },
  mature:    { '<10': 0.40, '10-30': 0.35, '30-60': 0.30, '60-100': 0.30, '100-200': 0.35, '200-300': 0.40, '>300': 0.50 },
}
const FIXTURE_RIGHTS: Record<Era, Record<string, number>> = {
  pre_ott:   { '<10': 0.08, '10-30': 0.15, '30-60': 0.20, '60-100': 0.25, '100-200': 0.30, '200-300': 0.32, '>300': 0.35 },
  ott_growth:{ '<10': 0.12, '10-30': 0.22, '30-60': 0.32, '60-100': 0.36, '100-200': 0.45, '200-300': 0.48, '>300': 0.50 },
  covid:     { '<10': 0.15, '10-30': 0.28, '30-60': 0.42, '60-100': 0.48, '100-200': 0.58, '200-300': 0.60, '>300': 0.62 },
  mature:    { '<10': 0.20, '10-30': 0.30, '30-60': 0.40, '60-100': 0.40, '100-200': 0.55, '200-300': 0.55, '>300': 0.55 },
}

const BAND_REPRESENTATIVE_BUDGET: Record<string, number> = {
  '<10': 5, '10-30': 20, '30-60': 45, '60-100': 80, '100-200': 150, '200-300': 250, '>300': 400,
}
const ERAS: Era[] = ['pre_ott', 'ott_growth', 'covid', 'mature']

function tablesMatch(actual: Record<Era, Record<string, number>>, fixture: Record<Era, Record<string, number>>): boolean {
  for (const era of ERAS) {
    for (const [band, value] of Object.entries(fixture[era]!)) {
      if (Math.abs((actual[era]?.[band] ?? -1) - value) > 1e-12) return false
    }
  }
  return true
}

function main(): void {
  console.log('\n=== PR2 — Era-aware break-even constants acceptance tests ===\n')

  /* 1. Pre/post-2015 break-evens differ at every budget band */
  let allDiffer = true
  const diffs: string[] = []
  for (const [band, budget] of Object.entries(BAND_REPRESENTATIVE_BUDGET)) {
    const pre = estimatedBreakeven(budget, 2014)
    const post = estimatedBreakeven(budget, 2016)
    const same = Math.abs(pre - post) < 1e-9
    if (same) allDiffer = false
    diffs.push(`${band}: pre=${pre.toFixed(2)}x post=${post.toFixed(2)}x`)
  }
  check('Break-evens differ pre-2015 vs post-2015 at every budget band', allDiffer, diffs.join('; '))

  /* Era coverage strictly increases for rights (pre_ott < ott_growth) at every band */
  let rightsMonotonic = true
  for (const budget of Object.values(BAND_REPRESENTATIVE_BUDGET)) {
    if (!(eraRightsCoverage(budget, 'pre_ott') < eraRightsCoverage(budget, 'ott_growth'))) rightsMonotonic = false
  }
  check('Pre-OTT rights coverage strictly below early-OTT coverage at every band', rightsMonotonic)

  /* 2. No scalar global rights constant anywhere in src/lib */
  const libDir = join(process.cwd(), 'src', 'lib')
  let scalarConstantFound: string | null = null
  for (const file of readdirSync(libDir)) {
    if (!file.endsWith('.ts') && !file.endsWith('.cjs')) continue
    const src = readFileSync(join(libDir, file), 'utf-8')
    const lines = src.split('\n')
    for (const [i, line] of lines.entries()) {
      if (/(?:const|let)\s+\w*(?:RIGHTS|Rights|rights)\w*\s*=\s*\d+(\.\d+)?\s*$/.test(line.trim())) {
        scalarConstantFound = `${file}:${i + 1}: ${line.trim()}`
      }
    }
  }
  check('No scalar global rights_coverage constant in src/lib', scalarConstantFound === null, scalarConstantFound ?? '')

  /* Rights lookups are era-parameterized functions, not constants */
  check('eraRightsCoverage is era-parameterized',
    eraRightsCoverage(150, 'pre_ott') !== eraRightsCoverage(150, 'mature') &&
    eraRightsCoverage(150, 'covid') !== eraRightsCoverage(150, 'mature'))
  check('eraByYear boundaries: 2014 pre_ott, 2015 ott_growth, 2019 ott_growth, 2020 covid, 2021 covid, 2022 mature',
    eraByYear(2014) === 'pre_ott' && eraByYear(2015) === 'ott_growth' && eraByYear(2019) === 'ott_growth' &&
    eraByYear(2020) === 'covid' && eraByYear(2021) === 'covid' && eraByYear(2022) === 'mature' && eraByYear(2025) === 'mature')

  /* 3. Era constants match recorded fixtures (VERIFIED) */
  check('PA_RATIO matches documented fixture', tablesMatch(PA_RATIO, FIXTURE_PA_RATIO))
  check('ESTIMATED_RIGHTS_COVERAGE matches documented fixture', tablesMatch(ESTIMATED_RIGHTS_COVERAGE, FIXTURE_RIGHTS))
  check('Producer realisation rate = 0.32 (VERIFIED)', PRODUCER_REALISATION_RATE === 0.32)

  /* 4. Mature-era verified band multiples */
  const sub10 = estimatedBreakeven(5, 2023)
  const big = estimatedBreakeven(150, 2023)
  check('Mature sub-10 Cr break-even = 3.50x (VERIFIED)', Math.abs(sub10 - 3.5) < 1e-9, `got ${sub10.toFixed(4)}x`)
  check('Mature 100-200 Cr break-even ~ 1.90x (VERIFIED)', Math.abs(big - 1.8984375) < 1e-6, `got ${big.toFixed(4)}x`)

  /* Break-even formula integrity: (1 + PA) x (1 - rights) / 0.32 */
  const pa = eraPARatio(150, 'mature')
  const rights = eraRightsCoverage(150, 'mature')
  const formula = (1 + pa) * (1 - rights) / PRODUCER_REALISATION_RATE
  check('Break-even formula integrity ((1+PA)x(1-rights)/0.32)', Math.abs(formula - big) < 1e-9)

  /* Sourced documentation exists */
  const docPath = join(process.cwd(), 'docs', 'era-constants-sources.md')
  const docExists = existsSync(docPath)
  let docOk = false
  if (docExists) {
    const doc = readFileSync(docPath, 'utf-8')
    docOk = doc.includes('pre_ott') && doc.includes('ott_growth') && doc.includes('covid') && doc.includes('mature') &&
      doc.includes('FICCI') && doc.includes('3.50')
  }
  check('Sourced era documentation exists (docs/era-constants-sources.md)', docOk)

  console.log(`\n${allPass ? 'ALL PR2 CHECKS PASSED' : 'PR2 CHECKS FAILED'}\n`)
  process.exit(allPass ? 0 : 1)
}

main()
