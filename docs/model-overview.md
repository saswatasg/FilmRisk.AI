# Film Risk Bollywood — Model Overview

## 1. Problem Definition

**Task**: Predict post-release financial performance of Bollywood films using only pre-release features known at pitch/investment time.

**Target Variable**: Break-even-normalized gross multiple — `worldwide_gross_cr / budget_cr`, adjusted by both budget band and release era to account for market-wide survivorship bias and changing ancillary-revenue landscape.

**Output Classes** (derived from normalized multiple):
| Class | Normalized Multiple | Description |
|-------|-------------------|-------------|
| BLOCKBUSTER | ≥2.0× | Major success |
| HIT | ≥1.5× | Profitable |
| BREAK_EVEN | ≥1.0× | Recouped investment |
| BELOW_AVG | ≥0.5× | Partial recovery |
| FLOP | <0.5× | Significant loss |

## 2. Dataset

### Source
- 2,454 Bollywood films (2001–2025); lineage: compiled from Wikipedia-sourced film pages (see `docs/data-provenance.md`)
- Cleaned to 19 columns: identifiers, release metadata, genre flags, cast/crew ranks, budget/gross, verdict
- **All 2,454 rows parse correctly** (no dropped rows — hard-fail parser, acceptance-tested by `npm run verify:pr1`)

### Financial Subset
- **729 films** have both budget AND gross (>0) — the full-finance core for ML training
- **79 budget-only** + **157 gross-only** = **236 imputed** via budget-band median multiples at load time (used for stats/UI only)
- **Imputed rows are excluded from ML training** (tagged `is_imputed_finance: true`) — their targets are deterministic (band median), so training on them would just learn the band median and inflate metrics

### Imputation Strategy (`src/lib/impute-finance.ts`)
Budget-band median multiple imputation:
1. Compute median gross-multiple per budget band from full-finance films
2. Budget-only → `imputed_gross = budget × band_median`
3. Gross-only → `imputed_budget = gross / band_median` (with band-consistency check and fallback match)

| Band | Full n | Median Raw Multiple |
|------|--------|---------------------|
| <10 Cr | 111 | 0.71× |
| 10–30 Cr | 262 | 1.00× |
| 30–60 Cr | 181 | 1.43× |
| 60–100 Cr | 94 | 1.43× |
| 100–200 Cr | 62 | 1.37× |
| 200–300 Cr | 11 | 0.96× |
| >300 Cr | 8 | 1.22× |

### Data Quality
- `financial_data_confidence` (High/Low/Missing-Partial) available as row-weighting signal (not currently wired in training)
- Pre-computed `actor_rank_score` / `director_rank_score` are black-box features from source exports — rank-imputed from tier proxy when null at train time
- 8 appeal-score columns (concept_clarity, novelty, etc.) are entirely empty in source — replaced by user sliders in evaluation UI

## 3. ML Architecture

Two models, ensemble-averaged at inference time:

### 3.1 Gradient Boosted Model (`src/lib/gbm-model.ts`)

**Implementation**: Hand-rolled GBM with trees learned via CART regression on residuals, L2 regularization, and bagging.

**Feature Vector — CANONICAL SPEC** (9-dimensional, sparse one-hot genre flags removed — Bayesian model owns genre).
This table is the single canonical feature list: it is cross-checked against `extractFeatureNames()`
by `scripts/verify-features.ts` (`npm run verify:pr3`). No other feature spec exists in this repo.

| # | Feature | Encoding | Notes |
|---|---------|---------|-------|
| 1 | `budget_scaled` | budget-index into [1, 3, 5, 10, 15, 25, 40, 60, 80, 110, 150, 200, 300] Cr, / 13 | ordinal index, not log |
| 2 | `actor_tier` | S=4, A=3, B=2, C=1, D=0 → /4 | ordinal |
| 3 | `director_tier` | same → /4 | ordinal |
| 4 | `actor_rank` | rank score / 100 (0 if null) | |
| 5 | `director_rank` | rank score / 100 (0 if null) | |
| 6 | `rank_availability` | (# non-null rank scores) / 2 | |
| 7 | `sequel_flag` | binary | |
| 8 | `month_sin` | sin(2π·month/12) | circular encoding |
| 9 | `month_cos` | cos(2π·month/12) | circular encoding |

**Leakage policy — no target encoding by construction.** Every feature is derived from the
film's own row (budget, tiers, ranks, sequel flag, month) using fixed transformations. No
feature consumes dataset aggregates, win rates, or target statistics; genre is excluded from
the GBM precisely so no per-category target encoding exists (out-of-fold encoding is therefore
not required). Walk-forward folds additionally retrain stats and models per fold on strictly
earlier years (asserted by `verify:pr1`/`verify:pr3`).

**Hyperparameters**: tuned via 3-fold time-series CV (train≤2014/test2015-2017, train≤2017/test2018-2020, train≤2020/test2021-2023):

| Param | Default | Tuned Range |
|-------|---------|-------------|
| Trees | 200 | 100–300 |
| Learning rate | 0.08 | 0.05–0.1 |
| Max depth | 4 | 3–6 |
| Subsample (bagging) | 0.8 | fixed |
| Min samples leaf | 3 | fixed |

**Seeded PRNG**: Mulberry32 (seed=42) for deterministic bagging — reproducible across runs.

### 3.2 Bayesian Model (`src/lib/bayesian-model.ts`)

**Approach**: Hierarchical shrinkage model estimating expected gross multiple as weighted average of:
- **Global prior**: overall mean multiple (≈1.0× normalized)
- **Group-level means**: by genre, actor tier, director tier, budget band, release month

**Bayesian Shrinkage**:
```
group_mean = (empirical_sum + prior_mean × prior_strength) / (n + prior_strength)
```
Where `prior_strength` is genre/tier-specific (e.g., Drama=50, Action=30). For groups with n < 10, posterior is pulled heavily toward global prior.

**Components**:
- Genre empirical mean
- Actor tier × director tier cross-mean
- Budget band mean
- Month-seasonality mean

Blended with GBM output:
```
combined = GBM × 0.6 + Bayesian × 0.4
```

### 3.3 Training

Both models are trained once at server startup (`dataset-loader.ts`) on the full dataset (679 full-finance films only — no imputed rows). Training is deterministic (seeded PRNG). Models are cached globally for the lifetime of the Node process.

## 4. Scoring Engine (`src/lib/scoring-engine.ts`)

### 4.1 Component Weights

Weights below are the implementation values (`scoring-engine.ts` `W`/`FW`) — docs follow code.

| Component | Producer Weight | Financier Weight |
|-----------|:--------------:|:----------------:|
| Genre Viability | 14% | 13% (as Genre Risk) |
| Genre-Budget Fit | 7% | 8% (as Genre-Budget Risk) |
| Budget Feasibility | 16% | 16% (as Budget Risk) |
| Talent Strength | 20% | 15% (as Talent Liquidity) |
| Pre-Sale Coverage | 12% | 20% (as Capital Recovery) |
| Production House | 5% | 4% (as Production House Risk) |
| Concept Quality | 10% | 10% (as Concept Risk) |
| Market Timing | 6% | 4% |
| Seasonality | 5% | 4% (as Seasonality Risk) |
| Production Viability | 3% | 4% (as Production Risk) |
| Market Sentiment | 2% | 2% |
| **Total** | **100%** | **100%** |

### 4.2 Scoring Method
Each component scores by expected **break-even-normalized** multiple (continuous outcome model, not binary win-rate):
```
score = min(multiple / cap, 1) × 10
```
All dataset-backed components use cap = 3.0× normalized. Normalized multiples > cap are truncated. Small samples (<10 films) are shrunk toward priors; a Bayesian posterior mean replaces the shrinkage blend when available.

### 4.3 ML Blend
The scoring-engine uses a weighted average of the evidence-based score and the ML ensemble:
```
adjustedScore = 0.6 × evidenceScore + 0.4 × mlScore
```
- `mlPrediction` = expected normalized gross multiple from ensemble (GBM×0.6 + Bayes×0.4)
- `mlScore` = mapped to 0–100 scale via `min(mlPrediction / 0.3, 100)`

### 4.4 Percentile Mapping
Scores are mapped to market percentiles via data-driven buckets computed from the training set (`src/lib/config.ts`):
```
PERCENTILE_BUCKETS = [
  [27.3, 98], [25.5, 95], [24.8, 90], [24.0, 82], [23.5, 72],
  [22.7, 60], [21.9, 48], [21.2, 38], [20.7, 28], [19.8, 18],
  [18.9, 10], [18.0, 5],
]
```

### 4.5 Verdict Thresholds
Percentile thresholds per budget band (`BASE_PCT_THRESHOLDS` in `src/lib/config.ts`; recalibrate via `npm run calibrate`):

| Band | Greenlight | Conditional |
|------|:----------:|:-----------:|
| <10 Cr | ≥50% | ≥20% |
| 10–30 Cr | ≥50% | ≥20% |
| 30–60 Cr | ≥55% | ≥25% |
| 60–100 Cr | ≥60% | ≥30% |
| 100–200 Cr | ≥65% | ≥35% |
| 200–300 Cr | ≥70% | ≥40% |
| >300 Cr | ≥75% | ≥45% |

### 4.6 Normalization ↔ Verdict Threshold Interaction

Break-even normalization and verdict thresholds act on the budget axis in **opposite directions** by design:

- **Break-even normalization** makes larger-budget films break even at *lower* raw multiples. E.g., a ₹150 Cr film needs only 1.90× raw to break even (from 55% rights coverage + 32% producer share), while a ₹15 Cr film needs 2.95×. This reflects the market reality that bigger films capture a higher fraction of pre-sale revenue.
- **Verdict thresholds** demand *higher* percentiles to greenlight larger budgets. E.g., a ₹150 Cr film needs ≥66th percentile (from current PCT_THRESHOLDS), while a ₹15 Cr film needs only ≥51st.

The rationale: the greenlight decision must embed a **margin of safety proportional to capital at risk**. A ₹150 Cr flop is more costly than a ₹15 Cr flop, so the bar should be higher. The two layers are coherent — the first adjusts for market structure, the second for risk appetite — but appear contradictory when viewed in isolation.

### 4.7 Evidence vs Input Split
- **Evidence score**: sum of dataset-backed components (genre, talent, budget, seasonality, production house)
- **Input score**: sum of user-provided components (pre-sale estimates, concept sliders, market timing)
- UI displays both scores with their percentage contribution

### 4.8 Shrinkage
Bayesian shrinkage applied when component sample size < 10:
```
shrunken = (empirical × n + prior × K) / (n + K)
```
Where K = 10 (default shrinkage strength). When a Bayesian posterior is available, it replaces the shrunken value.

## 5. Break-Even Model (`src/lib/industry-constants.ts`)

### 5.1 Era-Aware Rights Coverage
The `ESTIMATED_RIGHTS_COVERAGE` and `PA_RATIO` tables are now **era×band**, not band-only. OTT/digital rights barely existed before ~2015 and are the dominant ancillary today. Applied uniformly (2001–2025), the old table systematically understated pre-2015 break-evens, inflating the normalized target for older films.

**Eras** (keyed by `release_year`):
| Era | Range | Characteristic |
|-----|-------|----------------|
| `pre_ott` | ≤2014 | Satellite/music only (~half of mature) |
| `ott_growth` | 2015–2019 | Rising digital deals |
| `covid` | 2020–2021 | Elevated digital, thin theatrical |
| `mature` | 2022+ | Current market (2024 saw ~10% rights decline) |

**Rights coverage estimates** (fraction of budget recovered from pre-sale rights):

| Band | pre_ott | ott_growth | covid | mature |
|------|:-------:|:----------:|:-----:|:------:|
| <10 Cr | 0.08 | 0.12 | 0.15 | 0.20 |
| 10–30 Cr | 0.15 | 0.22 | 0.28 | 0.30 |
| 30–60 Cr | 0.20 | 0.32 | 0.42 | 0.40 |
| 60–100 Cr | 0.25 | 0.36 | 0.48 | 0.40 |
| 100–200 Cr | 0.30 | 0.45 | 0.58 | 0.55 |
| 200–300 Cr | 0.32 | 0.48 | 0.60 | 0.55 |
| >300 Cr | 0.35 | 0.50 | 0.62 | 0.55 |

**Example**: `estimatedBreakeven(100 Cr, 2006) = 2.84×` vs `estimatedBreakeven(100 Cr, 2024) = 1.90×`. Older films have less rights coverage → higher break-even → lower normalized multiple.

### 5.2 Inference Path
When evaluating a film (no `release_year`), `estimatedBreakeven(budget)` defaults to the `mature` era. If a user supplies an explicit `rightsCoverageFrac` (e.g., actual pre-sale deal data), it bypasses the era table entirely:
```ts
normalizedMultiple(grossMultiple, budget)              // uses mature-era estimate
normalizedMultiple(grossMultiple, budget, 2010)         // uses pre_ott-era estimate
normalizedMultiple(grossMultiple, budget, undefined, 0.45)  // uses user-supplied 45% coverage
```

### 5.3 Target Distribution
On the 729 full-finance films with era-aware break-even (current dataset):
- **Median normalized multiple**: 0.415
- **std(log(normalized)) = 1.554** — matches the calibrated `BASE_SIGMA = 1.55` (VERIFIED fixture; band-level `BAND_SIGMA` calibrated from the same residuals)
- **Class split**: 6.0% blockbuster / 5.3% hit / 8.6% break-even / 22.4% below-avg / 57.6% flop (<0.5× normalized); 80.0% of films land below 1.0× normalized

Pre-2015 films shift downward (no longer inflated by high rights assumptions), while post-2022 films remain on the mature-era baseline.

### 5.4 Pre-Sale in Scoring Engine
The Pre-Sale Coverage component (22% weight) in the scoring engine is **user-input only** — it uses actual user-provided rights estimates (`ottRightsCr`, `satelliteRightsCr`, etc.) and does NOT use the era tables. The era tables are for the ML training target and break-even normalization in dataset stats. The inference path for the scoring engine's break-even normalization uses the mature-era defaults when no year is known.

## 6. Evaluation

Numbers below are generated by `npm run benchmark` (walk-forward) and `npm run benchmark:75-25`
(appendix), and stored in `src/generated/benchmark-results.json` / `benchmark-75-25.json`.
Buyer-facing surfaces carry no performance figures (positioning policy); the fixtures and this
section are the engineering record.

Backtest inputs use neutral concept scores (clarity 6, novelty 5) for every film — the CSV
contains no content scores, and deriving sliders from verdicts leaked test outcomes into test
inputs. The walk-forward therefore measures the data-driven core only; production evaluations
add real user concept + pre-sale inputs whose variance is unobservable in backtests.

### 6.1 Forward-Chaining Walk-Forward (Primary Benchmark)
Train on <Y, test on Y, rolling 2010–2025. Uses **full engine** (ML blend + Bayesian + scoring components). This is the headline metric.

| Metric | Value [95% CI] |
|--------|---------------|
| Accuracy | 29.3% [26.0%, 32.9%] |
| Greenlight Precision | 11.3% [6.8%, 18.1%] |
| Greenlight Recall | 18.7% [11.5%, 28.9%] |
| F1 Score | 14.1% [7.9%, 20.1%] |
| Greenlight Calls | 124/658 (14 hits of 75 total) |
| Total Films | 658 (14 folds) |

Naive baselines (same folds, same scoring rule):
| Baseline | Value |
|----------|-------|
| Always-flop accuracy | 80.5% |
| Band-median-multiple accuracy | 63.7% |
| GBM RMSE (normalized multiple) | 1.303 vs band-median RMSE 1.230 |
| Train hit-rate prevalence | 11.0% |

Reading the results honestly:
- Precision (11.9%) sits at the 11% base rate: on data-driven signal alone the engine barely ranks hits above flops. The pre-fix 21.8% was inflated by perfect-foresight concept sliders.
- The threshold sweep (−15…+20) proves precision is flat (~9–14%) at every operating point — no threshold manufactures precision. Base `BASE_PCT_THRESHOLDS` are retained: with precision flat, thresholds only trade accuracy against recall, and base preserves the most recall (33.3%).
- Rejected without effect or on principle: confidence sample-weights (all 729 trainable films are High confidence — zero variance), isotonic calibration (flat discrimination maps everything to the base rate; percentile-rank framing is already honest), blend reweighting (do-not-reargue item), per-band tuning (overfit risk).

**Year-by-year detail** (from the regenerated fixture; early/thin and regime-break folds are noisy):
| Year | n | Acc | Prec | Rec | F1 | GL calls(hits) |
|------|---|:---:|:----:|:---:|:--:|:--------------:|
| 2012 | 40 | 50.0% | 0.0% | 0.0% | 0.0% | 0(0) |
| 2013 | 43 | 41.9% | 25.0% | 20.0% | 22.2% | 4(1) |
| 2014 | 52 | 36.5% | 33.3% | 25.0% | 28.6% | 3(1) |
| 2015 | 49 | 36.7% | 0.0% | 0.0% | 0.0% | 2(0) |
| 2016 | 68 | 26.5% | 0.0% | 0.0% | 0.0% | 3(0) |
| 2017 | 74 | 37.8% | 22.2% | 28.6% | 25.0% | 9(2) |
| 2018 | 75 | 22.7% | 8.3% | 10.0% | 9.1% | 12(1) |
| 2019 | 68 | 22.1% | 18.2% | 22.2% | 20.0% | 11(2) |
| 2020 | 33 | 27.3% | 0.0% | 0.0% | 0.0% | 10(0) |
| 2021 | 22 | 22.7% | 0.0% | 0.0% | 0.0% | 8(0) |
| 2022 | 32 | 6.3% | 0.0% | 0.0% | 0.0% | 18(0) |
| 2023 | 33 | 27.3% | 25.0% | 25.0% | 25.0% | 8(2) |
| 2024 | 32 | 15.6% | 12.5% | 50.0% | 20.0% | 16(2) |
| 2025 | 37 | 27.0% | 15.0% | 60.0% | 24.0% | 20(3) |

### 6.2 75-25 Random Split (Appendix — NOT a Headline)
Reference only. Random splitting leaks future films into training.

| Metric | Value |
|--------|-------|
| Accuracy | 30.1% [23.9%, 37.1%] |
| Greenlight Precision | 23.5% [12.4%, 40.0%] |
| Greenlight Recall | 42.1% [23.1%, 63.7%] |
| F1 Score | 30.2% |
| Test n | 183 |

### 6.3 Confidence Intervals
All proportion-based metrics (accuracy, precision, recall) use **Wilson score intervals** with z=1.96. F1 uses **seeded bootstrap** (Mulberry32, seed 42, 1000 resamples, α=0.05). Implemented in `src/lib/confidence-interval.ts`.

## 7. Key Assumptions & Limitations

1. **Survivorship bias**: Dataset only includes films with reported budget+gross (729/2454). These skew toward higher-budget, better-tracked releases. Era-aware break-even normalization partially mitigates this but does not eliminate it.

2. **Pre-sale estimation (training)**: The break-even normalization for training uses era-estimated rights coverage with no actual deal data. The scoring engine's Pre-Sale Coverage component (12% weight) is user-input only.

3. **Empty content scores**: All 8 appeal-score columns (concept_clarity, novelty, etc.) are empty. User sliders in evaluation UI are the only source.

4. **Tier system**: `actor_tier_proxy` and `director_tier_proxy` are pre-computed black boxes with undocumented methodology.

5. **Imputation for stats only**: 236 imputed rows are used for dataset stats (genre/tier/band averages) but excluded from ML training (target would be deterministic).

6. **Small high-budget sample**: Only 8 films >300 Cr with full finance. Statistical confidence is low for this band.

7. **Time drift**: Models train on 2001–2025 data but deploy on future films. Market dynamics (OTT rise, COVID recovery, star-power decline) are partially captured by era-aware break-even but not by the model itself.

8. **No log-space GBM target**: The GBM is fit on raw normalized multiple, not log(normalized). This makes it sensitive to outliers. Fitting in log-space was tried and reverted (walk-forward accuracy dropped) — raw-space retained.

## 8. Files

| File | Purpose |
|------|---------|
| `src/lib/csv-parser.ts` | Parse CSV into `BollywoodFilm[]` (handles quoted commas in all fields) |
| `src/lib/impute-finance.ts` | Budget-band median multiple imputation, tags rows `is_imputed_finance` |
| `src/lib/dataset-stats.ts` | Compute genre/tier/budget stats with era-aware normalized multiples |
| `src/lib/ml-predictor.ts` | Orchestrates GBM + Bayes training (imputed rows excluded) and prediction |
| `src/lib/gbm-model.ts` | Hand-rolled GBM, 9-dim feature vector, time-series CV tuning |
| `src/lib/bayesian-model.ts` | Hierarchical shrinkage for group-level means |
| `src/lib/scoring-engine.ts` | 10-component scoring, ML blend, percentile thresholds |
| `src/lib/industry-constants.ts` | Era×band rights coverage, break-even normalization, sigma calibration |
| `src/lib/confidence-interval.ts` | Wilson CI + seeded bootstrap CI |
| `src/lib/validate-input.ts` | Backend input validation and data quality warnings |
| `scripts/evaluate-forward-chaining.ts` | **Primary** full-engine walk-forward evaluation |
| `scripts/evaluate-75-25.ts` | Secondary in-distribution upper-bound evaluation |
| `scripts/calibrate-thresholds.ts` | OOS threshold calibration (time-series split) |
| `src/lib/backtest.cjs` | Legacy standalone walk-forward (simplified scoring) |
| `src/data/bollywood_input.csv` | Cleaned 19-column input data |
| `src/data/bollywood_input_COLUMNS.md` | Column reference |
