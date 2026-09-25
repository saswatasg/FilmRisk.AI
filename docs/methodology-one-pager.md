# How the Greenlit Score Works — One Page for Producers & Fund Managers

## What it is

A pre-release check on a film project. You describe the project — story strength, cast and
director calibre, budget, expected streaming/satellite/music sales, release timing — and the
system returns a memorandum: a verdict, the likely range of financial outcomes, comparable
films, risk factors, and which changes would move the needle most.

## How it estimates returns

1. **It compares your project to twenty-five years of Bollywood history.** We maintain
   records of thousands of Hindi films released between 2001 and 2025, including hundreds
   with verified budgets and box-office collections. Every part of the score is grounded in
   what actually happened to similar films — similar genre, similar budget size, similar
   cast and director track record, similar release window — never in anyone's opinion.
2. **It measures returns against what the film needed to break even.** A small film and a
   large film do not face the same economics: big films recover far more before release
   through streaming, satellite, music, and overseas sales, while small films live or die
   in theatres. The market for these pre-sales has also changed completely since streaming
   arrived around the mid-2010s, so older and newer films are judged against the economics
   of their own era. Every comparison is made in these break-even-adjusted terms.
3. **It blends data with your judgment.** Part of the score comes from the historical
   record; the rest comes from your inputs — the strength of the concept, the pre-sale
   deals you expect, the release timing you choose. The report always shows the split, so
   you can see how much of the score is evidence and how much is your own assumptions.

## How it is tested

The honest way to test a prediction system is to pretend you are back in time: train it
only on films released before a given year, then ask it to judge later years it has never
seen — retrained from scratch every time, across more than a dozen rolling folds, with
naive always-say-no and band-average predictors alongside. We publish confidence intervals
on every internal metric, and we keep a frozen film-by-film record of recent releases with
predicted verdict versus actual outcome for every film. That record is available under
diligence — ask for it before you trust us. No performance figure on any buyer surface;
the record speaks where headlines would mislead.

## What it cannot do

- **It cannot fix missing data.** Only about three in ten Bollywood films ever publish
  reliable budgets and collections, and those skew toward the successful ones. Every
  report carries this warning. We adjust for market eras; we do not pretend the bias away.
- **It does not know your story.** There is no database of script quality. Your ratings of
  the concept's clarity and freshness are the only story signal — be honest with them,
  because the score trusts them.
- **It has no pre-sale database.** Streaming and satellite deal values are your inputs,
  benchmarked against market ranges. Optimistic inputs produce optimistic scores; the
  report shows the split.
- **Regime changes fool it.** The pandemic years and the recovery broke historical
  patterns, and the system misread those years badly. Any structural market shift will do
  the same — treat the score as one input to judgment, not a substitute for it.

## How to use it in a decision

Use the score to **challenge** a project, not to approve it: look at the weakest
components, run the "what-if" levers (what if the budget overruns? what if the release
moves?), and check the range of simulated outcomes — not just the single score. A narrow
high range is a different bet than a wide one with the same midpoint. If the system and
your team disagree, find out why before money moves.
