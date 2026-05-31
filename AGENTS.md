<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:backtest-results -->
# Honest Backtest Results

## Methodological changes from earlier versions
- **Time-series split**: Train ≤ 2022, test > 2022 (not in-sample)
- **Bayesian shrinkage**: Uses actual (unweighted) counts — NOT temporally-inflated counts
- **Seasonality**: 3% weight added, scored from release_month_num stats
- **Pre-sale caveat**: 22% weight component is estimated from budget bands (CSV has no pre-sale data)

## Out-of-Sample Performance (2023-2025, n=30)
| Metric | Win-rate model (old) | Continuous model (current) |
|--------|---------------------|---------------------------|
| Greenlight Precision | 85.7% | **93.3%** |
| Greenlight Recall | 22.2% | **51.9%** |
| False Positive Rate | 14.3% | **6.7%** |
| Greenlight Predicted | 7/30 | **15/30** |
| Don't Invest Pred | 0% | **0%** |
| Overall Accuracy | 36.7% | **43.3%** |

## Key Takeaways
- 93.3% precision with 51.9% recall — model catches ~half of successes with very few false positives
- Switched to continuous outcome model (expected gross multiple, not binary win rate) in May 2026
- Many BLOCKBUSTER films still edge below 75 threshold (e.g. Pathaan 74.4) — thresholds may need 2-3pt adjustment
- 0 Don't Invest calls suggests adding lower boundary for true negative predictions
- 10 components now (added Production House at 4% weight)
- Small test set (n=30) limits statistical confidence — primary benchmark is OOS precision

## Walk-Forward Validation (15 rolling windows, 2010-2025)
| Metric | Value |
|--------|-------|
| Avg Accuracy | **18.4%** |
| Windows | 15 |
| Range | 0%–43.8% |

Walk-forward is a relative diagnostic only — tiny per-year test sets (8-23 films) and bucketed verdicts make absolute accuracy noisy. Focus on OOS metrics above.
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
