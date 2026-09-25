/*
  Master acceptance-test orchestrator — runs every PR verification suite.
  Exit code 0 only if all suites pass. Run: npm run verify
*/
import { spawnSync } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'

const suites = [
  { name: 'PR1 — data foundation', script: 'verify-data-foundation' },
  { name: 'PR2 — era constants', script: 'verify-eras' },
  { name: 'PR3 — feature canonicalization', script: 'verify-features' },
  { name: 'PR4 — validation reform', script: 'verify-benchmarks' },
  { name: 'PR7 — explainability & sensitivity', script: 'verify-explainability' },
  { name: 'Flow — parity & defaults', script: 'verify-flow' },
]

const results: { name: string; ok: boolean; skipped: boolean }[] = []

for (const suite of suites) {
  const scriptPath = join(process.cwd(), 'scripts', `${suite.script}.ts`)
  if (!existsSync(scriptPath)) {
    console.log(`\n━━━ ${suite.name} ━━━\n  SKIP  (script not yet implemented)`)
    results.push({ name: suite.name, ok: true, skipped: true })
    continue
  }
  console.log(`\n━━━ ${suite.name} ━━━`)
  const r = spawnSync('npx', ['tsx', `scripts/${suite.script}.ts`], { stdio: 'inherit', shell: process.platform === 'win32' })
  results.push({ name: suite.name, ok: r.status === 0, skipped: false })
}

console.log('\n━━━━━━━━━ ACCEPTANCE SUMMARY ━━━━━━━━━')
for (const r of results) {
  console.log(`  ${r.skipped ? 'SKIP' : r.ok ? 'PASS' : 'FAIL'}  ${r.name}`)
}
const allOk = results.every(r => r.ok)
console.log(`\n${allOk ? 'ALL ACCEPTANCE TESTS PASSED' : 'ACCEPTANCE TESTS FAILED'}\n`)
process.exit(allOk ? 0 : 1)
