# FilmRisk.AI — "Greenlit"

Pre-release Bollywood film investment scoring: a Next.js app that scores a film project
(greenlight verdict, financier risk, Monte Carlo ROI, comparables, risk diagnosis, sensitivity
levers) against 25 years of Bollywood outcomes — 2,454 films, 729 with verified financials.

## Quick start

```bash
npm install
npm run dev        # http://localhost:3000
```

## Commands

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js dev server / production build / serve |
| `npm run lint` | ESLint |
| `npm run benchmark` | **Primary honesty test** — walk-forward validation (train on past, test on later years). Emits `src/generated/benchmark-results.json`, the fixture the landing page and reports read |
| `npm run benchmark:75-25` | Appendix benchmark (random split, labeled leakage-inflated). Emits `src/generated/benchmark-75-25.json` |
| `npm run calibrate` | Out-of-sample threshold calibration sweep |
| `npm run track-record` | Out-of-sample track-record report on the 2024–2025 holdout (`docs/track-record.md`) |
| `npm run tiers` | Regenerate data-derived tier reference bands (`src/generated/tier-reference.json`) |
| `npm run demo` | End-to-end pipeline: CSV → models → scored demo films, zero manual steps |
| `npm run verify` | Full acceptance suite (PR1–PR4, PR7, flow). Exit 0 only if every check passes |
| `npm run verify:pr1` … `verify:pr4`, `verify:pr7`, `verify:flow` | Individual PR acceptance suites |

## Honest headline numbers (walk-forward, `src/generated/benchmark-results.json`)

| Metric | Value [95% CI] | Naive baseline |
|---|---|---|
| Accuracy | 29.3% [26.0%, 32.9%] | always-flop 80.5% · band-median 63.7% |
| Greenlight precision | 11.3% [6.8%, 18.1%] | base hit rate 11.0% |
| Greenlight recall | 18.7% [11.5%, 28.9%] | — |
| F1 | 14.1% [7.9%, 20.1%] | — |

658 films tested across 14 rolling annual folds, with neutral concept inputs (the CSV has no
content scores; deriving them from verdicts leaked outcomes — removed). Backtests measure the
data-driven core only; production adds real user concept + pre-sale inputs whose variance is
unobservable in backtests. Buyer-facing surfaces carry no performance figures by policy —
this table is the engineering record.

## Architecture

```
wizard (/evaluate) → POST /api/evaluate → lib pipeline → single EvaluationResult JSON
```

The wizard is a Typeform-style conversational flow (`src/app/evaluate/evaluate-flow.tsx`):
one question per screen, keyboard-first (Enter/Esc), auto-advance on single-select,
smart defaults with advanced expanders, data-derived tier reference bands
(`src/generated/tier-reference.json`), and a live debounced score preview.
Names are not asked (tiers carry the signal); only the budget is required.

- `src/lib/csv-parser.ts` — quote-aware CSV parser that **hard-fails** on malformed rows (never silent drops)
- `src/lib/impute-finance.ts` — band-median imputation of partial rows, flagged `is_imputed_finance`, excluded from all training
- `src/lib/industry-constants.ts` — era-aware break-even (4 eras × 7 bands; VERIFIED fixtures, see `docs/era-constants-sources.md`)
- `src/lib/gbm-model.ts` — hand-rolled gradient-boosted trees, 9-dim features (see canonical spec in `docs/model-overview.md`), seeded PRNG
- `src/lib/bayesian-model.ts` — empirical-Bayes shrinkage per genre/tier/band/month
- `src/lib/scoring-engine.ts` — 10-component weighted scores + 60/40 ML blend + percentile verdicts
- `src/lib/financial-simulator.ts` — 10,000-path lognormal Monte Carlo
- `scripts/verify-*.ts` — executable acceptance tests for every claim below

Verified fixtures (do not alter): 32% producer realisation · break-even formula ·
mature band multiples 3.50×→1.90× · BASE_SIGMA 1.55 · seeded determinism ·
circular month encoding · Bayes wiring · evidence/input separation.

## Docs

- `docs/model-overview.md` — canonical engineering documentation
- `docs/anchored-summary.md` — source-of-truth anchors (numbers, completed changes, do-not-re-argue list)
- `docs/data-science-review.md` — historical audit (May 2026, superseded; correction table at top)
- `docs/era-constants-sources.md` — per-constant sources for era break-even tables
- `docs/data-provenance.md` — data-source licensing/provenance map
- `docs/methodology-one-pager.md` — non-technical summary for producers/fund managers
- `docs/track-record.md` — regenerable out-of-sample track record (2024–2025 holdout)

## Data

`src/data/bollywood_input.csv` (2,454 rows, 2001–2025) derived from Wikipedia-sourced film
data (see `docs/data-provenance.md`). Only ~30% of films report financials; dataset median
raw multiple 1.21× vs a real-market average near 1.0× — survivorship bias is disclosed in
every report and on the landing page, not corrected away.

## Limitations (from our own backtest)

- Regime-break years (2020–2021, 2022) and thin early folds are noisy; per-year detail in `docs/model-overview.md`.
- Pre-sale rights and concept sliders are user inputs — the CSV contains neither.
- 2024–2025 holdout is small (n=69); calibration buckets carry wide CIs.

Regenerate any number: `npm run benchmark && npm run track-record`.
