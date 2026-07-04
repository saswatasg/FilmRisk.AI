# Anchored Summary

## Origin & Top-Level Goal
Rapid-decision tool for Bollywood film investment (producer/financier). Core metric: **break-even anchored ×-multiple** with era-aware rights coverage, 9-dim feature vector, and walk-forward validated thresholds.

## What Exists (Source of Truth)
- **`bollywood_input.csv`** — 2,209 films, 19 columns. 679 full-finance (budget+gross), 105 imputed (band-median). Pre-sale rights columns and 8 content-score columns all empty.
- **`src/lib/bayesian-model.ts`** — Beta-binomial shrinkage per genre, budgetBand, tier, month + global prior.
- **`src/lib/gbm-model.ts`** — Pure-TS GBM (200 trees, maxDepth=4, lr=0.08). 9-dim feature vector: budget_scaled, actor_tier, director_tier, actor_rank, director_rank, rank_availability, sequel_flag, month_sin, month_cos. No genre OHE, no production_house in GBM. Mulberry32-seeded, z-score normalized features.
- **`src/lib/ml-predictor.ts`** — Orchestrates GBM + Bayes. Filters `!is_imputed_finance` from training. Passes `release_year` for era-aware normalized multiples. Cross-validates GBM via 3-fold time-series CV.
- **`src/lib/scoring-engine.ts`** — 10 components, 0–100 score, ML blend (0.6 evidence + 0.4 ML). PERCENTILE_BUCKETS from 679-film training. PCT_THRESHOLDS at offset +1.
- **`src/lib/industry-constants.ts`** — Era-aware (pre_ott/ott_growth/covid/mature) × 7-band rights coverage and P&A. `estimatedBreakeven(budget, releaseYear?)` defaults to mature. `normalizedMultiple(grossMult, budget, releaseYear?, rightsFrac?)` accepts optional user-supplied coverage.
- **`src/lib/impute-finance.ts`** — Tags `is_imputed_finance: true` on 105 band-median rows. Stats only, excluded from ML.
- **`src/lib/confidence-interval.ts`** — Wilson CI + seeded bootstrap CI.
- **`src/lib/dataset-stats.ts`** — Temporal-weighted stats (recency ramp 1.0–3.0×) with era-aware normalized multiples.
- **`scripts/evaluate-forward-chaining.ts`** — Primary benchmark. 12 folds, 619 films, full-engine walk-forward. Includes threshold sweep.
- **`scripts/evaluate-75-25.ts`** — Secondary in-distribution upper bound.
- **`scripts/calibrate-thresholds.ts`** — OOS threshold sweeper (uses same PERCENTILE_BUCKETS as scoring engine).

## Key Numerical Anchors
| Fact | Value | Source |
|------|-------|--------|
| Dataset films | 2,209 | CSV parse |
| Full-finance films (trainable) | 679 | after imputation filter |
| Imputed (stats only) | 105 | band-median |
| Feature vector dims | 9 | gbm-model |
| Era-aware median normalized | 0.567× | industry-constants |
| WALK-FORWARD accuracy | 47.2% [43.3%, 51.1%] | forward-chaining |
| Walk-forward GL precision | 29.8% [23.5%, 37.1%] | forward-chaining |
| Walk-forward GL recall | 44.0% | forward-chaining |
| 75-25 accuracy | 53.5% [46.0%, 60.9%] | random split |
| 75-25 GL precision | 44.2% [31.6%, 57.7%] | random split |
| Always-flop baseline | 67.2% | dataset class dist |
| Producer realisation rate | 32% | industry-constants |

## Completed Changes (PR1–PR4)
- CSV parsing fixed (quoted commas in display_title/director). All 2209 rows parse.
- 7 unused fields removed from type/parser.
- gross_multiple precision fixed (no rounding to 2 decimals).
- Imputed rows excluded from ML training (`is_imputed_finance` flag).
- Era-aware break-even (4 eras × 7 bands). Older films get higher break-even (less rights coverage).
- 9-dim canonical feature vector (removed 16 genre OHE, removed production_house from GBM).
- Confidence interval utility (Wilson + bootstrap).
- Forward-chaining primary benchmark (was standalone backtest.cjs).
- CrossValidateGBM handles empty results.
- PERCENTILE_BUCKETS updated to 679-film distribution.
- PCT_THRESHOLDS verified via walk-forward sweep (offset +1 retained).

## Reverted Experiments
- Log-space GBM target (Task 9) — tried, decreased walk-forward accuracy from 39.4% → 30.2%. Raw-space retained.

## Things NOT to Re-Argue
- Producer realisation = 32%.
- Target is normalized break-even ×-multiple, not win-rate.
- ML model is continuous — 0.6× blend with evidence score.
- 679/2209 = accepted survivorship bias.
- Pre-sale coverage (22% weight) is user-input only.
- Rank scores imputed from tier (step function) — both train and predict.
- No genre OHE in GBM — Bayesian model owns genre via shrinkage.
- Walk-forward is primary benchmark, not 75-25 split.
- Log-space GBM did not improve metrics and was reverted.
