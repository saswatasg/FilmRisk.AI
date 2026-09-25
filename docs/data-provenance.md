# Data Provenance & Licensing Audit

Status labels per source — **safe to show derived outputs to a buyer** / **safe to transfer raw data** /
**requires separate licensing before external use**. Basis stated for each label.
Last reviewed: September 2026. Re-review before any external transfer or demo.

## 1. Film dataset — `src/data/bollywood_input.csv` (2,454 rows, 2001–2025)

- **Lineage**: compiled from `src/data/bollywood_master_v0.csv` (2,465 rows, `data_version: 2.0`,
  `last_updated: 2026-07-02`), whose `source` column reads **`wikipedia`** on every row.
  The master CSV carries IMDb IDs, cast lists, and (empty) content-score columns dropped
  from the input CSV. No synthetic "Movie_XXXX" rows remain in the input CSV (verified: 0 found).
- **Underlying origin**: Wikipedia film pages' budget/box-office figures, which are
  themselves compiled from trade tracking (Box Office India, Bollywood Hungama, Sacnilk,
  producer announcements) via Wikipedia citations.
- **License exposure**: Wikipedia text and structured data are **CC BY-SA 4.0**. The
  budget/gross figures are facts (facts are not copyrightable), but the *compiled
  selection and arrangement* inherits share-alike considerations on a conservative reading.
- **Derived outputs** (scores, verdicts, benchmarks, reports, charts shown to a buyer): **safe to show** — with a one-line attribution ("film financials compiled from public sources incl. Wikipedia").
- **Raw data transfer** (handing the CSVs to a buyer): **requires licensing review** — confirm the CC BY-SA chain with counsel before transferring the raw files; do not present the raw dataset as proprietary or exclusively owned.
- **Do-not-do**: do not claim exclusive/proprietary ownership of the film data in any buyer material.

## 2. Industry constants — era P&A ratios & rights coverage (`src/lib/industry-constants.ts`)

- **Nature**: estimates authored for this project (documented per constant in
  `docs/era-constants-sources.md`), anchored to FICCI-EY Media & Entertainment reports
  (2015–2025), trade-press rights-deal coverage, and GST-era distributor economics.
- **Derived outputs**: **safe to show**. **Tables themselves**: **safe to transfer** as our
  own analysis — with the source citations intact. No third-party data is copied verbatim.

## 3. Market research figures (AGENTS.md, landing page, one-pager)

- 2025 Indian box office ₹13,395 Cr, Hindi ₹5,504 Cr, 37 films past ₹100 Cr, concentration
  41%→33%: **FICCI-EY 2025 M&E report + trade-press consolidation**. Facts with citation:
  **safe to show**. Re-verify against the latest FICCI-EY edition before quoting to a buyer.

## 4. Optional live market signals (GNews API)

- Used only if `GNEWS_API_KEY` is set; otherwise the app runs fully on built-in mock signals.
- **External demos run on mock signals.** Live GNews usage in a buyer demo or transfer: **requires licensing review** (GNews plan terms for commercial/redistribution use).

## 5. Code & asset licenses

| Dependency | License | Status |
|---|---|---|
| Next.js, React, Tailwind CSS, @base-ui/react, clsx, tailwind-merge, class-variance-authority | MIT | safe |
| lucide-react (icons) | ISC | safe |
| Geist / Playfair Display (via next/font) | SIL OFL | safe |
| TypeScript, ESLint | Apache-2.0 / MIT | safe (dev only) |
| shadcn CLI (`shadcn` package) | MIT | safe (scaffolding only) |
| tsx (dev runner) | MIT | safe (dev only) |

All application code in `src/` and `scripts/` was authored for this project: **safe to transfer**.

## 6. Open / unresolved items

- **None currently blocking a demo**: all buyer-visible surfaces run on mock signals by
  default, and no unresolved-licence data is rendered externally.
- **Before any raw-data transfer**: resolve item 1 (CC BY-SA review) with counsel.
- **Before quoting market figures**: re-verify item 3 against the current FICCI-EY edition.

## Demo-run checklist (external)

- [ ] `npm run verify` green (acceptance tests)
- [ ] Fixtures regenerated on the frozen demo dataset (`npm run benchmark && npm run track-record`)
- [ ] External demo runs **without** `GNEWS_API_KEY` (mock signals)
- [ ] Buyer receives `docs/methodology-one-pager.md` + `docs/track-record.md`, **not** raw CSVs
- [ ] Raw CSVs are not copied, screenshared in full, or described as proprietary
