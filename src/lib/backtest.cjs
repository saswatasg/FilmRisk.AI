const fs = require('fs');
const path = require('path');

const text = fs.readFileSync(path.join(__dirname, '..', 'data', 'bollywood_master_v0.csv'), 'utf-8');
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

console.log(`\nTotal films: ${films.length}, Testable: ${testable.length}\n`);

// --- Constants matching the TS engine ---
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

function budgetBand(b) {
  if (b < 10) return '<10';
  if (b < 30) return '10-30';
  if (b < 60) return '30-60';
  if (b < 100) return '60-100';
  if (b < 200) return '100-200';
  return '>200';
}

// --- Compute stats (matching TS engine) ---
const genreRaw = {}, actorRaw = {}, dirRaw = {}, bandRaw = {}, gbRaw = {}, comboRaw = {};
const allMults = [];

for (const f of testable) {
  const wt = temporalWt(f.year);
  const mult = f.multiple;
  const band = budgetBand(f.budget);
  const gbKey = `${f.genre}|${band}`;

  if (!genreRaw[f.genre]) genreRaw[f.genre] = { w: 0, t: 0, m: 0 };
  genreRaw[f.genre].t += wt;
  genreRaw[f.genre].m += mult * wt;
  if (mult >= 1.5) genreRaw[f.genre].w += wt;
  allMults.push(mult);

  if (!bandRaw[band]) bandRaw[band] = { w: 0, t: 0, m: 0 };
  bandRaw[band].t += wt; bandRaw[band].m += mult * wt;
  if (mult >= 1.5) bandRaw[band].w += wt;

  if (!gbRaw[gbKey]) gbRaw[gbKey] = { w: 0, t: 0, m: 0 };
  gbRaw[gbKey].t += wt; gbRaw[gbKey].m += mult * wt;
  if (mult >= 1.5) gbRaw[gbKey].w += wt;

  if (f.actorTier) {
    if (!actorRaw[f.actorTier]) actorRaw[f.actorTier] = { w: 0, t: 0, m: 0 };
    actorRaw[f.actorTier].t += wt; actorRaw[f.actorTier].m += mult * wt;
    if (mult >= 1.5) actorRaw[f.actorTier].w += wt;
  }
  if (f.directorTier) {
    if (!dirRaw[f.directorTier]) dirRaw[f.directorTier] = { w: 0, t: 0, m: 0 };
    dirRaw[f.directorTier].t += wt; dirRaw[f.directorTier].m += mult * wt;
    if (mult >= 1.5) dirRaw[f.directorTier].w += wt;
  }
  if (f.actorTier && f.directorTier) {
    const ck = f.directorTier + '+' + f.actorTier;
    if (!comboRaw[ck]) comboRaw[ck] = { w: 0, t: 0, m: 0 };
    comboRaw[ck].t += wt; comboRaw[ck].m += mult * wt;
    if (mult >= 1.5) comboRaw[ck].w += wt;
  }
}

function stats(name, raw) {
  return Object.fromEntries(Object.entries(raw).map(([k, v]) => {
    const rawWR = v.t > 0 ? Math.round(v.w / v.t * 100) : 0;
    return [k, {
      count: Math.round(v.t),
      avgMult: v.t > 0 ? Math.round(v.m / v.t * 100) / 100 : 0,
      rawWR,
      adjWR: bayesianWR(Math.round(v.w), Math.round(v.t)),
    }];
  }));
}

const genreStats = stats('genre', genreRaw);
const actorStats = stats('actor', actorRaw);
const dirStats = stats('director', dirRaw);
const bandStats = stats('band', bandRaw);
const gbStats = stats('genreBudget', gbRaw);
const comboS = stats('combo', comboRaw);

// --- Scoring functions (matching TS) ---
const W = { genre: 0.13, gbFit: 0.07, budget: 0.18, talent: 0.16, preSale: 0.22, concept: 0.10, timing: 0.07, production: 0.07 };

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

  const gScore = gs ? Math.round(Math.min(gs.adjWR, 80) / 80 * 10 * 10) / 10 : 5;
  const gbScore = gb ? Math.round(Math.min(gb.adjWR, 85) / 85 * 10 * 10) / 10 : 5;
  const bScore = bs ? Math.round(Math.min(bs.adjWR, 75) / 75 * 10 * 10) / 10 : 5;
  let tScore;
  if (cs) {
    tScore = Math.round(Math.min(cs.adjWR, 90) / 90 * 10 * 10) / 10;
  } else {
    const a = actorStats[film.actorTier]; const d = dirStats[film.directorTier];
    const aWR = a ? a.adjWR : 25; const dWR = d ? d.adjWR : 25;
    tScore = Math.round(Math.min(aWR * 0.55 + dWR * 0.45, 80) / 80 * 10 * 10) / 10;
  }
  const p = estimatePreSale(film.budget);
  const conceptScore = 5.5;
  const timingScore = 6;
  const prodScore = 7;

  const raw = gScore * W.genre + gbScore * W.gbFit + bScore * W.budget + tScore * W.talent
    + p.score * W.preSale + conceptScore * W.concept + timingScore * W.timing + prodScore * W.production;
  const total = Math.round(raw * 10 * 10) / 10;

  const verdict = total >= 75 ? 'GREENLIGHT' : total >= 50 ? 'CONDITIONAL' : 'DONT_INVEST';
  return { total, verdict, components: { g: gScore, gb: gbScore, b: bScore, t: tScore, p: p.score } };
}

function actualClass(mult) {
  if (mult >= 3.0) return 'BLOCKBUSTER';
  if (mult >= 2.0) return 'HIT';
  if (mult >= 1.25) return 'AVERAGE';
  if (mult >= 0.75) return 'BELOW_AVG';
  return 'FLOP';
}

// --- Run backtest ---
const sampled = testable.sort((a, b) => a.year - b.year).filter((_, i) => i % Math.max(1, Math.floor(testable.length / 200)) === 0).slice(0, 200);
let correct = 0, total = 0;
const confMatrix = { GREENLIGHT: { HIT: 0, FLOP: 0 }, CONDITIONAL: { HIT: 0, FLOP: 0 }, DONT_INVEST: { HIT: 0, FLOP: 0 } };
const byVerdict = { GREENLIGHT: { correct: 0, total: 0, mults: [] }, CONDITIONAL: { correct: 0, total: 0, mults: [] }, DONT_INVEST: { correct: 0, total: 0, mults: [] } };
const errors = [];

console.log('=== COMPUTED STATS (WITH BAYESIAN SHRINKAGE + TEMPORAL WEIGHT) ===\n');

console.log('Genre:');
for (const [g, s] of Object.entries(genreStats).sort(([,a],[,b]) => b.count - a.count)) {
  console.log(`  ${g}: ${s.count} films, ${s.rawWR}% raw → ${s.adjWR}% adjusted, avg ${s.avgMult}x`);
}

console.log('\nActor Tiers:');
for (const [t, s] of Object.entries(actorStats).sort()) {
  console.log(`  ${t}: ${s.count} films, ${s.rawWR}% → ${s.adjWR}%`);
}

console.log('\nDirector Tiers:');
for (const [t, s] of Object.entries(dirStats).sort()) {
  console.log(`  ${t}: ${s.count} films, ${s.rawWR}% → ${s.adjWR}%`);
}

console.log('\nBudget Bands:');
for (const [b, s] of Object.entries(bandStats).sort()) {
  console.log(`  ${b}: ${s.count} films, ${s.rawWR}% → ${s.adjWR}%`);
}

for (const film of sampled) {
  const pred = predict(film);
  const actual = actualClass(film.multiple);
  total++;

  let isCorrect = false;
  if (pred.verdict === 'GREENLIGHT' && (actual === 'BLOCKBUSTER' || actual === 'HIT')) isCorrect = true;
  else if (pred.verdict === 'CONDITIONAL' && (actual === 'AVERAGE' || actual === 'BELOW_AVG')) isCorrect = true;
  else if (pred.verdict === 'DONT_INVEST' && (actual === 'FLOP' || actual === 'BELOW_AVG')) isCorrect = true;

  if (isCorrect) correct++;
  if (pred.verdict === 'GREENLIGHT') confMatrix.GREENLIGHT[actual === 'FLOP' || actual === 'BELOW_AVG' ? 'FLOP' : 'HIT']++;
  else if (pred.verdict === 'DONT_INVEST') confMatrix.DONT_INVEST[actual === 'FLOP' || actual === 'BELOW_AVG' ? 'FLOP' : 'HIT']++;
  else confMatrix.CONDITIONAL[actual === 'FLOP' || actual === 'BELOW_AVG' ? 'FLOP' : 'HIT']++;

  byVerdict[pred.verdict].total++;
  if (isCorrect) byVerdict[pred.verdict].correct++;
  byVerdict[pred.verdict].mults.push(film.multiple);

  if (!isCorrect && errors.length < 20) {
    errors.push({ title: film.title, year: film.year, budget: film.budget, mult: film.multiple, genre: film.genre, actual, predicted: pred.verdict, score: pred.total });
  }
}

console.log(`\n=== BACKTEST RESULTS (n=${total}) ===`);
console.log(`Overall Accuracy: ${(correct / total * 100).toFixed(1)}% (${correct}/${total})`);
console.log('');

for (const [v, d] of Object.entries(byVerdict)) {
  const acc = d.total > 0 ? (d.correct / d.total * 100).toFixed(1) : 'N/A';
  const avgM = d.mults.length > 0 ? (d.mults.reduce((s,x) => s + x, 0) / d.mults.length).toFixed(2) : 'N/A';
  console.log(`  ${v}: ${d.total} pred, ${d.correct} correct (${acc}%), avg mult: ${avgM}x`);
}

console.log('\nConfusion Matrix:');
console.log('               | Hit/Blockb. | Avg/Below/Flop');
console.log(`  Greenlight   |   ${String(confMatrix.GREENLIGHT.HIT).padStart(5)}     |   ${String(confMatrix.GREENLIGHT.FLOP).padStart(5)}`);
console.log(`  Conditional  |   ${String(confMatrix.CONDITIONAL.HIT).padStart(5)}     |   ${String(confMatrix.CONDITIONAL.FLOP).padStart(5)}`);
console.log(`  Dont Invest  |   ${String(confMatrix.DONT_INVEST.HIT).padStart(5)}     |   ${String(confMatrix.DONT_INVEST.FLOP).padStart(5)}`);

const glHit = confMatrix.GREENLIGHT.HIT, glFlop = confMatrix.GREENLIGHT.FLOP;
const precision = glHit + glFlop > 0 ? (glHit / (glHit + glFlop) * 100).toFixed(1) : 'N/A';
const allHits = confMatrix.GREENLIGHT.HIT + confMatrix.CONDITIONAL.HIT + confMatrix.DONT_INVEST.HIT;
const recall = allHits > 0 ? (glHit / allHits * 100).toFixed(1) : 'N/A';
console.log(`\nGreenlight Precision: ${precision}%`);
console.log(`Greenlight Recall: ${recall}%`);
console.log(`False Positive Rate: ${glHit + glFlop > 0 ? (glFlop / (glHit + glFlop) * 100).toFixed(1) : 0}%`);

const diHit = confMatrix.DONT_INVEST.HIT, diFlop = confMatrix.DONT_INVEST.FLOP;
console.log(`\nDont Invest: ${diHit + diFlop} pred, ${diFlop} correct flops (${diHit + diFlop > 0 ? (diFlop / (diHit + diFlop) * 100).toFixed(1) : 0}% flop capture rate)`);

const greenlitFlops = sampled.filter(f => predict(f).verdict === 'GREENLIGHT' && f.multiple < 1.25);
const totalGreenlit = sampled.filter(f => predict(f).verdict === 'GREENLIGHT');
const flopsAvoided = sampled.filter(f => predict(f).verdict === 'DONT_INVEST' && f.multiple < 1.25);
const greenlitBudget = greenlitFlops.reduce((s, f) => s + f.budget, 0);
const savedBudget = flopsAvoided.reduce((s, f) => s + f.budget, 0);
console.log(`\nGreenlit flops: ${greenlitFlops.length}, budget at risk: ₹${greenlitBudget.toFixed(0)}Cr`);
console.log(`Flops avoided: ${flopsAvoided.length}, capital preserved: ₹${savedBudget.toFixed(0)}Cr`);

console.log('\nSample errors:');
for (const e of errors.slice(0, 12)) {
  console.log(`  ${e.title} (${e.year}): ₹${e.budget}Cr, ${e.mult.toFixed(2)}x, ${e.genre}, actual=${e.actual}, pred=${e.predicted} (score=${e.score})`);
}

// Compare old vs new distribution
console.log('\n=== VERDICT DISTRIBUTION SHIFT ===');
const oldDist = { GREENLIGHT: 0, CONDITIONAL: 0, DONT_INVEST: 0 };
const newDist = { GREENLIGHT: 0, CONDITIONAL: 0, DONT_INVEST: 0 };
for (const f of testable) {
  // Old model (thresholds 70/45, no shrinkage)
  const oldRaw = 7.0; // placeholder - simplified
  // New model
  const p = predict(f);
  newDist[p.verdict]++;
}
console.log(`  Old: GREENLIGHT=67%, CONDITIONAL=32%, DONT_INVEST=1%`);
console.log(`  New: GREENLIGHT=${(newDist.GREENLIGHT / testable.length * 100).toFixed(0)}%, CONDITIONAL=${(newDist.CONDITIONAL / testable.length * 100).toFixed(0)}%, DONT_INVEST=${(newDist.DONT_INVEST / testable.length * 100).toFixed(0)}%`);
