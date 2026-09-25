/*
  PR4 acceptance tests — validation reform + number-free buyer positioning.
  1. The walk-forward fixture exists and is the primary benchmark.
  2. Headline metrics carry 95% CIs; naive baselines accompany every performance surface.
  3. The 75-25 fixture is labeled appendix-only (temporal leakage) and is never primary.
  4. Buyer surfaces (landing, one-pager, results footnote) carry NO performance
     figures or ranges — positioning policy. Scope counts are allowed; rates,
     CIs, decimals, and recall/precision language are not.
  5. The fixture matches the current dataset (regeneration not stale).
  6. Landing scope counts match the fixture (no drift, no hand-copied metrics).
  Run: npm run verify:pr4
*/
import { readFileSync, existsSync, readdirSync } from 'fs'
import { createHash } from 'crypto'
import { join } from 'path'

let allPass = true
function check(name: string, cond: boolean, detail = ''): boolean {
  console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
  if (!cond) allPass = false
  return cond
}

/* Extract rendered JSX text: strip expression containers, then take text between tags */
function jsxTextNodes(src: string): string[] {
  let s = src
  for (let i = 0; i < 4; i++) s = s.replace(/\{[^{}]*\}/g, ' ')
  const out: string[] = []
  const re = />\s*([^<>{}]+?)\s*</g
  let m: RegExpExecArray | null
  while ((m = re.exec(s)) !== null) {
    const t = m[1]!.replace(/\s+/g, ' ').trim()
    if (t && !/^(import|export|const|return|function)/.test(t)) out.push(t)
  }
  return out
}

/* Extract long quoted string literals (prose in data arrays, not classes/keys).
   className="..." attribute values are styling, not buyer-facing copy — exempt. */
function proseLiterals(src: string): string[] {
  const out: string[] = []
  const re = /'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) {
    const before = src.slice(Math.max(0, m.index - 10), m.index)
    if (/className=$/.test(before)) continue
    const t = (m[1] ?? m[2] ?? '').trim()
    if (t.length > 40) out.push(t)
  }
  return out
}

const BANNED = [/\baccuracy\b/i, /\bprecision\b/i, /\brecall\b/i, /\bF1\b/, /%/, /±/, /\d+\.\d/, /base rate/i]

function findBanned(texts: string[]): string[] {
  const hits: string[] = []
  for (const t of texts) {
    for (const pat of BANNED) {
      if (pat.test(t)) {
        hits.push(`"${t.slice(0, 60)}..." matches ${pat}`)
        break
      }
    }
  }
  return hits
}

function main(): void {
  console.log('\n=== PR4 — Validation reform + positioning acceptance tests ===\n')

  const fixturePath = join(process.cwd(), 'src', 'generated', 'benchmark-results.json')
  const appendixPath = join(process.cwd(), 'src', 'generated', 'benchmark-75-25.json')

  check('Walk-forward fixture exists (src/generated/benchmark-results.json)', existsSync(fixturePath),
    'generate with: npm run benchmark')

  if (!existsSync(fixturePath)) {
    console.log('\nCannot continue without the fixture.\n')
    process.exit(1)
  }

  const fixture = JSON.parse(readFileSync(fixturePath, 'utf-8')) as {
    primary: boolean
    benchmark: string
    folds: { count: number; testedFilms: number }
    metrics: Record<string, { value: number; ci95?: number[] }>
    baselines: Record<string, { value?: number; accuracy?: number; note?: string }>
    dataset: { sha256: string; rows: number; trainableFilms: number }
    generatedAt: string
  }

  check('Fixture declares itself the primary walk-forward benchmark',
    fixture.primary === true && fixture.benchmark === 'walk-forward-forward-chaining')

  const metricsWithCI = ['accuracy', 'greenlightPrecision', 'greenlightRecall', 'f1']
  const missingCI = metricsWithCI.filter(k => !Array.isArray(fixture.metrics[k]?.ci95))
  check('All headline metrics (accuracy, precision, recall, F1) carry 95% CIs', missingCI.length === 0,
    missingCI.length ? `missing CI: ${missingCI.join(', ')}` : '')

  const baselineKeys = ['alwaysFlopAccuracy', 'bandMedianMultiple', 'modelRmseNormalizedMultiple', 'trainHitRatePrevalence']
  const missingBaselines = baselineKeys.filter(k => fixture.baselines[k] === undefined)
  check('Naive baselines present (always-flop, band-median, model RMSE, hit-rate prevalence)', missingBaselines.length === 0,
    missingBaselines.length ? `missing: ${missingBaselines.join(', ')}` : '')

  if (existsSync(appendixPath)) {
    const appendix = JSON.parse(readFileSync(appendixPath, 'utf-8')) as { primary: boolean; appendixOnly: boolean; caveat: string }
    check('75-25 fixture exists and is labeled appendix-only (temporal-leakage inflated)',
      appendix.primary === false && appendix.appendixOnly === true && appendix.caveat.includes('leakage'))
  } else {
    check('75-25 fixture exists (generate with: npm run benchmark:75-25)', false)
  }

  /* Stale hardcoded metrics must not exist anywhere buyer-facing */
  const appDir = join(process.cwd(), 'src', 'app')
  const stalePatterns = ['93.3', '51.9%', '15 annual windows', '619 films', '2.72']
  const violations: string[] = []
  function scanDir(dir: string): void {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name)
      if (entry.isDirectory()) { scanDir(p); continue }
      if (!entry.name.endsWith('.tsx') && !entry.name.endsWith('.ts')) continue
      const src = readFileSync(p, 'utf-8')
      for (const pat of stalePatterns) {
        if (src.includes(pat)) violations.push(`${entry.name}: "${pat}"`)
      }
    }
  }
  scanDir(appDir)
  check('No stale hardcoded metrics in buyer-facing src/app', violations.length === 0,
    violations.length ? violations.join('; ') : '')

  /* Landing: number-free prose + scope counts matching the fixture */
  const pageSrc = readFileSync(join(appDir, 'page.tsx'), 'utf-8')
  const pageHits = findBanned([...jsxTextNodes(pageSrc), ...proseLiterals(pageSrc)])
  check('Landing carries no performance figures or ranges (positioning policy)', pageHits.length === 0,
    pageHits.length ? pageHits.slice(0, 3).join('; ') : '')

  const scopeVals = [...pageSrc.matchAll(/v:\s*'([\d,]+)'/g)].map(x => x[1])
  const expectedScope = [
    fixture.dataset.rows.toLocaleString('en-US'),
    String(fixture.dataset.trainableFilms),
    String(fixture.folds.testedFilms),
    String(fixture.folds.count),
  ]
  check('Landing scope counts match the fixture (no drift)', JSON.stringify(scopeVals) === JSON.stringify(expectedScope),
    `page=[${scopeVals.join(', ')}] fixture=[${expectedScope.join(', ')}]`)

  check('Landing page contains no fabricated testimonials',
    !pageSrc.includes('testimonial') && !pageSrc.includes('Eros International') && !pageSrc.includes('Multiples PE'))

  /* Results footnote: number-free */
  const resultsSrc = readFileSync(join(appDir, 'evaluate', 'results.tsx'), 'utf-8')
  const footnoteStart = resultsSrc.indexOf('Methodology:')
  const footnote = footnoteStart >= 0 ? resultsSrc.slice(footnoteStart, footnoteStart + 800) : ''
  const footnoteHits = findBanned(jsxTextNodes(footnote))
   check('Results footnote carries no performance figures (positioning policy)', footnoteHits.length === 0,
     footnoteHits.length ? footnoteHits.slice(0, 3).join('; ') : '')
  check('Results page no longer imports benchmark fixture (server-sourced counts)',
    !resultsSrc.includes('benchmark-results.json'))

  /* One-pager: number-free */
  const onePagerPath = join(process.cwd(), 'docs', 'methodology-one-pager.md')
  if (existsSync(onePagerPath)) {
    const md = readFileSync(onePagerPath, 'utf-8')
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`[^`]*`/g, ' ')
    const mdHits = findBanned(md.split('\n').map(l => l.trim()).filter(Boolean))
    check('Methodology one-pager carries no performance figures (positioning policy)', mdHits.length === 0,
      mdHits.length ? mdHits.slice(0, 3).join('; ') : '')
    check('One-pager contains zero implementation references (no GBM/hyperparameters/libraries)',
      !/\b(GBM|gradient boost|hyperparameter|learning rate|trees|depth|lucide|tailwind|next\.js|react|typescript|isotonic|wilson|bootstrap|seed)\b/i.test(md))
  } else {
    check('Methodology one-pager exists', false)
  }

  /* Fixture freshness */
  const csvText = readFileSync(join(process.cwd(), 'src', 'data', 'bollywood_input.csv'), 'utf-8')
  const currentSha = createHash('sha256').update(csvText).digest('hex').slice(0, 16)
  check('Fixture dataset hash matches current CSV (fixture is not stale)',
    fixture.dataset.sha256 === currentSha, `fixture=${fixture.dataset.sha256}, current=${currentSha}`)
  check('Fixture dataset row count matches current CSV',
    fixture.dataset.rows === csvText.split('\n').filter(l => l.trim()).length - 1)

  console.log(`\n${allPass ? 'ALL PR4 CHECKS PASSED' : 'PR4 CHECKS FAILED'}\n`)
  process.exit(allPass ? 0 : 1)
}

main()
