# FilmRisk Bollywood — Data Science Review

> **⚠ HISTORICAL DOCUMENT — SUPERSEDED.** This review audits the system as it existed in
> **May 2026 (v0)**, before the continuous-model rewrite, era-aware break-even, and honest
> walk-forward benchmark landed (commits `c9a8da7`, `0b2f189`, `8e0ec54`). It is preserved as
> the engineering audit trail. **Do not cite it for current behavior** — the canonical
> references are `docs/model-overview.md`, `docs/anchored-summary.md`, `docs/era-constants-sources.md`,
> and the generated benchmark fixture (`src/generated/benchmark-results.json`).
>
> Corrections (v0 claim → current reality, verified against code/data):
>
> | # | This document says | Current implementation (verified) |
> |---|---|---|
> | 1 | 23-dimensional feature vector (16 genre one-hots) | **9-dim** canonical vector; genre deliberately excluded from GBM (Bayesian model owns genre) — `gbm-model.ts:extractFeatures` |
> | 2 | `SURVIVORSHIP_ADJ = 1/2.72 = 0.37` applied to scores | Removed. Replaced by **era-aware break-even normalization** of the target (`industry-constants.ts`); scores are not discounted post-hoc |
> | 3 | GBM trained on raw `gross_multiple`, 150-tree override | GBM trained on **break-even-normalized multiple**, 200 trees (CV-tuned over 100–300), seeded PRNG |
> | 4 | Old percentile buckets `[47,98]…[3,5]` | `config.ts:PERCENTILE_BUCKETS` `[27.3,98]…[18.0,5]` (recomputed from training data) |
> | 5 | Monte Carlo `baseSigma = 0.6` | `BASE_SIGMA = 1.55` + band-calibrated `BAND_SIGMA` (verified: std(log(normalized)) = 1.554 on training data) |
> | 6 | `>200 Cr` band catch-all concern | Resolved: bands split into `200-300` and `>300` |
> | 7 | No CV for GBM hyperparameters | 3-fold time-series CV implemented (`crossValidateGBM`) |
> | 8 | OOS "93.3% precision" on n=30 (§6.6) | **Retired as a headline figure.** Walk-forward is the primary benchmark; 93.3% came from a small, partially in-sample run and is not quoted anywhere buyer-facing |
> | 9 | 2,209 rows / 679 full-finance / 105 imputed | Current dataset: **2,454 rows / 729 full-finance / 236 imputed** (excluded from training, `npm run verify:pr1`) |
> | 10 | Bayesian model "not directly used in any scoring path" | Reinstituted: Bayes posteriors feed small-sample shrinkage in scoring components (`scoring-engine.ts:shrunkenMultiple`, `bayesianComponentScore`) |
>
> Acceptance-tested by `npm run verify:pr3` (feature-vector canonicalization).

## 1. System Architecture

```
User Input (EvaluationInput)
       │
       ▼
POST /api/evaluate
       │
       ▼
loadDataset() ──────► CSV file → BollywoodFilm[] + computeDatasetStats()
       │                             │
       ▼                             ▼
trainModels(films)           DatasetStats
(GBM + Bayesian)                 │
       │                          │
       ▼                          ▼
predictMultiple(input, stats)   calculateGreenlightScore(input, stats)
       │                          │
       └───── ML blend ──────────┘
                                      │
                                      ▼
                               GreenlightScoreResult
                                      +
                               FinancierRiskResult
                               FinancialProjection
                               ComparableFilms
                               ...
```

The API route (`/api/evaluate`) is the single entry point. On each request:
1. `loadDataset()` parses the CSV and computes `DatasetStats`
2. `trainModels()` re-trains the GBM + Bayesian models from scratch
3. All scoring functions run synchronously

**Key observation**: Models are re-trained on every API call. This is fine for ~700-film dataset with a small GBM (150 trees). Consider caching if latency becomes an issue.

---

## 2. Data Inputs

### 2.1 Source Dataset (CSV)
- **2209 rows** of Bollywood films, but only **679 have both budget and gross** data
- Columns: budget_cr, worldwide_gross_cr, gross_multiple, actor_tier_proxy (S/A/B/C/D), director_tier_proxy, actor_rank_score (1-100), director_rank_score, primary_genre, production_house, release_month_num, etc.
- **Survivorship bias**: Median `gross_multiple = 2.72×`. Real market average ≈ 1.0×. The dataset systematically over-represents successful films.
- All 8 content-score columns are completely empty (conceptClarity, novelty are user-input sliders only)

### 2.2 Feature Engineering (`gbm-model.ts:126-157`)

For each film, `extractFeatures()` produces a 23-dimensional vector:

```
Index  Feature               Encoding
──────────────────────────────────────────────────
0      budget_scaled         BudgetIndex / 13  (13 discrete buckets)
1      actor_tier            tierNum(s) / 4    (S=4, A=3, B=2, C=1, D=0)
2      director_tier         same as above
3      actor_rank            rank_score / 100  (or 0 if null)
4      director_rank         same
5      rank_availability     (hasActorRank + hasDirRank) / 2
6      release_month         month / 12
7-22   genre_onehot          16 genre indicators
```

**Issues to note**:
- `actor_rank_score` and `director_rank_score` are null for the vast majority of films (~90%). The model essentially sees rank_availability=0 and rank=0 for most training examples.
- Genre one-hot with 16 categories is sparse; many genres have <10 films.
- Release month is treated as a continuous feature (month/12), which assumes linearity across months. In reality Jan-Dec is circular.

### 2.3 User EvaluationInput (`types.ts:28-52`)

```
Field                  Type         Source
────────────────────────────────────────────────────
primaryGenre           string       Dropdown (16 options)
directorTier           string       User selects S/A/B/C/D
actorTier              string       Same
totalBudgetCr          number       User input
productionBudgetCr     number       User input
contingencyPercent     number       User input (5-15% ideal)
marketTiming           'strong'│'neutral'│'weak'   User
releaseMonth           1-12        User
ottRightsCr            number      User input (pre-sale)
satelliteRightsCr      number      Same
musicRightsCr          number      Same
overseasRightsCr       number      Same
brandRevenueCr         number      Same
conceptClarity         0-10        User slider
novelty                0-10        User slider
theatricalSharePercent number      User input (~35-50%)
financingCostCr        number      User input
```

---

## 3. Dataset Statistics Pipeline (`dataset-stats.ts`)

### 3.1 Temporal Weighting

```typescript
function temporalWeight(year: number): number {
  if (year <= 2015) return 1.0
  if (year >= 2025) return 3.0
  return 1.0 + (year - 2015) * 0.2  // linear ramp
}
```

Recent films (2025+) receive 3× the weight of pre-2015 films in all stat computations. This is a reasonable recency-weighting scheme.

### 3.2 Bayesian Win-Rate Adjustment

```typescript
function bayesianWR(wins, total, prior=0.30, strength=6):
  return (wins + 0.30 * 6) / (total + 6)
```

Standard Beta-binomial shrinkage toward 30% base rate. Prior strength of 6 means a category needs ~6 observations before its observed WR dominates the prior. Applied to genre, tier, budget-band, month, and production-house win rates.

### 3.3 Computed DatasetStats (`dataset-stats.ts:56-66`)

| Stat Group | Fields | Purpose |
|---|---|---|
| `genreStats` | avgMultiple, count, winRatePct, trajectory | Genre viability scoring |
| `actorTierStats` | avgMultiple, avgRankScore, min/max rank | Talent strength |
| `directorTierStats` | Same as above | Same |
| `comboStats` | Director+Actor combo avg | Talent synergy |
| `budgetBandStats` | avgMultiple per band | Budget feasibility |
| `genreBudgetStats` | Genre × Budget interaction | Genre-Budget fit |
| `monthStats` | avgMultiple per month | Seasonality |
| `productionHouseStats` | avgMultiple per house | Production house reputation |
| `grossMultiplePercentiles` | p10-p90 | Reference distribution |

---

## 4. Scoring Engine

### 4.1 Transition: Win-Rate Model → Continuous Outcome Model

**Previously**: Each component scored by win-rate (proportion of films achieving ≥1.5× multiple). This was a binary outcome model — treating all above-threshold films as "successes" regardless of degree.

**Now**: Each dataset-derived component scores by expected `gross_multiple`:

```typescript
function multScore(mult: number, cap = 4.0): number {
  return Math.min(mult / cap, 1) * 10
}
```

A film with `avgMultiple = 2.0×` against cap 4.0 scores `2.0/4.0 * 10 = 5.0/10`. This is more informative than a binary win-rate, but the choice of cap is critical:
- Genre, Talent, Production House: cap = 4.0×
- Budget, Seasonality: cap = 3.5×

The caps represent the multiple where a component maxes out at 10/10. These values should be validated against real-world distributions.

### 4.2 Component Weights

**Greenlight Score (producer perspective):**

| Component | Weight | Source |
|---|---|---|
| Pre-Sale Coverage | 21% | User input only |
| Talent Strength | 16.5% | Dataset + user tier |
| Budget Feasibility | 13.5% | Dataset |
| Genre Viability | 11.5% | Dataset |
| Concept Quality | 9.5% | User input only |
| Market Timing | 7.5% | User input only |
| Genre-Budget Fit | 5.5% | Dataset |
| Production Viability | 4% | User input only |
| Production House | 4% | Dataset |
| Seasonality | 3% | Dataset |
| Market Sentiment | 5% | External news feed (optional) |
| **Total** | **100%** | |

**Financier Risk Score (investor perspective):**

Similar 11 components with different weights (e.g., Capital Recovery 23%, Genre Risk 10.5%, Budget Risk 13.5%). Inverted: low → risky.

### 4.3 Scoring Logic (Greenlight)

For each component `c`:
```
score = multScore(stat.avgMultiple, cap)   // dataset-driven
     OR user_slider_value / 10             // user-driven
contribution = score * weight
```

Then:
```
raw = Σ contributions
totalScore = round(raw * 100) / 10   // scale to 0-100

datasetContrib = Σ dataset_derived contributions
userContrib = Σ user_input contributions
adjustedRaw = datasetContrib * SURVIVORSHIP_ADJ + userContrib
adjustedScore = round(adjustedRaw * 100) / 10
```

### 4.4 ML Blend

If GBM is trained (≥50 films available):
```
mlRaw = gbm.predict(input features)
mlScore = min(mlRaw / 0.04 * SURVIVORSHIP_ADJ, 100)
adjustedScore = adjustedScore * 0.6 + mlScore * 0.4
```

The `0.04` divisor converts a predicted multiple (e.g., 2.72×) into a score scale that maps to 0-100: `2.72 / 0.04 = 68` (before survivorship adjustment). This is an arbitrary scaling choice.

**Blend ratio**: 60% structured-score / 40% ML prediction. The ML model gets less weight because:
- GBM trains on ~650 films with 23 features (high-dimensional relative to sample size)
- Actor/director rank scores are null for most training samples
- The structured score has domain-specific caps and adjustments that GBM doesn't learn

---

## 5. Survivorship Bias Correction

### 5.1 Underlying Assumption

Dataset median `gross_multiple = 2.72×`. Real market average ≈ 1.0×. Correction:

```
SURVIVORSHIP_ADJ = 1.0 / 2.72 = 0.368
```

This assumes the dataset is representative of the upper 1/2.72 ≈ 37% of the market, and that films in the dataset are 2.72× more successful on average than the real market.

### 5.2 Where Adjustment Is Applied

1. **Component scores**: `adjustedRaw = datasetContrib × 0.37 + userContrib`
   - Only dataset-derived contributions are discounted. User-input components (pre-sales, concept quality, market timing) pass through at full weight.
   - This is correct: user-input data has no survivorship bias.

2. **ML prediction**: `mlScore = min(gbm_output / 0.04 × 0.37, 100)`
   - GBM is trained on the biased dataset, so its predictions are also discounted.

3. **Monte Carlo simulation**: `mcMean = baseMultiple × talentMultBoost × 0.37`
   - The base multiple (genre avg or dataset p50) is discounted before the lognormal draw.

**Potential concern**: The 1.0/2.72 factor is a point estimate. In reality, the bias ratio varies by budget band (low-budget films are underrepresented more than high-budget). Consider a band-specific adjustment.

---

## 6. GBM Model (`gbm-model.ts`)

### 6.1 Architecture

- **Type**: Gradient Boosted Regression Tree (CART-based)
- **Training data**: 679 films with budget+gross (filtered to ~600+ after removing nulls)
- **Target**: `gross_multiple` (continuous, positive)
- **Default params**: 200 estimators, maxDepth=4, learningRate=0.08, subsample=0.8, minSamplesLeaf=3
- **Current override** (in `trainModels`): 150 estimators, maxDepth=4, learningRate=0.08

### 6.2 Training Algorithm

```
1. Feature normalization: z-score (fit on training data)
2. basePrediction = mean(y)
3. residuals = y - basePrediction
4. For each tree (n=150):
   a. Subsample 80% of data without replacement
   b. Build CART tree predicting current residuals
   c. Update residuals: y -= learningRate * tree.predict(X)
```

### 6.3 Tree Building (`buildTree`)

Standard recursive binary split:

```
bestSplit(X, y, indices, minLeaf):
  For each feature f:
    Sort (X[i][f], y[i]) pairs
    Scan all split points, tracking incremental variance
    Choose split maximizing variance reduction

  Stop conditions:
    - depth >= maxDepth
    - n <= minSamplesLeaf
    - No split improves variance
```

**Complexity**: O(n_features × n × log n) per split due to sorting. The incremental left/right sum tracking makes scanning O(n) per feature.

**Important detail**: Split uses variance reduction (Friedman's MSE criterion), not absolute error. This makes the model sensitive to outliers in `gross_multiple` (which has extreme values like 15×, 20×).

### 6.4 Prediction

Standard ensemble: base + learningRate × Σ tree predictions. Clipped at 0.01 to prevent negative multiples.

### 6.5 Feature Space (23 dimensions)

In training, rank scores are 0 for ~90% of films. At inference time, `predictMultiple` now uses:
1. Tier-average rank score from `DatasetStats` if available (e.g., S-tier avg rank = 95)
2. Hardcoded fallback if stats not passed (S→95, A→80, B→55, C→30, D→10)

This means the model may see rank=0 at training but rank≈55 (B-tier avg) at inference for most predictions — a distribution mismatch. However, the rank features are low-importance because they're null for most training examples, so the practical impact is limited.

### 6.6 Validation Results

**OOS performance** (2023-2025, n=30, continuous model):

| Metric | Value |
|---|---|
| Greenlight Precision | 93.3% |
| Greenlight Recall | 51.9% |
| False Positive Rate | 6.7% |
| Accuracy | 43.3% |

**Walk-forward validation** (15 rolling windows 2010-2025):
- Average accuracy: 18.4% (range 0%–43.8%)
- Small per-year test sets (8-23 films) make this diagnostic, not definitive

**Caveats**:
- n=30 OOS is small. Precision could easily be 80-100% with 95% CI.
- The 43.3% "accuracy" doesn't capture the scoring system's continuous nature — verdict thresholds are calibrated to ~P75 greenlight, so 75% of films should be "don't invest" by design. A threshold-aware metric (precision/recall) is more appropriate.
- Walk-forward accuracy is misleading because most films in any year are not greenlight-quality — a "never greenlight" strategy would have high accuracy.

---

## 7. Bayesian Missing-Data Model (`bayesian-model.ts`)

### 7.1 Purpose

Empirical Bayes shrinkage for small-sample categories. Provides:
- Shrunken mean estimates for genres/tiers/budget-bands with few observations
- Credible intervals for uncertainty communication
- Missing-data fraction tracking (80% of films lack financial data)

### 7.2 Algorithm

```
1. Compute global prior from all available multiples:
   prior = { mean: ȳ, variance: s², strength: n }

2. For each category (genre, actor tier, etc.):
   posterior.mean = (prior.strength × prior.mean + n_cat × ȳ_cat) /
                    (prior.strength + n_cat)
   posterior.shrinkage = prior.strength / (prior.strength + n_cat)
```

This is standard conjugate normal-normal EB. Shrinkage of 100% means the category mean is fully pulled to the global mean (no signal). 0% means no shrinkage (large sample).

### 7.3 Mismatch with Scoring Engine

The Bayesian posteriors are computed and stored (`trainedBayes`) but are **not directly used** in any scoring or prediction path. The scoring engine uses `DatasetStats` (frequentist weighted averages) instead of the Bayesian shrunken estimates.

The Bayesian model is available for:
- Display in narrative summary (`over ${filmCount}+ films with Bayesian shrinkage`)
- Possible future replacement of `DatasetStats` with shrunken estimates for small-sample components

This is a partially-implemented feature. The `bayesianComponentScore()` function exists but was dead code (removed in May 2026 cleanup).

---

## 8. Percentile Mapping & Verdict System

### 8.1 Real-Market Percentiles

The `adjustedScore` (0-100) is mapped to a real-market percentile:

```typescript
PERCENTILE_BUCKETS = [
  [47, 98], [35, 95], [27, 90], [22, 80], [18, 68],
  [15, 58], [12, 50], [10, 42], [8, 32], [6, 22],
  [4, 12], [3, 5],
]
```

**Calibration rationale** (approximate):
- Real market median film (1.0× multiple) → adjustedScore ≈ 12 → P50
- Dataset-median film (2.72× multiple) → adjustedScore ≈ 27 → P90
- Blockbuster (6×+) → adjustedScore ≈ 47 → P98

The mapping was calibrated by extrapolating from known dataset characteristics. It has not been validated against actual market-wide gross distributions (which would require Box Office Mojo or similar data).

### 8.2 Verdict Thresholds Per Budget Band

```
Band         Greenlight (P+)    Conditional (P+)
─────────────────────────────────────────────
<10 Cr           50                 20
10-30 Cr         50                 20
30-60 Cr         55                 25
60-100 Cr        60                 30
100-200 Cr       65                 35
>200 Cr          70                 40
```

Higher-budget films need higher percentiles to greenlight. This reflects:
- Higher budgets have more downside risk (Hard to break even at ₹200Cr+)
- Dataset has fewer high-budget films, so estimates are less certain

**Concern**: The `>200` band is a catch-all for 200Cr to 400Cr+ films. A 200Cr film may have very different dynamics than a 400Cr film. Consider splitting into `200-300` and `>300` if data allows.

### 8.3 Confidence Framework

- **High**: ≥4 of 4 key fields filled (genre, logline, director, lead actor) + both budget fields > 0
- **Medium**: ≥2 of 4 key fields filled
- **Low**: < 2 fields filled

Confidence interval computed from average component sample size:
```
se = 10 / √(avg_sample_size)
CI = ±1.96 × se
```

---

## 9. Monte Carlo Financial Simulation (`financial-simulator.ts`)

### 9.1 Parameters

| Parameter | Value | Source |
|---|---|---|
| Simulations | 10,000 | Fixed |
| Base sigma | 0.6 | Fixed (tunable) |
| Distribution | Lognormal | Box-Muller transform |
| Base multiple | genreAvg ∥ bandAvg ∥ p50 | Dataset statistics |
| Talent boost | combo ratio or weighted actor/director | Dataset stats |
| Survivorship adj | × 0.37 | Applied to mcMean |

### 9.2 Algorithm

```
mcMean = baseMultiple × talentBoost × 0.37
sigma  = 0.6 × √(10 / avg_sample_size)

For 10,000 draws:
  mult ← logNormal(mcMean, sigma)
  gross = budget × mult
  net = gross × theatricalShare + rights - totalCost

Result: sorted net outcomes, percentiles, probProfit
```

### 9.3 Key Modeling Decisions

1. **Lognormal with heteroskedastic sigma**: Sigma decreases with sample size (more data = narrower distribution). This is reasonable but `baseSigma = 0.6` should be validated against real residuals.

2. **Right-skew preserved**: Lognormal captures the fat right tail of box office (occasional 10×+ hits).

3. **Survivorship adjustment applied to mean**: `mcMean = base × boost × 0.37`. This shifts the entire distribution downward, not just the center. The shape (sigma) is unchanged.

4. **Talent boost as ratio to dataset p50**: `talent_multiple_boost = combo.avgMultiple / datasetP50`. A director+actor combo averaging 3.5× produces a boost of 3.5/2.72 = 1.29. This is a multiplicative effect.

---

## 10. Known Data Quality Issues

### Severe
- **Dataset survivorship bias**: Only 679/2209 films have financial data; median 2.72× vs real ~1.0×
- **8 content score columns are 100% empty**: conceptClarity, novelty, etc. cannot be validated
- **Synthetic "Movie_XXXX_XXX" rows** in 2010+ data: inflate counts, add noise to stats
- **No pre-sale rights data in CSV**: All pre-sale analysis is user-input only, not back-testable
- **Tier system is a black box**: actor_tier_proxy, director_tier_proxy are pre-computed externally, methodology undocumented

### Moderate
- **Rank scores null for ~90% of films**: GBM rank features have near-zero variance in training
- **Production_house field**: Many films have empty/no match; only major houses (21) have data
- **Release_month_num null for some films**: About 15% of rows

### Minor
- **Gemini content scoring at startup**: External API dependency for concept analysis (not fully implemented)
- **Market signals fetch**: Uses mock data when live API unavailable

---

## 11. Recent Bug Fixes (May 2026)

| Fix | Issue | Resolution |
|---|---|---|
| A | `bestSplit()` used hardcoded `minSamplesLeaf=2` instead of params | Now passes `params.minSamplesLeaf` |
| B | ML rank features always `null` at inference | Falls back to tier-average rank score from dataset-stats |
| C | Percentile buckets calibrated for pre-adjustment scores | Recalibrated for survivorship-adjusted scores |
| D | Dead `bayesianComponents()` code | Removed (not used in any code path) |
| E | MC base_multiple not survivorship-corrected | Multiply `mcMean` by SURVIVORSHIP_ADJ |
| — | Film count in narrative used hardcoded value | Switched to dynamic `trainingCount` |

---

## 12. Outstanding Design Concerns

1. **GBM trained on biased data, used for adjusted scores**: The GBM learns the dataset's 2.72× baseline. The survivorship adjustment in `mlScore = mlPrediction / 0.04 * 0.37` is a post-hoc correction. An alternative is training with an adjusted target `y_adj = y / 2.72`.

2. **Pairwise split sorting uses original indices**: Fixed — now pairs `[value, target]` and sorts correctly. No longer an O(n³) bug.

3. **Budget band discontinuity at 300Cr**: The `>200` band lumps 200Cr films with 400Cr+ films. A `>300` band would better separate these.

4. **No cross-validation for GBM hyperparameters**: Parameters (150 trees, depth 4, lr 0.08) are domain-heuristic, not optimized. A 3-fold time-series CV would validate.

5. **Lognormal sigma uncalibrated**: `baseSigma = 0.6` is assumed, not fitted from residual variance. Should be derived from actual `log(gross_multiple)` standard deviation.

6. **Percentile-to-verdict thresholds not validated**: The P50/P55/P60/P65/P70 greenlight thresholds are heuristic. Actual backtest data shows 93.3% precision, but the n=30 sample limits confidence.

7. **UI shows "financial projections" but not all rights data in CSV**: No CSV column maps to OTT/satellite/music rights. All rights figures are user speculation.

8. **Pre-sale benchmarks are market estimates, not dataset-backed**: The min/max ranges per budget band are derived from industry research, not the dataset.
