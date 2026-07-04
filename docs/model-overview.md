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
- 2,209 Bollywood films (2001–2025) from IMDB, BollywoodMovieDetail, and Bollywood Movies Dataset exports
- Cleaned to 19 columns: identifiers, release metadata, genre flags, cast/crew ranks, budget/gross, verdict
- **All 2,209 rows parse correctly** (no dropped rows — fixed quoting in CSV generation)

### Financial Subset
- **679 films** have both budget AND gross (>0) — the full-finance core for ML training
- **59 budget-only** + **64 gross-only** = **105 imputed** via budget-band median multiples at load time (used for stats/UI only)
- **Imputed rows are excluded from ML training** (tagged `is_imputed_finance: true`) — their targets are deterministic (band median), so training on them would just learn the band median and inflate metrics

### Imputation Strategy (`src/lib/impute-finance.ts`)
Budget-band median multiple imputation:
1. Compute median gross-multiple per budget band from full-finance films
2. Budget-only → `imputed_gross = budget × band_median`
3. Gross-only → `imputed_budget = gross / band_median` (with band-consistency check)

| Band | Full n | Median Multiple |
|------|--------|-----------------|
| <10 Cr | 74 | 0.26× |
| 10–30 Cr | 179 | 0.54× |
| 30–60 Cr | 134 | 1.33× |
| 60–100 Cr | 81 | 2.01× |
| 100–200 Cr | 120 | 2.83× |
| 200–300 Cr | 85 | 3.38× |
| >300 Cr | 6 | 3.01× |

### Data Quality
- `financial_data_confidence` (High/Low/Missing-Partial) available as row-weighting signal (not currently wired in training)
- Pre-computed `actor_rank_score` / `director_rank_score` are black-box features from source exports — rank-imputed from tier proxy when null at train time
- 8 appeal-score columns (concept_clarity, novelty, etc.) are entirely empty in source — replaced by user sliders in evaluation UI

## 3. ML Architecture

Two models, ensemble-averaged at inference time:

### 3.1 Gradient Boosted Model (`src/lib/gbm-model.ts`)

**Implementation**: Hand-rolled GBM with trees learned via CART regression on residuals, L2 regularization, and bagging.

**Feature Vector** (9-dimensional, sparse one-hot genre flags removed — Bayesian model owns genre):
1. `budget_scaled` — log-index into [1, 3, 5, 10, 15, 25, 40, 60, 80, 110, 150, 200, 300] Cr
2. `actor_tier` — S/A/B/C/D → 0–1
3. `director_tier` — S/A/B/C/D → 0–1
4. `actor_rank` — normalized actor rank score (0–1), imputed from tier when null
5. `director_rank` — normalized director rank score (0–1), imputed from tier when null
6. `rank_availability` — how many of the two rank scores are non-null (0, 0.5, 1.0)
7. `sequel_flag` — binary
8. `month_sin` — circular encoding of release month
9. `month_cos` — circular encoding of release month

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

| Component | Producer Weight | Financier Weight |
|-----------|:--------------:|:----------------:|
| Genre Viability | 12% | 11% |
| Genre-Budget Fit | 6% | 7% |
| Budget Feasibility | 14% | 14% |
| Talent Strength | 17% | 13% |
| Pre-Sale Coverage | 22% | 24% |
| Production House | 4% | 4% |
| Concept Quality | 10% | 10% |
| Market Timing | 8% | 7% |
| Seasonality | 3% | 4% |
| Production Viability | 4% | 6% |

### 4.2 Scoring Method
Each component scores by expected gross multiple (continuous outcome model, not binary win-rate):
```
score = min(multiple / cap, 1) × 10
```
Caps vary by component (genre=3.0×, budget=3.0×, talent=3.0×). Normalized multiples > cap are truncated.

### 4.3 ML Blend
The scoring-engine uses a weighted average of the evidence-based score and the ML ensemble:
```
adjustedScore = 0.6 × evidenceScore + 0.4 × mlScore
```
- `mlPrediction` = expected normalized gross multiple from ensemble (GBM×0.6 + Bayes×0.4)
- `mlScore` = mapped to 0–100 scale via `min(mlPrediction / 0.3, 100)`

### 4.4 Percentile Mapping
Scores are mapped to market percentiles via data-driven buckets computed from the training set:
```
PERCENTILE_BUCKETS = [
  [38.3, 98], [36.4, 95], [35.4, 90], [33.9, 82], [31.7, 72],
  [28.5, 60], [26.8, 48], [25.6, 38], [24.7, 28], [24.3, 18],
  [23.8, 10], [23.7, 5],
]
```

### 4.5 Verdict Thresholds
Percentile thresholds per budget band (tuned via grid search on 75-25 split):

| Band | Greenlight | Conditional |
|------|:----------:|:-----------:|
| <10 Cr | ≥51% | ≥21% |
| 10–30 Cr | ≥51% | ≥21% |
| 30–60 Cr | ≥56% | ≥26% |
| 60–100 Cr | ≥61% | ≥31% |
| 100–200 Cr | ≥66% | ≥36% |
| 200–300 Cr | ≥71% | ≥41% |
| >300 Cr | ≥76% | ≥46% |

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
On the 679 full-finance films with era-aware break-even:
- **Median normalized multiple**: 0.567
- **std(log(normalized))**: 1.536 (matches `BASE_SIGMA = 1.55`)
- **Class split**: 13% blockbuster / 8% hit / 13% break-even / 21% below-avg / 47% flop

Pre-2015 films shift downward (no longer inflated by high rights assumptions), while post-2022 films remain on the mature-era baseline.

### 5.4 Pre-Sale in Scoring Engine
The Pre-Sale Coverage component (22% weight) in the scoring engine is **user-input only** — it uses actual user-provided rights estimates (`ottRightsCr`, `satelliteRightsCr`, etc.) and does NOT use the era tables. The era tables are for the ML training target and break-even normalization in dataset stats. The inference path for the scoring engine's break-even normalization uses the mature-era defaults when no year is known.

## 6. Evaluation

### 6.1 Forward-Chaining Walk-Forward (Primary Benchmark)
Train on ≤Y, test on Y+1, rolling from 2010–2025. Uses **full engine** (ML blend + Bayesian + scoring components). This is the headline metric — it reflects realistic generalization to unseen future years.

| Metric | Value [95% CI] |
|--------|---------------|
| Accuracy | 39.4% [35.6%, 43.3%] |
| Greenlight Precision | 28.7% [22.8%, 35.4%] |
| Greenlight Recall | 48.3% |
| F1 Score | 36.0% |
| Always-Flop Baseline | 67.2% |
| Total Films | 619 (12 folds) |

**Year-by-year detail:**
| Year | n | Acc | Prec | Rec | F1 | GL calls(hits) |
|------|---|:---:|:----:|:---:|:--:|:--------------:|
| 2014 | 14 | 50.0% | 46.2% | 100% | 63.2% | 13(6) |
| 2015 | 76 | 13.2% | 8.7% | 85.7% | 15.8% | 69(6) |
| 2016 | 88 | 22.7% | 8.0% | 25.0% | 12.1% | 25(2) |
| 2017 | 103 | 43.7% | 20.0% | 20.0% | 20.0% | 10(2) |
| 2018 | 97 | 48.5% | 36.4% | 28.6% | 32.0% | 11(4) |
| 2019 | 85 | 50.6% | 83.3% | 35.7% | 50.0% | 6(5) |
| 2020 | 50 | 54.0% | 50.0% | 33.3% | 40.0% | 6(3) |
| 2021 | 39 | 38.5% | 33.3% | 30.0% | 31.6% | 9(3) |
| 2022 | 19 | 63.2% | 70.0% | 70.0% | 70.0% | 10(7) |
| 2023 | 17 | 35.3% | 42.9% | 66.7% | 52.2% | 14(6) |
| 2024 | 16 | 25.0% | 50.0% | 40.0% | 44.4% | 8(4) |
| 2025 | 15 | 53.3% | 57.1% | 88.9% | 69.6% | 14(8) |

### 6.2 75-25 Random Split (Secondary — In-Distribution Upper Bound)
For reference only. Random splitting leaks future data into training, inflating metrics. This is the upper bound achievable in an in-distribution setting.

| Metric | Value |
|--------|-------|
| Accuracy | 67.9% |
| Greenlight Precision | 57.7% |
| Greenlight Recall | 71.4% |
| F1 Score | 63.8% |
| Test n | 196 |

### 6.3 Confidence Intervals
All proportion-based metrics (accuracy, precision, recall) use **Wilson score intervals** with z=1.96. Continuous metrics (Spearman rank correlation, Brier score) use **seeded bootstrap** (Mulberry32, 1000 resamples, α=0.05). Implemented in `src/lib/confidence-interval.ts`.

## 7. Key Assumptions & Limitations

1. **Survivorship bias**: Dataset only includes films with reported budget+gross (679/2209). These skew toward higher-budget, better-tracked releases. Era-aware break-even normalization partially mitigates this but does not eliminate it.

2. **Pre-sale estimation (training)**: The break-even normalization for training uses era-estimated rights coverage with no actual deal data. The scoring engine's Pre-Sale Coverage component (22% weight) is user-input only.

3. **Empty content scores**: All 8 appeal-score columns (concept_clarity, novelty, etc.) are empty. User sliders in evaluation UI are the only source.

4. **Tier system**: `actor_tier_proxy` and `director_tier_proxy` are pre-computed black boxes with undocumented methodology.

5. **Imputation for stats only**: 105 imputed rows are used for dataset stats (genre/tier/band averages) but excluded from ML training (target would be deterministic).

6. **Small high-budget sample**: Only 6 films >300 Cr with full finance. Statistical confidence is low for this band.

7. **Time drift**: Models train on 2001–2025 data but deploy on future films. Market dynamics (OTT rise, COVID recovery, star-power decline) are partially captured by era-aware break-even but not by the model itself.

8. **No log-space GBM target**: The GBM is fit on raw normalized multiple, not log(normalized). This makes it sensitive to outliers. Fitting in log-space could improve Spearman/Brier but is deferred.

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
