# Anchored Summary

## Origin & Top-Level Goal
Rapid-decision tool for Bollywood film investment (producer/financier). Core metric: **break-even anchored ×-multiple** with era-aware rights coverage, 9-dim feature vector, and walk-forward validated thresholds.

## What Exists (Source of Truth)
- **`bollywood_input.csv`** — 2,454 films, 19 columns. 729 full-finance (budget+gross), 236 imputed (band-median, excluded from training). Pre-sale rights columns and 8 content-score columns all empty.
- **`src/lib/bayesian-model.ts`** — Conjugate normal-normal shrinkage per genre, budgetBand, tier, month + global prior.
- **`src/lib/gbm-model.ts`** — Pure-TS GBM (200 trees, maxDepth=4, lr=0.08, CV-tuned). 9-dim feature vector: budget_scaled, actor_tier, director_tier, actor_rank, director_rank, rank_availability, sequel_flag, month_sin, month_cos. No genre OHE, no production_house in GBM. Mulberry32-seeded, z-score normalized features.
- **`src/lib/ml-predictor.ts`** — Orchestrates GBM + Bayes. Filters `!is_imputed_finance` from training. Passes `release_year` for era-aware normalized multiples. Cross-validates GBM via 3-fold time-series CV.
- **`src/lib/scoring-engine.ts`** — 10 producer components (+market sentiment when available), 0–100 score, ML blend (0.6 evidence + 0.4 ML). PERCENTILE_BUCKETS from training distribution. BASE_PCT_THRESHOLDS at offset 0.
- **`src/lib/industry-constants.ts`** — Era-aware (pre_ott/ott_growth/covid/mature) × 7-band rights coverage and P&A (VERIFIED fixtures, `docs/era-constants-sources.md`). `estimatedBreakeven(budget, releaseYear?)` defaults to mature. `normalizedMultiple(grossMult, budget, releaseYear?, rightsFrac?)` accepts optional user-supplied coverage.
- **`src/lib/impute-finance.ts`** — Tags `is_imputed_finance: true` on 236 band-median rows (79 budget-only + 157 gross-only). Stats only, excluded from ML.
- **`src/lib/confidence-interval.ts`** — Wilson CI + seeded bootstrap CI.
- **`src/lib/dataset-stats.ts`** — Temporal-weighted stats (recency ramp 1.0–3.0×) with era-aware normalized multiples.
- **`scripts/evaluate-forward-chaining.ts`** — Primary benchmark. 14 folds, 658 films, full-engine walk-forward. Includes threshold sweep, CIs on all headline metrics, both naive baselines. Emits `src/generated/benchmark-results.json`.
- **`scripts/evaluate-75-25.ts`** — Appendix benchmark (labeled inflated by temporal leakage). Emits `src/generated/benchmark-75-25.json`.
- **`scripts/calibrate-thresholds.ts`** — OOS threshold sweeper.
- **`scripts/verify-*.ts`** — Acceptance tests per PR (`npm run verify`).

## Key Numerical Anchors
| Fact | Value | Source |
|------|-------|--------|
| Dataset films | 2,454 | CSV parse (`npm run verify:pr1`) |
| Full-finance films (trainable) | 729 (all High confidence but one) | after imputation filter |
| Imputed (stats only) | 236 (79 budget-only + 157 gross-only) | band-median |
| Backtest concept inputs | neutral constants (6/5) — verdict-derived sliders leaked outcomes, removed | config.backtestConcept |
| Feature vector dims | 9 | gbm-model (`npm run verify:pr3`) |
| Era-aware median normalized | 0.415× | current dataset |
| WALK-FORWARD accuracy | 29.3% [26.0%, 32.9%] | forward-chaining fixture |
| Walk-forward GL precision | 11.3% [6.8%, 18.1%] (≈ prevalence 11%) | forward-chaining fixture |
| Walk-forward GL recall | 18.7% [11.5%, 28.9%] | forward-chaining fixture |
| Walk-forward F1 | 14.1% [7.9%, 20.1%] | forward-chaining fixture |
| Greenlight calls | 124/658 (14 hits of 75) | forward-chaining fixture |
| Precision at ANY threshold | ~9–14% (sweep-proven flat; no threshold manufactures precision) | forward-chaining sweep |
| 75-25 accuracy (APPENDIX) | 30.1% [23.9%, 37.1%] | random split (leakage-inflated) |
| Track record 2024–25 (n=69) | acc 20.3% · prec 13.5% [5.9–28.0] · rec 55.6% | track-record fixture |
| Always-flop baseline | 80.5% | fold train-side |
| Band-median baseline | 63.7% acc / 1.230 RMSE vs model RMSE 1.303 | forward-chaining |
| Train hit-rate prevalence | 11.0% | expected GL precision at random |
| Producer realisation rate | 32% | industry-constants |
| BASE_SIGMA | 1.55 (std(log(normalized)) = 1.554 on training data) | industry-constants |

## Completed Changes (PR1–PR4)
- CSV parsing hardened (quoted commas; hard-fail on malformed rows, never silent drops). All 2454 rows parse.
- 7 unused fields removed from type/parser.
- gross_multiple precision fixed (no rounding to 2 decimals).
- Imputed rows excluded from ML training (`is_imputed_finance` flag) — acceptance-tested across all 14 folds.
- Era-aware break-even (4 eras × 7 bands). Sourced per-constant documentation (`docs/era-constants-sources.md`); fixtures guarded by `verify:pr2`.
- 9-dim canonical feature vector (removed 16 genre OHE, removed production_house from GBM). Canonical spec + no-target-encoding policy guarded by `verify:pr3`.
- Confidence interval utility (Wilson + seeded bootstrap). CIs on all headline metrics.
- Forward-chaining primary benchmark with full naive baselines (always-flop, band-median, prevalence). Results fixture consumed by UI/docs (`verify:pr4`).
- CrossValidateGBM handles empty results.
- PERCENTILE_BUCKETS recomputed from training data.
- PCT_THRESHOLDS verified via walk-forward sweep (base thresholds retained; best F1 at offset −4 too aggressive).
- Landing page and results footnote read metrics from the generated fixture — no hand-copied numbers.
- Fabricated testimonials removed from the landing page (replaced with auditable proof points).
- Verdict–risk coherence guard: greenlights under high/very-high diagnosed risk cap at conditional (narrative states the cap).
- Percentile buckets recalibrated to the neutral-concept engine distribution (scripts/recalibrate-percentiles.ts).
- Sensitivity engine reports immaterial moves + budget-downshift scenarios alongside material levers.

## Reverted Experiments
- Log-space GBM target — tried, decreased walk-forward accuracy. Raw-space retained.

## Things NOT to Re-Argue
- Producer realisation = 32%.
- Break-even formula: (1 + PA_ratio) × (1 − rights_coverage) / 0.32; mature band multiples 3.50× (sub-10 Cr) → 1.90× (100–200 Cr).
- Target is normalized break-even ×-multiple, not win-rate.
- ML model is continuous — 0.6× blend with evidence score.
- 729/2454 = accepted survivorship bias.
- Pre-sale coverage (12% producer weight) is user-input only.
- Backtest concept inputs are neutral constants — verdict-derived sliders were outcome leakage, removed.
- Rank scores imputed from tier (step function) — both train and predict.
- No genre OHE in GBM — Bayesian model owns genre via shrinkage.
- No target-encoded features — OOF encoding not required.
- Walk-forward is primary benchmark, not 75-25 split. 75-25 numbers stay in the appendix, labeled inflated.
- Base thresholds retained: precision is flat across the sweep, so thresholds only trade accuracy vs recall.
- GBM RMSE (1.303) does not beat band-median RMSE (1.230) — documented limitation.
## Queued for Backend Phase (measured, not yet implemented)
- Solo-vehicle flag: films with no second lead hit 28.8% (n=73) vs 11.4% base; second-lead tier adds nothing (strong 10.5% vs weak 9.1%, n=324/88). Model with controls before trusting (likely star-vehicle confounding).
- Buyer surfaces carry no performance figures (positioning policy); the repo stays fully numbered for diligence.
