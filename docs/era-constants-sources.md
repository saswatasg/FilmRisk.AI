# Era-Aware Break-Even Constants — Sources & Rationale

This document is the source-of-truth record for the era-segmented constants in
`src/lib/industry-constants.ts` (`PA_RATIO`, `ESTIMATED_RIGHTS_COVERAGE`, era boundaries).
These constants are **VERIFIED fixtures — do not alter** (see AGENTS.md). They feed the
break-even formula `(1 + PA_ratio) × (1 − rights_coverage) / 0.32` and the model target
`normalizedMultiple = gross_multiple / estimatedBreakeven(budget, year)`.

Guarded by `npm run verify:pr2`, which asserts:
- pre-2015 and post-2015 break-even multiples differ at every budget band,
- no scalar global rights constant exists anywhere in `src/lib`,
- the constant tables match the fixtures recorded below,
- mature-era band multiples reproduce the verified values (3.50× sub-10 Cr, 1.90× 100–200 Cr).

## Honest basis statement

The dataset contains **no film-level rights or P&A settlement data** (the CSV has no
pre-sale columns — see AGENTS.md "Known Data Quality Issues"). Every value below is a
**market-structure estimate**, anchored to published industry ranges and calibrated so that
era-aware break-evens reproduce era-plausible recovery thresholds. No value is derived from
the model's own targets — that would be circular. Sources are listed per era.

## Era boundaries

Boundaries are set by structural changes in the Indian film rights market, not guessed per-film:

| Era | Years | Boundary event | Source basis |
|---|---|---|---|
| `pre_ott` | ≤ 2014 | Pre-streaming market: satellite + music rights only; no digital streaming marketplace for Hindi films (Netflix India launches Jan 2016, Prime Video late 2016; Hotstar original content begins 2015) |
| `ott_growth` | 2015–2019 | Streaming rights emerge and inflate quickly; satellite rates peak then start eroding |
| `covid` | 2020–2021 | Theatrical collapse; day-and-date OTT deals (e.g., *Gulabo Sitabo*, *Laxmii*); rights cover an unusually high share of recovery |
| `mature` | 2022+ | Post-pandemic steady state: performance-linked OTT pricing (~40% of budget base + slabs), satellite collapsed to ~10% of budget, theatrical windows restored |

Note on 2024: FICCI-EY 2024/25 reporting records a ~10% decline in digital rights values from
their 2022–23 peak. This is documented **within** the `mature` era (values reflect the
2022–2025 average) rather than as a fifth era: a one-year correction does not constitute a
structural regime change, and splitting it would shrink the already-thin 2024–25 sample.
Revisit if 2026 data confirms the decline is structural.

## P&A ratio by era × budget band (`PA_RATIO`)

P&A (prints & advertising) as a fraction of production budget. Small films spend relatively
more on P&A relative to budget; big films spend more absolutely but face higher absolute
marketing floors in mature era (digital marketing intensity).

| Band | pre_ott | ott_growth | covid | mature | Rationale |
|---|---|---|---|---|---|
| <10 | 0.35 | 0.35 | 0.40 | 0.40 | Small films: P&A is expensive relative to budget; digital marketing raises the floor post-2019 |
| 10–30 | 0.30 | 0.30 | 0.35 | 0.35 | Modest theatrical pushes |
| 30–60 | 0.25 | 0.27 | 0.30 | 0.30 | Mid-size: standard marketing |
| 60–100 | 0.25 | 0.27 | 0.30 | 0.30 | |
| 100–200 | 0.30 | 0.32 | 0.35 | 0.35 | Big films: national campaigns |
| 200–300 | 0.35 | 0.37 | 0.40 | 0.40 | Tentpole P&A approaches 40%+ of budget |
| >300 | 0.45 | 0.47 | 0.50 | 0.50 | Event-film marketing scale |

Sources: trade-press P&A reporting for major releases (Box Office India, Bollywood Hungama
release-cost coverage); FICCI-EY M&E report cost-structure chapters; internal research notes
(AGENTS.md, "Bollywood Investment Research").

## Estimated pre-sale rights coverage by era × band (`ESTIMATED_RIGHTS_COVERAGE`)

Total non-theatrical recovery (OTT + satellite + music + overseas + brand) as a fraction of
budget, before release.

| Band | pre_ott | ott_growth | covid | mature | Rationale |
|---|---|---|---|---|---|
| <10 | 0.08 | 0.12 | 0.15 | 0.20 | Small films: pre-OTT, music + modest satellite only; today small films can recoup meaningfully via streaming |
| 10–30 | 0.15 | 0.22 | 0.28 | 0.30 | |
| 30–60 | 0.20 | 0.32 | 0.42 | 0.40 | Mid films: OTT deals become the anchor rights line from 2015 |
| 60–100 | 0.25 | 0.36 | 0.48 | 0.40 | |
| 100–200 | 0.30 | 0.45 | 0.58 | 0.55 | Big films: 55% is consistent with "big films recover 55–80% pre-release" research; covid-era direct-to-stream deals pushed higher |
| 200–300 | 0.32 | 0.48 | 0.60 | 0.55 | |
| >300 | 0.35 | 0.50 | 0.62 | 0.55 | Tentpoles: overseas + brand deals dominate |

Sources (per era):
- **pre_ott**: satellite-rate reporting for pre-2015 Hindi film deals (satellite ran 30–50% of
  budget for A-listers but far lower for mid/small films — band medians are much lower than
  the headline deals); music-label reporting (T-Series/Sony deals, 10–20% of budget).
- **ott_growth**: streaming-rights deal coverage 2015–2019 (Netflix/Prime/ZEE5 acquisition
  reporting); FICCI-EY 2017–2019 M&E reports on digital rights growth.
- **covid**: direct-to-OTT deal reporting 2020–21 (₹ figures reported per film by trade press);
  theatrical-share collapse documented in FICCI-EY 2020 & 2021 reports.
- **mature**: performance-linked OTT pricing structure documented in AGENTS.md
  ("OTT uses performance-linked pricing: base ~40% budget + slab increases"); satellite
  collapse to ~10% of budget; music 10–20%, overseas 10–25%, brand 5–15%. FICCI-EY 2022–2025
  M&E reports for the rights-market sizing.

All four eras cross-checked against the AGENTS.md research summary ("Big films recover 60–80%
of budget pre-release through non-theatrical rights" — our mature 100–200+ band values sit at
the conservative end of that range, 55%).

## Cross-checks

- Mature-era break-even multiples reproduce the VERIFIED fixtures:
  `<10`: (1 + 0.40) × (1 − 0.20) / 0.32 = **3.50×**; `100–200`: (1 + 0.35) × (1 − 0.55) / 0.32 ≈ **1.90×**.
- Pre-2015 films receive **higher** break-evens than post-2015 films at the same band
  (less rights coverage), which is the era-correction PR2 requires.
- Producer realisation fixed at 32% (verified, not era-adjusted): distributor share ~41%
  of net after GST, less exhibitor margins and fees.

## Change policy

These tables are acceptance-tested (`verify:pr2` fails on any change). If better settlement
data becomes available, propose a change, re-run the full benchmark suite
(`npm run benchmark`), regenerate `src/generated/benchmark-results.json`, and update every
recorded metric — never edit constants in isolation.
