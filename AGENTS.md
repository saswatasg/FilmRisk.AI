<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:backtest-results -->
# Honest Evaluation Results (June 2026)

## Primary Benchmark: Walk-Forward (Forward-Chaining)
Train ≤ Y, test Y+1, rolling 12 folds (2014–2025). Full scoring engine (ML blend + Bayesian + 10 components). **619 films tested.** This is the headline metric.

| Metric | Value [95% CI] |
|--------|---------------|
| Accuracy | 47.2% [43.3%, 51.1%] |
| Greenlight Precision | 29.8% [23.5%, 37.1%] |
| Greenlight Recall | 44.0% |
| F1 Score | 35.5% |
| Greenlight Calls | 171/619 (27.6%) |
| Always-Flop Baseline | 67.2% |

## Secondary: 75-25 Random Split (In-Distribution Upper Bound)
Reference only — future films leak into training.

| Metric | Value [95% CI] |
|--------|---------------|
| Accuracy | 53.5% [46.0%, 60.9%] |
| Greenlight Precision | 44.2% [31.6%, 57.7%] |
| Greenlight Recall | 69.7% |
| F1 Score | 54.1% |
| Greenlight Calls | 52/170 (30.6%) |
| Always-Flop Baseline | 50.0% |

## Key Takeaways
- Walk-forward accuracy 47.2% vs always-flop 67.2% — model adds value but is still below the naive baseline. Precision of 29.8% is 1.6× better than random 18.7% hit rate.
- Imputed rows (105) excluded from training — training on band-median targets inflated 75-25 metrics from 53.5% → 67.9% in earlier versions.
- Era-aware break-even (pre_ott/ott_growth/covid/mature) lowers normalized multiples for pre-2015 films (no OTT rights), shifting their percentile rankings.
- 9-dim feature vector (no genre OHE, no production_house in GBM) — sparse one-hot features removed.
- Log-space GBM target tried (Task 9) and reverted — didn't improve headliner metrics (acc dropped 39.4% → 30.2%).
- Thresholds kept at offset +1 from base (current PCT_THRESHOLDS). Walk-forward sweep shows offset -11 has best F1 (44.9%) but is too aggressive (46% GL calls). Offset +1 prioritizes precision over recall.

## Known Limitations
- 67.2% always-flop baseline means any non-trivial GL calls reduce accuracy. The model deliberately calls GL on uncertain films, which hurts accuracy but is higher value (catches hits).
- Forward-chaining trains on ≤Y data, which can be thin for early years (2010–2013 excluded, <50 films). 2015 has n=76 with 8.8% GL precision — early folds are noisy.
- Walk-forward accuracy of 47.2% suggests the scoring engine's percentile ranking is reasonable but thresholds need calibration for production use.
- 171 GL calls across 619 films (27.6%) is aggressive. Each GL false positive is a potential investment loss. Consider stricter thresholds for real use.
- No log-space GBM (didn't improve metrics).
<!-- END:backtest-results -->

<!-- BEGIN:filmrisk-research -->
# Bollywood Investment Research (2025)

## Key Market Facts
- 2025 Indian box office: ₹13,395 Cr. Hindi cinema record: ₹5,504 Cr.
- 37 films crossed ₹100 Cr in 2025 (vs 22 in 2024).
- Top 10 concentration fell from 41% → 33% — the "long tail" is growing.
- Non-star-driven films (Chhaava, Saiyaara) succeeded — star power is declining.

## Academic Findings (ML Research)
- **Director has MORE predictive power than Lead Actor** — contrary to conventional wisdom.
- Key factors (ranked): Budget > Director > Cast popularity > Release timing > Genre.

## OTT/Satellite Market (Post-Pandemic)
- OTT uses **performance-linked pricing**: base (~40% budget) + slab increases.
- Big films recover 60–80% of budget pre-release through non-theatrical rights.
- Satellite rights collapsed to ~10% of budget (down from 30–50% pre-pandemic).
- OTT: 40–60% of budget. Music: 10–20%. Overseas: 10–25%. Brand: 5–15%.

## Theatrical Share (Distributor/Exhibitor Economics)
- Week 1 multiplex split: ~41% to distributor after GST.
- Producer's effective theatrical share: **35–40%** (NOT 50%).

## Scoring Engine (Current Weights — Continuous Model)
| Component | Producer | Financier |
|-----------|----------|-----------|
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

Continuous model: all dataset-backed components score by expected gross multiple (not win rate). Mapping: `score = min(multiple / cap, 1) * 10` where cap=4.0 for genre/talent, 3.5 for budget/seasonality.

## New Features (May 2026)
- **Continuous Outcome Model**: Replaced binary win-rate scoring with expected gross multiple — 93.3% precision (was 85.7%), 51.9% recall (was 22.2%)
- **Production House Field**: Dropdown with 21 major houses; scored from dataset avg multiples (4% weight)
- **Genre Appetite Trajectory**: Green/red arrows next to genre scores showing trending up/down (2yr WR vs 10yr)
- **Confidence Intervals**: ±range displayed in score cards (derived from component sample sizes)
- **Sensitivity Analysis**: Top-5 score levers shown in results
- **Pre-Sale Benchmarking**: Market ranges per budget for each rights category (below/within/above)
- **Inline Validation**: Required fields enforced before submit; data quality warnings
- **Empty State**: 3 example project cards to pre-fill form
- **Walk-Forward Validation**: Annual rolling backtest across 15 windows

## Known Data Quality Issues
- Dataset survivorship bias: only 679/2209 films have both budget+gross; median multiple 2.72× vs real market ~1.0×.
- All 8 content-score columns completely empty — user sliders (conceptClarity, novelty) are the only source of this signal.
- 2010+ rows include synthetic "Movie_XXXX_XXX" records with Low confidence — inflate financial counts, add noise.
- Pre-sale rights data does not exist in CSV — user-input only; backtest estimates from budget.
- Tier system methodology (`actor_tier_proxy`, `director_tier_proxy`) is a black box — pre-computed, undocumented.
<!-- END:filmrisk-research -->
