# bollywood_input.csv — Column Reference

| # | Column | Type | Description | Used in |
|---|--------|------|-------------|---------|
| 1 | `film_id` | string | Unique identifier e.g. `BOLLY_2001_0001_...` | UI display, dedup |
| 2 | `display_title` | string | Movie title for display | Results UI |
| 3 | `release_year` | integer | Year of release (2001–2025) | ML feature, comparable films, stats |
| 4 | `release_month_num` | integer \| null | Month number 1–12 (null = unknown) | ML feature (sin/cos), seasonality |
| 5 | `primary_genre` | string | Main genre (Drama, Action, Comedy, etc.) | ML one-hot, genre stats, scoring |
| 6 | `secondary_genre` | string \| empty | Sub-genre (optional) | 20% blend in genre scoring |
| 7 | `sequel_flag` | `Yes` / `No` | Is this a sequel/franchise entry? | +1.5 bonus in scoring, ML feature |
| 8 | `director` | string | Director name(s) | Comparable-film matching |
| 9 | `lead_actor_1` | string | Primary lead actor | Comparable-film matching |
| 10 | `lead_actor_2` | string \| empty | Secondary lead actor | Comparable-film matching (0.7× weight) |
| 11 | `production_house` | string \| empty | Production company | ML one-hot, dataset stats |
| 12 | `actor_rank_score` | float \| null | Pre-computed actor ranking score | ML feature (normalized), rank imputation |
| 13 | `actor_tier_proxy` | string \| empty | Actor tier (A/B/C/D) | ML one-hot, Bayesian priors, comparable |
| 14 | `director_rank_score` | float \| null | Pre-computed director ranking score | ML feature (normalized), rank imputation |
| 15 | `director_tier_proxy` | string \| empty | Director tier (A/B/C/D) | ML one-hot, Bayesian priors, comparable |
| 16 | `budget_cr` | float \| null | Total budget in ₹ Crores | ML target, scoring, band classification |
| 17 | `worldwide_gross_cr` | float \| null | Worldwide gross in ₹ Crores | ML target, scoring |
| 18 | `verdict_raw` | string | Box-office verdict label e.g. `hitFlop=3`, `Hit`, `Flop` | Backtest outcome labels |
| 19 | `financial_data_confidence` | string | Data quality: `High` / `Low` / `Missing/Partial` | Training-row weight (backtest) |

## Notes

- **`gross_multiple`** is computed at runtime as `worldwide_gross_cr / budget_cr`, not stored in CSV
- **`budget_cr` + `worldwide_gross_cr`** must both be present (>0) for a film to be usable in ML training
- Films missing either budget or gross are **imputed** at load time via budget-band median multiples
- Empty strings (`""`) = no data, not `null`
- Only pre-release variables used in evaluation form; financial columns are training-only
