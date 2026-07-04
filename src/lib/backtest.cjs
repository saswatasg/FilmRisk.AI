/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');

const text = fs.readFileSync(path.join(__dirname, '..', 'data', 'bollywood_input.csv'), 'utf-8');
const lines = text.split('\n').filter(l => l.trim());
const h = parseLine(lines[0]);
const rows = lines.slice(1).map(l => parseLine(l));

function parseLine(line) {
  const r = []; let c = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { if (q && i+1 < line.length && line[i+1] === '"') { c+='"'; i++; } else q=!q; }
    else if (ch === ',' && !q) { r.push(c); c=''; }
    else c += ch;
  }
  r.push(c); return r;
}

function n(v) { const x = parseFloat(v); return isNaN(x) ? null : x; }
function p(v) { return (v || '').trim(); }

/* ───── Synchronous reimplementation of industry-constants.ts ───── */
const PRODUCER_REALISATION_RATE = 0.32;

function eraByYear(year) {
  if (year <= 2014) return 'pre_ott';
  if (year <= 2019) return 'ott_growth';
  if (year <= 2021) return 'covid';
  return 'mature';
}

const PA_RATIO = {
  pre_ott:   { '<10': 0.35, '10-30': 0.30, '30-60': 0.25, '60-100': 0.25, '100-200': 0.30, '200-300': 0.35, '>300': 0.45 },
  ott_growth:{ '<10': 0.35, '10-30': 0.30, '30-60': 0.27, '60-100': 0.27, '100-200': 0.32, '200-300': 0.37, '>300': 0.47 },
  covid:     { '<10': 0.40, '10-30': 0.35, '30-60': 0.30, '60-100': 0.30, '100-200': 0.35, '200-300': 0.40, '>300': 0.50 },
  mature:    { '<10': 0.40, '10-30': 0.35, '30-60': 0.30, '60-100': 0.30, '100-200': 0.35, '200-300': 0.40, '>300': 0.50 },
};

const EST_RIGHTS = {
  pre_ott:   { '<10': 0.08, '10-30': 0.15, '30-60': 0.20, '60-100': 0.25, '100-200': 0.30, '200-300': 0.32, '>300': 0.35 },
  ott_growth:{ '<10': 0.12, '10-30': 0.22, '30-60': 0.32, '60-100': 0.36, '100-200': 0.45, '200-300': 0.48, '>300': 0.50 },
  covid:     { '<10': 0.15, '10-30': 0.28, '30-60': 0.42, '60-100': 0.48, '100-200': 0.58, '200-300': 0.60, '>300': 0.62 },
  mature:    { '<10': 0.20, '10-30': 0.30, '30-60': 0.40, '60-100': 0.40, '100-200': 0.55, '200-300': 0.55, '>300': 0.55 },
};

function budgetBand(b) {
  if (b < 10) return '<10';
  if (b < 30) return '10-30';
  if (b < 60) return '30-60';
  if (b < 100) return '60-100';
  if (b < 200) return '100-200';
  if (b < 300) return '200-300';
  return '>300';
}

function estimatedBreakeven(budget, releaseYear) {
  const era = releaseYear !== undefined ? eraByYear(releaseYear) : 'mature';
  const band = budgetBand(budget);
  const rights = (EST_RIGHTS[era] && EST_RIGHTS[era][band]) ?? 0.30;
  const pa = (PA_RATIO[era] && PA_RATIO[era][band]) ?? 0.35;
  const theatrical = (1 + pa) * (1 - rights);
  return theatrical / PRODUCER_REALISATION_RATE;
}

function normalizedMultiple(grossMultiple, budget, releaseYear) {
  return grossMultiple / estimatedBreakeven(budget, releaseYear);
}

/* ───── Parse films ───── */
const films = rows.map(r => {
  const budget = n(r[h.indexOf('budget_cr')]);
  const gross = n(r[h.indexOf('worldwide_gross_cr')]);
  const year = n(r[h.indexOf('release_year')]) || 0;
  return {
    film_id: p(r[h.indexOf('film_id')]),
    title: p(r[h.indexOf('display_title')]),
    year,
    genre: p(r[h.indexOf('primary_genre')]),
    director: p(r[h.indexOf('director')]),
    actor: p(r[h.indexOf('lead_actor_1')]),
    actorTier: p(r[h.indexOf('actor_tier_proxy')]),
    directorTier: p(r[h.indexOf('director_tier_proxy')]),
    releaseMonth: n(r[h.indexOf('release_month_num')]) || 6,
    budget,
    gross,
    multiple: budget && gross && budget > 0 ? gross / budget : null,
    verdict: p(r[h.indexOf('verdict_raw')]),
    confidence: p(r[h.indexOf('financial_data_confidence')]),
  };
});

const testable = films.filter(f =>
  f.budget !== null && f.budget > 0 &&
  f.multiple !== null && f.multiple > 0 &&
  f.actorTier && f.directorTier && f.actorTier !== '' && f.directorTier !== ''
);

console.log(`\nTotal films: ${films.length}, Testable: ${testable.length}`);

// --- Time-series split: train ≤ 2022, test > 2022 ---
const CUTOFF_YEAR = 2022;
const trainSet = testable.filter(f => f.year <= CUTOFF_YEAR);
const testSet = testable.filter(f => f.year > CUTOFF_YEAR);
console.log(`Train (≤${CUTOFF_YEAR}): ${trainSet.length}, Test (>${CUTOFF_YEAR}): ${testSet.length}\n`);

/* ───── Constants matching TS engine ───── */
const BASE_PRIOR = 0.30;
const PRIOR_STRENGTH = 6;

function bayesianWR(wins, total) {
  if (total === 0) return Math.round(BASE_PRIOR * 100);
  return Math.round((wins + BASE_PRIOR * PRIOR_STRENGTH) / (total + PRIOR_STRENGTH) * 100);
}

function temporalWt(year) {
  if (year <= 2015) return 1.0;
  if (year >= 2025) return 3.0;
  return 1.0 + (year - 2015) * 0.2;
}

/* ───── Compute stats on TRAIN set only (break-even normalized) ───── */
const genreRaw = {}, actorRaw = {}, dirRaw = {}, bandRaw = {}, gbRaw = {}, comboRaw = {}, monthRaw = {};
const allMults = [];

for (const f of trainSet) {
  const wt = temporalWt(f.year);
  const mult = f.multiple;
  const normMult = normalizedMultiple(mult, f.budget, f.year);
  const band = budgetBand(f.budget);
  const gbKey = `${f.genre}|${band}`;

  if (!genreRaw[f.genre]) genreRaw[f.genre] = { w: 0, t: 0, m: 0, nm: 0, aw: 0, ac: 0, nw: 0 };
  genreRaw[f.genre].t += wt;
  genreRaw[f.genre].m += mult * wt;
  genreRaw[f.genre].nm += normMult * wt;
  if (normMult >= 1.0) { genreRaw[f.genre].w += wt; genreRaw[f.genre].aw += 1; genreRaw[f.genre].nw += 1; }
  genreRaw[f.genre].ac += 1;
  allMults.push(normMult);

  if (!bandRaw[band]) bandRaw[band] = { w: 0, t: 0, m: 0, nm: 0, aw: 0, ac: 0, nw: 0 };
  bandRaw[band].t += wt; bandRaw[band].m += mult * wt; bandRaw[band].nm += normMult * wt;
  if (normMult >= 1.0) { bandRaw[band].w += wt; bandRaw[band].aw += 1; bandRaw[band].nw += 1; }
  bandRaw[band].ac += 1;

  if (!gbRaw[gbKey]) gbRaw[gbKey] = { w: 0, t: 0, m: 0, nm: 0, aw: 0, ac: 0, nw: 0 };
  gbRaw[gbKey].t += wt; gbRaw[gbKey].m += mult * wt; gbRaw[gbKey].nm += normMult * wt;
  if (normMult >= 1.0) { gbRaw[gbKey].w += wt; gbRaw[gbKey].aw += 1; gbRaw[gbKey].nw += 1; }
  gbRaw[gbKey].ac += 1;

  if (!monthRaw[f.releaseMonth]) monthRaw[f.releaseMonth] = { w: 0, t: 0, m: 0, nm: 0, aw: 0, ac: 0, nw: 0 };
  monthRaw[f.releaseMonth].t += wt;
  monthRaw[f.releaseMonth].m += mult * wt; monthRaw[f.releaseMonth].nm += normMult * wt;
  if (normMult >= 1.0) { monthRaw[f.releaseMonth].w += wt; monthRaw[f.releaseMonth].aw += 1; monthRaw[f.releaseMonth].nw += 1; }
  monthRaw[f.releaseMonth].ac += 1;

  if (f.actorTier) {
    if (!actorRaw[f.actorTier]) actorRaw[f.actorTier] = { w: 0, t: 0, m: 0, nm: 0, aw: 0, ac: 0, nw: 0 };
    actorRaw[f.actorTier].t += wt; actorRaw[f.actorTier].m += mult * wt; actorRaw[f.actorTier].nm += normMult * wt;
    if (normMult >= 1.0) { actorRaw[f.actorTier].w += wt; actorRaw[f.actorTier].aw += 1; actorRaw[f.actorTier].nw += 1; }
    actorRaw[f.actorTier].ac += 1;
  }
  if (f.directorTier) {
    if (!dirRaw[f.directorTier]) dirRaw[f.directorTier] = { w: 0, t: 0, m: 0, nm: 0, aw: 0, ac: 0, nw: 0 };
    dirRaw[f.directorTier].t += wt; dirRaw[f.directorTier].m += mult * wt; dirRaw[f.directorTier].nm += normMult * wt;
    if (normMult >= 1.0) { dirRaw[f.directorTier].w += wt; dirRaw[f.directorTier].aw += 1; dirRaw[f.directorTier].nw += 1; }
    dirRaw[f.directorTier].ac += 1;
  }
  if (f.actorTier && f.directorTier) {
    const ck = f.directorTier + '+' + f.actorTier;
    if (!comboRaw[ck]) comboRaw[ck] = { w: 0, t: 0, m: 0, nm: 0, aw: 0, ac: 0, nw: 0 };
    comboRaw[ck].t += wt; comboRaw[ck].m += mult * wt; comboRaw[ck].nm += normMult * wt;
    if (normMult >= 1.0) { comboRaw[ck].w += wt; comboRaw[ck].aw += 1; comboRaw[ck].nw += 1; }
    comboRaw[ck].ac += 1;
  }
}

function stats(name, raw) {
  return Object.fromEntries(Object.entries(raw).map(([k, v]) => {
    const rawWR = v.t > 0 ? Math.round(v.w / v.t * 100) : 0;
    return [k, {
      count: Math.round(v.t),
      avgMult: v.t > 0 ? Math.round(v.m / v.t * 100) / 100 : 0,
      avgNormMult: v.t > 0 ? Math.round(v.nm / v.t * 100) / 100 : 0,
      rawWR,
      adjWR: bayesianWR(v.aw, v.ac),
      adjNormWR: bayesianWR(v.nw, v.ac),
    }];
  }));
}

const genreStats = stats('genre', genreRaw);
const actorStats = stats('actor', actorRaw);
const dirStats = stats('director', dirRaw);
const bandStats = stats('band', bandRaw);
const gbStats = stats('genreBudget', gbRaw);
const comboS = stats('combo', comboRaw);
const monthStats = stats('month', monthRaw);

console.log('=== TRAIN SET STATS (BREAK-EVEN NORMALIZED) ===\n');

console.log('Genre:');
for (const [g, s] of Object.entries(genreStats).sort(([,a],[,b]) => b.count - a.count)) {
  console.log(`  ${g}: ${s.count} films, ${s.rawWR}% norm-breakeven rate, ${s.adjNormWR}% adjusted, avg ${s.avgNormMult}x break-even`);
}

console.log('\nActor Tiers:');
for (const [t, s] of Object.entries(actorStats).sort()) {
  console.log(`  ${t}: ${s.count} films, ${s.adjNormWR}% adjusted norm WR`);
}

console.log('\nDirector Tiers:');
for (const [t, s] of Object.entries(dirStats).sort()) {
  console.log(`  ${t}: ${s.count} films, ${s.adjNormWR}% adjusted norm WR`);
}

console.log('\nBudget Bands:');
for (const [b, s] of Object.entries(bandStats).sort()) {
  console.log(`  ${b}: ${s.count} films, ${s.adjNormWR}% adjusted norm WR, avg ${s.avgNormMult}x break-even`);
}

// --- Continuous outcome model (break-even anchored) ---
const W = { genre: 0.12, gbFit: 0.06, budget: 0.14, talent: 0.17, preSale: 0.22, concept: 0.10, seasonality: 0.03, timing: 0.08, production: 0.04, productionHouse: 0.04 };

function multScore(mult, cap) {
  return Math.round(Math.min(mult / cap, 1) * 10 * 10) / 10;
}

function estimatePreSale(budget) {
  if (budget > 150) return { score: 7, ratio: 0.55 };
  if (budget > 60) return { score: 5.5, ratio: 0.40 };
  if (budget > 30) return { score: 4.5, ratio: 0.30 };
  return { score: 3, ratio: 0.20 };
}

function predict(film) {
  const gs = genreStats[film.genre];
  const bs = bandStats[budgetBand(film.budget)];
  const gb = gbStats[`${film.genre}|${budgetBand(film.budget)}`];
  const ck = film.directorTier + '+' + film.actorTier;
  const cs = comboS[ck];

  const gScore = gs ? multScore(gs.avgNormMult, 3.0) : 5;
  const gbScore = gb ? multScore(gb.avgNormMult, 3.0) : 5;
  const bScore = bs ? multScore(bs.avgNormMult, 3.0) : 5;
  let tScore;
  if (cs) {
    tScore = multScore(cs.avgNormMult, 3.0);
  } else {
    const a = actorStats[film.actorTier]; const d = dirStats[film.directorTier];
    const aM = a ? a.avgNormMult : 1.0; const dM = d ? d.avgNormMult : 1.0;
    tScore = multScore(aM * 0.45 + dM * 0.55, 3.0);
  }
  const p = estimatePreSale(film.budget);
  const conceptScore = 5.5;
  const ms = monthStats[film.releaseMonth];
  const seasonScore = ms && ms.count >= 3 ? multScore(ms.avgNormMult, 3.0) : 6;
  const timingScore = 6;
  const prodScore = 7;
  const phScore = 5;

  const raw = gScore * W.genre + gbScore * W.gbFit + bScore * W.budget + tScore * W.talent
    + p.score * W.preSale + conceptScore * W.concept + seasonScore * W.seasonality
    + timingScore * W.timing + prodScore * W.production + phScore * W.productionHouse;
  const total = Math.round(raw * 10 * 10) / 10;

  /* Simple raw-score thresholds (backtest lacks ML blend + Bayesian shrinkage of full engine) */
  const verdict = total >= 75 ? 'GREENLIGHT' : total >= 50 ? 'CONDITIONAL' : 'DONT_INVEST';
  return { total, verdict, components: { g: gScore, gb: gbScore, b: bScore, t: tScore, p: p.score } };
}

function actualClass(normMult) {
  if (normMult >= 2.0) return 'BLOCKBUSTER';
  if (normMult >= 1.5) return 'HIT';
  if (normMult >= 1.0) return 'BREAK_EVEN';
  if (normMult >= 0.5) return 'BELOW_AVG';
  return 'FLOP';
}

/* ───── Wilson confidence interval ───── */
function wilsonCI(pos, n, z) {
  if (n === 0) return { lower: 0, upper: 1 };
  const p = pos / n;
  const denom = 1 + z * z / n;
  const centre = (p + z * z / (2 * n)) / denom;
  const margin = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / denom;
  return { lower: Math.max(0, centre - margin), upper: Math.min(1, centre + margin) };
}

/* ───── Run backtest on TEST set ───── */
let correct = 0, total = 0;
const confMatrix = { GREENLIGHT: { HIT: 0, FLOP: 0 }, CONDITIONAL: { HIT: 0, FLOP: 0 }, DONT_INVEST: { HIT: 0, FLOP: 0 } };
const byVerdict = { GREENLIGHT: { correct: 0, total: 0, mults: [] }, CONDITIONAL: { correct: 0, total: 0, mults: [] }, DONT_INVEST: { correct: 0, total: 0, mults: [] } };
const errors = [];
let brierSum = 0, preds = [], actuals = [];
let totalPairs = 0, concordantPairs = 0;

console.log(`\n=== OUT-OF-SAMPLE BACKTEST (train ≤${CUTOFF_YEAR}, test >${CUTOFF_YEAR}) n=${testSet.length} ===`);

for (const film of testSet) {
  const pred = predict(film);
  const normMult = normalizedMultiple(film.multiple, film.budget, film.year);
  const actual = actualClass(normMult);
  total++;

  let isCorrect = false;
  if (pred.verdict === 'GREENLIGHT' && (actual === 'BLOCKBUSTER' || actual === 'HIT')) isCorrect = true;
  else if (pred.verdict === 'CONDITIONAL' && (actual === 'BREAK_EVEN' || actual === 'BELOW_AVG')) isCorrect = true;
  else if (pred.verdict === 'DONT_INVEST' && (actual === 'FLOP' || actual === 'BELOW_AVG')) isCorrect = true;

  if (isCorrect) correct++;
  if (pred.verdict === 'GREENLIGHT') confMatrix.GREENLIGHT[actual === 'FLOP' || actual === 'BELOW_AVG' ? 'FLOP' : 'HIT']++;
  else if (pred.verdict === 'DONT_INVEST') confMatrix.DONT_INVEST[actual === 'FLOP' || actual === 'BELOW_AVG' ? 'FLOP' : 'HIT']++;
  else confMatrix.CONDITIONAL[actual === 'FLOP' || actual === 'BELOW_AVG' ? 'FLOP' : 'HIT']++;

  byVerdict[pred.verdict].total++;
  if (isCorrect) byVerdict[pred.verdict].correct++;
  byVerdict[pred.verdict].mults.push(normMult);

  /* Brier score: P(profit) = normMult >= 1.0 */
  const pProfit = Math.min(1, Math.max(0, normMult / 3.0));
  const actualProfit = normMult >= 1.0 ? 1 : 0;
  brierSum += (pProfit - actualProfit) ** 2;
  preds.push(pProfit);
  actuals.push(actualProfit);

  /* Spearman rank correlation */
  for (let j = 0; j < preds.length - 1; j++) {
    const dPi = pProfit - preds[j];
    const dAi = actualProfit - actuals[j];
    if (dPi * dAi > 0) concordantPairs++;
    else if (dPi * dAi < 0) totalPairs++;
    // ties ignored
  }
  totalPairs += preds.length - 1;

  if (!isCorrect && errors.length < 20) {
    errors.push({ title: film.title, year: film.year, budget: film.budget, normMult: normMult.toFixed(2), genre: film.genre, actual, predicted: pred.verdict, score: pred.total });
  }
}

const accuracy = correct / total;
const accCI = wilsonCI(correct, total, 1.96);

const glHit = confMatrix.GREENLIGHT.HIT, glFlop = confMatrix.GREENLIGHT.FLOP;
const precision = glHit + glFlop > 0 ? glHit / (glHit + glFlop) : 0;
const precCI = wilsonCI(glHit, glHit + glFlop, 1.96);
const allHits = confMatrix.GREENLIGHT.HIT + confMatrix.CONDITIONAL.HIT + confMatrix.DONT_INVEST.HIT;
const recall = allHits > 0 ? glHit / allHits : 0;
const recallCI = wilsonCI(glHit, allHits, 1.96);
const fpr = glHit + glFlop > 0 ? glFlop / (glHit + glFlop) : 0;
const brier = brierSum / total;
const spearmanRank = totalPairs > 0 ? concordantPairs / totalPairs : 0;

const diHit = confMatrix.DONT_INVEST.HIT, diFlop = confMatrix.DONT_INVEST.FLOP;

console.log(`\nOverall Accuracy: ${(accuracy * 100).toFixed(1)}% (${correct}/${total})`);
console.log(`  Wilson 95% CI: [${(accCI.lower * 100).toFixed(1)}%, ${(accCI.upper * 100).toFixed(1)}%]`);

console.log(`\nGreenlight Precision: ${(precision * 100).toFixed(1)}%`);
console.log(`  Wilson 95% CI: [${(precCI.lower * 100).toFixed(1)}%, ${(precCI.upper * 100).toFixed(1)}%]`);
console.log(`Greenlight Recall: ${(recall * 100).toFixed(1)}%`);
console.log(`  Wilson 95% CI: [${(recallCI.lower * 100).toFixed(1)}%, ${(recallCI.upper * 100).toFixed(1)}%]`);
console.log(`False Positive Rate: ${(fpr * 100).toFixed(1)}%`);
console.log(`\nBrier Score: ${brier.toFixed(4)} (0=perfect, 1=worst)`);
console.log(`Spearman Rank Correlation: ${spearmanRank.toFixed(3)}`);
console.log(`\nNaive baselines:`);
const flopRate = testSet.filter(f => normalizedMultiple(f.multiple, f.budget, f.year) < 1.0).length / testSet.length;
const hitRate = testSet.filter(f => normalizedMultiple(f.multiple, f.budget, f.year) >= 1.0).length / testSet.length;
console.log(`  Always predict "flop" accuracy: ${(Math.max(flopRate, hitRate) * 100).toFixed(1)}%`);
const genreMeanAcc = testSet.filter(f => {
  const gs = genreStats[f.genre];
  const pred = gs && gs.avgNormMult >= 1.0;
  const actual = normalizedMultiple(f.multiple, f.budget, f.year) >= 1.0;
  return pred === actual;
}).length / testSet.length;
console.log(`  Genre-mean threshold accuracy: ${(genreMeanAcc * 100).toFixed(1)}%`);

console.log('\nConfusion Matrix:');
console.log('               | Hit/Blockb. | Avg/Below/Flop');
console.log(`  Greenlight   |   ${String(confMatrix.GREENLIGHT.HIT).padStart(5)}     |   ${String(confMatrix.GREENLIGHT.FLOP).padStart(5)}`);
console.log(`  Conditional  |   ${String(confMatrix.CONDITIONAL.HIT).padStart(5)}     |   ${String(confMatrix.CONDITIONAL.FLOP).padStart(5)}`);
console.log(`  Dont Invest  |   ${String(confMatrix.DONT_INVEST.HIT).padStart(5)}     |   ${String(confMatrix.DONT_INVEST.FLOP).padStart(5)}`);

console.log(`\nDont Invest (OOS): ${diHit + diFlop} pred, ${diFlop} correct flops (${diHit + diFlop > 0 ? (diFlop / (diHit + diFlop) * 100).toFixed(1) : 0}% flop capture rate)`);

for (const [v, d] of Object.entries(byVerdict)) {
  const acc = d.total > 0 ? (d.correct / d.total * 100).toFixed(1) : 'N/A';
  const avgM = d.mults.length > 0 ? (d.mults.reduce((s,x) => s + x, 0) / d.mults.length).toFixed(2) : 'N/A';
  console.log(`  ${v}: ${d.total} pred, ${d.correct} correct (${acc}%), avg norm multiple: ${avgM}x`);
}

const greenlitFlops = testSet.filter(f => predict(f).verdict === 'GREENLIGHT' && normalizedMultiple(f.multiple, f.budget, f.year) < 1.0);
const flopsAvoided = testSet.filter(f => predict(f).verdict === 'DONT_INVEST' && normalizedMultiple(f.multiple, f.budget, f.year) < 1.0);
const greenlitBudget = greenlitFlops.reduce((s, f) => s + f.budget, 0);
const savedBudget = flopsAvoided.reduce((s, f) => s + f.budget, 0);
console.log(`\nGreenlit flops (OOS): ${greenlitFlops.length}, budget at risk: ₹${greenlitBudget.toFixed(0)}Cr`);
console.log(`Flops avoided (OOS): ${flopsAvoided.length}, capital preserved: ₹${savedBudget.toFixed(0)}Cr`);

console.log('\nSample errors:');
for (const e of errors.slice(0, 12)) {
  console.log(`  ${e.title} (${e.year}): ₹${e.budget}Cr, ${e.normMult}x norm, ${e.genre}, actual=${e.actual}, pred=${e.predicted} (score=${e.score})`);
}

console.log('\n=== WALK-FORWARD VALIDATION (Annual Rolling) ===\n');

const allYears = [...new Set(testable.map(f => f.year))].sort();
const yearsWithData = allYears.filter(y => testable.filter(f => f.year === y).length >= 5);
const rollingResults = [];

for (let i = 1; i < yearsWithData.length; i++) {
  const testYear = yearsWithData[i];
  const trainYears = yearsWithData.slice(0, i);
  const wfTrain = testable.filter(f => trainYears.includes(f.year));
  const wfTest = testable.filter(f => f.year === testYear);

  if (wfTest.length < 3) continue;

  const wfGenre = {}, wfBand = {}, wfGB = {}, wfActor = {}, wfDir = {}, wfCombo = {}, wfMonth = {};
  for (const f of wfTrain) {
    const wt = temporalWt(f.year);
    const band = budgetBand(f.budget);
    const gbKey = `${f.genre}|${band}`;
    const normMult = normalizedMultiple(f.multiple, f.budget, f.year);
    if (!wfGenre[f.genre]) wfGenre[f.genre] = { w: 0, t: 0, nw: 0, ac: 0 };
    wfGenre[f.genre].t += wt; if (normMult >= 1.0) { wfGenre[f.genre].w += wt; wfGenre[f.genre].nw += 1; } wfGenre[f.genre].ac += 1;
    if (!wfBand[band]) wfBand[band] = { w: 0, t: 0, nw: 0, ac: 0 };
    wfBand[band].t += wt; if (normMult >= 1.0) { wfBand[band].w += wt; wfBand[band].nw += 1; } wfBand[band].ac += 1;
    if (!wfGB[gbKey]) wfGB[gbKey] = { w: 0, t: 0, nw: 0, ac: 0 };
    wfGB[gbKey].t += wt; if (normMult >= 1.0) { wfGB[gbKey].w += wt; wfGB[gbKey].nw += 1; } wfGB[gbKey].ac += 1;
    if (!wfMonth[f.releaseMonth]) wfMonth[f.releaseMonth] = { w: 0, t: 0, nw: 0, ac: 0 };
    wfMonth[f.releaseMonth].t += wt; if (normMult >= 1.0) { wfMonth[f.releaseMonth].w += wt; wfMonth[f.releaseMonth].nw += 1; } wfMonth[f.releaseMonth].ac += 1;
    if (f.actorTier) {
      if (!wfActor[f.actorTier]) wfActor[f.actorTier] = { w: 0, t: 0, nw: 0, ac: 0 };
      wfActor[f.actorTier].t += wt; if (normMult >= 1.0) { wfActor[f.actorTier].w += wt; wfActor[f.actorTier].nw += 1; } wfActor[f.actorTier].ac += 1;
    }
    if (f.directorTier) {
      if (!wfDir[f.directorTier]) wfDir[f.directorTier] = { w: 0, t: 0, nw: 0, ac: 0 };
      wfDir[f.directorTier].t += wt; if (normMult >= 1.0) { wfDir[f.directorTier].w += wt; wfDir[f.directorTier].nw += 1; } wfDir[f.directorTier].ac += 1;
    }
    if (f.actorTier && f.directorTier) {
      const ck = f.directorTier + '+' + f.actorTier;
      if (!wfCombo[ck]) wfCombo[ck] = { w: 0, t: 0, nw: 0, ac: 0 };
      wfCombo[ck].t += wt; if (normMult >= 1.0) { wfCombo[ck].w += wt; wfCombo[ck].nw += 1; } wfCombo[ck].ac += 1;
    }
  }

  function wfStats(raw) {
    return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, {
      count: Math.round(v.t), adjNormWR: bayesianWR(v.nw, v.ac), avgMult: 0, avgNormMult: 0
    }]));
  }

  const wfGenreS = wfStats(wfGenre), wfBandS = wfStats(wfBand), wfGBS = wfStats(wfGB), wfActorS = wfStats(wfActor), wfDirS = wfStats(wfDir), wfComboS = wfStats(wfCombo), wfMonthS = wfStats(wfMonth);

  let wfCorrect = 0, wfTotal = 0;
  for (const f of wfTest) {
    const gs = wfGenreS[f.genre];
    const bs = wfBandS[budgetBand(f.budget)];
    const gb = wfGBS[`${f.genre}|${budgetBand(f.budget)}`];
    const ck = f.directorTier + '+' + f.actorTier;
    const cs = wfComboS[ck];
    const gScore = gs ? multScore(gs.adjNormWR / 33.3, 3.0) : 5;
    const gbScore = gb ? multScore(gb.adjNormWR / 33.3, 3.0) : 5;
    const bScore = bs ? multScore(bs.adjNormWR / 33.3, 3.0) : 5;
    let tScore;
    if (cs) {
      tScore = multScore(cs.adjNormWR / 33.3, 3.0);
    } else {
      const a = wfActorS[f.actorTier]; const d = wfDirS[f.directorTier];
      const aWR = a ? a.adjNormWR / 33.3 : 1.0; const dWR = d ? d.adjNormWR / 33.3 : 1.0;
      tScore = multScore(aWR * 0.45 + dWR * 0.55, 3.0);
    }
    const p = estimatePreSale(f.budget);
    const ms = wfMonthS[f.releaseMonth];
    const seasonScore = ms && ms.count >= 3 ? multScore(ms.adjNormWR / 33.3, 3.0) : 6;
    const raw = gScore * W.genre + gbScore * W.gbFit + bScore * W.budget + tScore * W.talent
      + p.score * W.preSale + 5.5 * W.concept + seasonScore * W.seasonality + 6 * W.timing + 7 * W.production + 5 * W.productionHouse;
    const total = Math.round(raw * 10 * 10) / 10;
    const pred = total >= 75 ? 'GREENLIGHT' : total >= 50 ? 'CONDITIONAL' : 'DONT_INVEST';
    const normMult = normalizedMultiple(f.multiple, f.budget, f.year);
    const actual = normMult >= 2.0 ? 'BLOCKBUSTER' : normMult >= 1.5 ? 'HIT' : normMult >= 1.0 ? 'BREAK_EVEN' : normMult >= 0.5 ? 'BELOW_AVG' : 'FLOP';

    let correct = false;
    if (pred === 'GREENLIGHT' && (actual === 'BLOCKBUSTER' || actual === 'HIT')) correct = true;
    else if (pred === 'CONDITIONAL' && (actual === 'BREAK_EVEN' || actual === 'BELOW_AVG')) correct = true;
    else if (pred === 'DONT_INVEST' && (actual === 'FLOP' || actual === 'BELOW_AVG')) correct = true;
    if (correct) wfCorrect++;
    wfTotal++;
  }

  const wfAcc = wfTotal > 0 ? (wfCorrect / wfTotal * 100).toFixed(1) : 'N/A';
  rollingResults.push({ year: testYear, trainYears: trainYears.join('-'), total: wfTotal, correct: wfCorrect, accuracy: wfAcc });
  console.log(`  ${testYear}: train ${trainYears.join('-')}, test n=${wfTotal}, acc=${wfAcc}% (${wfCorrect}/${wfTotal})`);
}

const avgWfAcc = rollingResults.length > 0
  ? (rollingResults.reduce((s, r) => s + parseFloat(r.accuracy), 0) / rollingResults.length).toFixed(1)
  : 'N/A';
console.log(`\nWalk-Forward Avg Accuracy: ${avgWfAcc}% (${rollingResults.length} rolling windows)`);

console.log('\n=== NOTE ===');
console.log('Pre-sale coverage component (22% weight) is estimated from budget bands because');
console.log('the CSV has no actual pre-sale rights data. These metrics are optimistic for that component.');
console.log('');
console.log('Note: Backtest uses simplified scoring (no ML blend, no Bayesian shrinkage).');
console.log('Raw scores cluster in 40-65 range, making threshold calibration unreliable here.');
console.log('Production thresholds must be tuned on the full engine (with ML blend).');
