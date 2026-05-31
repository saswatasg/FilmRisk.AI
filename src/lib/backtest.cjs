const fs = require('fs');
const path = require('path');

// Load CSV
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

// Build films with computed gross_multiple
const films = rows.map(r => {
  const budget = n(r[h.indexOf('budget_cr')]);
  const gross = n(r[h.indexOf('worldwide_gross_cr')]);
  return {
    film_id: p(r[h.indexOf('film_id')]),
    title: p(r[h.indexOf('display_title')]),
    year: n(r[h.indexOf('release_year')]) || 0,
    genre: p(r[h.indexOf('primary_genre')]),
    director: p(r[h.indexOf('director')]),
    actor: p(r[h.indexOf('lead_actor_1')]),
    actorTier: p(r[h.indexOf('actor_tier_proxy')]),
    directorTier: p(r[h.indexOf('director_tier_proxy')]),
    budget,
    gross,
    multiple: budget && gross && budget > 0 ? gross / budget : null,
    verdict: p(r[h.indexOf('verdict_raw')]),
    hitflop: n(r[h.indexOf('hitflop_numeric')]),
    confidence: p(r[h.indexOf('financial_data_confidence')]),
  };
});

// Filter to films with enough data for testing
const testable = films.filter(f =>
  f.budget !== null && f.budget > 0 &&
  f.multiple !== null && f.multiple > 0 &&
  f.actorTier && f.directorTier &&
  f.actorTier !== '' && f.directorTier !== ''
);

console.log(`\nTotal films in dataset: ${films.length}`);
console.log(`Films with budget + gross + tiers: ${testable.length}`);

// Classify actual outcome
function actualClass(multiple, genre, budget) {
  // Using gross multiple as ground truth
  if (multiple >= 3.0) return 'BLOCKBUSTER';   // >3x = blockbuster
  if (multiple >= 2.0) return 'HIT';            // 2-3x = hit
  if (multiple >= 1.25) return 'AVERAGE';       // 1.25-2x = average
  if (multiple >= 0.75) return 'BELOW_AVG';     // 0.75-1.25x = below average
  return 'FLOP';                                 // <0.75x = flop
}

// Now replicate the scoring engine in JS (simplified from the TS source)
// Dataset stats computed on the fly
function computeStats(films) {
  const genreStats = {};
  const actorStats = {};
  const dirStats = {};
  const comboStats = {};
  const bandStats = {};
  const allMults = [];

  for (const f of films) {
    if (!f.multiple) continue;
    allMults.push(f.multiple);

    // Genre
    if (!genreStats[f.genre]) genreStats[f.genre] = { count: 0, withGross: 0, multSum: 0, winners: 0 };
    genreStats[f.genre].count++;
    genreStats[f.genre].withGross++;
    genreStats[f.genre].multSum += f.multiple;
    if (f.multiple >= 1.5) genreStats[f.genre].winners++;

    // Budget band
    const band = budgetBand(f.budget);
    if (!bandStats[band]) bandStats[band] = { count: 0, multSum: 0, winners: 0 };
    bandStats[band].count++;
    bandStats[band].multSum += f.multiple;
    if (f.multiple >= 1.5) bandStats[band].winners++;

    // Actor tier
    if (f.actorTier) {
      if (!actorStats[f.actorTier]) actorStats[f.actorTier] = { count: 0, multSum: 0, winners: 0 };
      actorStats[f.actorTier].count++;
      actorStats[f.actorTier].multSum += f.multiple;
      if (f.multiple >= 1.5) actorStats[f.actorTier].winners++;
    }

    // Director tier
    if (f.directorTier) {
      if (!dirStats[f.directorTier]) dirStats[f.directorTier] = { count: 0, multSum: 0, winners: 0 };
      dirStats[f.directorTier].count++;
      dirStats[f.directorTier].multSum += f.multiple;
      if (f.multiple >= 1.5) dirStats[f.directorTier].winners++;
    }

    // Combo
    if (f.actorTier && f.directorTier) {
      const key = f.directorTier + '+' + f.actorTier;
      if (!comboStats[key]) comboStats[key] = { count: 0, multSum: 0, winners: 0 };
      comboStats[key].count++;
      comboStats[key].multSum += f.multiple;
      if (f.multiple >= 1.5) comboStats[key].winners++;
    }
  }

  const sorted = [...allMults].sort((a, b) => a - b);
  const len = sorted.length;

  return {
    genreStats: Object.fromEntries(Object.entries(genreStats).map(([k, v]) => [k, { count: v.count, withGross: v.withGross, avgMultiple: v.multSum / v.withGross, winRatePct: Math.round((v.winners / v.withGross) * 100) }])),
    actorStats: Object.fromEntries(Object.entries(actorStats).map(([k, v]) => [k, { count: v.count, avgMultiple: v.multSum / v.count, winRatePct: Math.round((v.winners / v.count) * 100) }])),
    dirStats: Object.fromEntries(Object.entries(dirStats).map(([k, v]) => [k, { count: v.count, avgMultiple: v.multSum / v.count, winRatePct: Math.round((v.winners / v.count) * 100) }])),
    comboStats: Object.fromEntries(Object.entries(comboStats).filter(([, v]) => v.count >= 3).map(([k, v]) => [k, { count: v.count, winRatePct: Math.round((v.winners / v.count) * 100), avgMultiple: v.multSum / v.count }])),
    bandStats: Object.fromEntries(Object.entries(bandStats).map(([k, v]) => [k, { count: v.count, winRatePct: Math.round((v.winners / v.count) * 100), avgMultiple: v.multSum / v.count }])),
    percentiles: {
      p10: sorted[Math.floor(len * 0.1)],
      p25: sorted[Math.floor(len * 0.25)],
      p50: sorted[Math.floor(len * 0.5)],
      p75: sorted[Math.floor(len * 0.75)],
      p90: sorted[Math.floor(len * 0.9)],
    }
  };
}

function budgetBand(b) {
  if (b < 10) return '<10';
  if (b < 30) return '10-30';
  if (b < 60) return '30-60';
  if (b < 100) return '60-100';
  if (b < 200) return '100-200';
  return '>200';
}

// Replicate the greenlight scoring
function scoreGenre(film, stats) {
  const g = stats.genreStats[film.genre];
  if (!g || g.count < 3) return { score: 5, expl: `${film.genre}: insufficient data` };
  const winRate = g.winRatePct;
  const score = Math.round(Math.min(winRate, 90) / 90 * 10 * 10) / 10;
  return { score, expl: `${film.genre}: ${winRate}% WR (${g.count} films, avg ${g.avgMultiple.toFixed(2)}x)` };
}

function scoreBudget(film, stats) {
  const band = budgetBand(film.budget);
  const b = stats.bandStats[band];
  if (!b) return { score: 5, expl: `${band}: no data` };
  const score = Math.round(Math.min(b.winRatePct, 80) / 80 * 10 * 10) / 10;
  return { score, expl: `${band}: ${b.winRatePct}% WR (${b.count} films, avg ${b.avgMultiple.toFixed(2)}x)` };
}

function scoreTalent(film, stats) {
  const comboKey = film.directorTier + '+' + film.actorTier;
  const combo = stats.comboStats[comboKey];
  if (combo && combo.count >= 3) {
    const score = Math.round(Math.min(combo.winRatePct, 95) / 95 * 10 * 10) / 10;
    return { score, expl: `${film.directorTier}+${film.actorTier}: ${combo.winRatePct}% WR (${combo.count})` };
  }
  const a = stats.actorStats[film.actorTier];
  const d = stats.dirStats[film.directorTier];
  const aWR = a ? a.winRatePct : 30;
  const dWR = d ? d.winRatePct : 30;
  const composite = aWR * 0.55 + dWR * 0.45;
  const score = Math.round(Math.min(composite, 90) / 90 * 10 * 10) / 10;
  return { score, expl: `Dir${film.directorTier}(${dWR}%)+Act${film.actorTier}(${aWR}%)` };
}

// Simulate pre-sale coverage based on reasonable assumptions from budget
function estimatePreSaleCoverage(budget) {
  // For backtesting, estimate realistic pre-sale coverage based on budget and era
  // Larger films tend to have better pre-sale coverage
  if (budget > 150) return { score: 7, ratio: 0.55 };  // 55% coverage
  if (budget > 60) return { score: 5.5, ratio: 0.40 }; // 40% coverage
  if (budget > 30) return { score: 4.5, ratio: 0.30 }; // 30% coverage
  return { score: 3, ratio: 0.20 };                      // 20% coverage
}

function predictGreenlight(film, stats) {
  const w = { genre: 0.15, budget: 0.20, talent: 0.18, preSale: 0.20, concept: 0.12, timing: 0.08, production: 0.07 };
  const g = scoreGenre(film, stats);
  const b = scoreBudget(film, stats);
  const t = scoreTalent(film, stats);
  const p = estimatePreSaleCoverage(film.budget);

  // Concept: we don't have this data, so use a medium score
  const conceptScore = 5.5;

  // Market timing: neutral by default
  const timingScore = 6;

  // Production viability: assume reasonable allocation
  const prodScore = 7;

  const raw = g.score * w.genre
    + b.score * w.budget
    + t.score * w.talent
    + p.score * w.preSale
    + conceptScore * w.concept
    + timingScore * w.timing
    + prodScore * w.production;

  // Convert from 0-10 scale to 0-100
  const total = Math.round(raw * 10 * 10) / 10;

  const verdict = total >= 70 ? 'GREENLIGHT' : total >= 45 ? 'CONDITIONAL' : 'DONT_INVEST';
  return { total, verdict, components: { genre: g.score, budget: b.score, talent: t.score, preSale: p.score } };
}

// Now run the backtest
const stats = computeStats(testable);

console.log('\n=== DATASET STATS ===');
console.log(`Multiple percentiles: P10=${stats.percentiles.p10.toFixed(2)}, P25=${stats.percentiles.p25.toFixed(2)}, P50=${stats.percentiles.p50.toFixed(2)}, P75=${stats.percentiles.p75.toFixed(2)}, P90=${stats.percentiles.p90.toFixed(2)}`);

console.log('\n=== GENRE STATS ===');
for (const [g, s] of Object.entries(stats.genreStats).sort(([,a],[,b]) => b.count - a.count)) {
  console.log(`  ${g}: ${s.count} films, ${s.winRatePct}% WR, avg ${s.avgMultiple.toFixed(2)}x`);
}

console.log('\n=== BACKTEST RESULTS ===');
let correct = 0;
let total = 0;
const breakdown = { GREENLIGHT: { correct: 0, total: 0, actualMults: [] }, CONDITIONAL: { correct: 0, total: 0, actualMults: [] }, DONT_INVEST: { correct: 0, total: 0, actualMults: [] } };
const errors = [];
const confMatrix = { GREENLIGHT: { HIT: 0, FLOP: 0 }, CONDITIONAL: { HIT: 0, FLOP: 0 }, DONT_INVEST: { HIT: 0, FLOP: 0 } };

// Sample ~100-150 films spread across eras
const testFilms = testable.sort((a, b) => a.year - b.year);
// Take every Nth film to get ~150 samples spread across the dataset
const step = Math.max(1, Math.floor(testFilms.length / 150));
const sampled = testFilms.filter((_, i) => i % step === 0).slice(0, 200);

for (const film of sampled) {
  const pred = predictGreenlight(film, stats);
  const actual = actualClass(film.multiple, film.genre, film.budget);

  total++;

  // Determine if prediction was correct
  let isCorrect = false;
  if (pred.verdict === 'GREENLIGHT' && (actual === 'BLOCKBUSTER' || actual === 'HIT')) isCorrect = true;
  else if (pred.verdict === 'CONDITIONAL' && (actual === 'AVERAGE' || actual === 'BELOW_AVG')) isCorrect = true;
  else if (pred.verdict === 'DONT_INVEST' && (actual === 'FLOP' || actual === 'BELOW_AVG')) isCorrect = true;

  if (isCorrect) correct++;

  // Track confusion
  if (pred.verdict === 'GREENLIGHT') confMatrix.GREENLIGHT[actual === 'FLOP' || actual === 'BELOW_AVG' ? 'FLOP' : 'HIT']++;
  else if (pred.verdict === 'DONT_INVEST') confMatrix.DONT_INVEST[actual === 'FLOP' || actual === 'BELOW_AVG' ? 'FLOP' : 'HIT']++;
  else confMatrix.CONDITIONAL[actual === 'FLOP' || actual === 'BELOW_AVG' ? 'FLOP' : 'HIT']++;

  breakdown[pred.verdict].total++;
  if (isCorrect) breakdown[pred.verdict].correct++;
  breakdown[pred.verdict].actualMults.push(film.multiple);

  if (!isCorrect && errors.length < 30) {
    errors.push({ title: film.title, year: film.year, budget: film.budget, mult: film.multiple, genre: film.genre, actual, predicted: pred.verdict, score: pred.total, components: pred.components });
  }
}

console.log(`\nTotal tested: ${total}`);
console.log(`Correct: ${correct}`);
console.log(`Accuracy: ${(correct / total * 100).toFixed(1)}%\n`);

console.log('=== BY PREDICTED VERDICT ===');
for (const [v, d] of Object.entries(breakdown)) {
  const acc = d.total > 0 ? (d.correct / d.total * 100).toFixed(1) : 'N/A';
  const avgMult = d.actualMults.length > 0 ? (d.actualMults.reduce((s, x) => s + x, 0) / d.actualMults.length).toFixed(2) : 'N/A';
  console.log(`  ${v}: ${d.total} predictions, ${d.correct} correct (${acc}%), avg actual mult: ${avgMult}x`);
}

console.log('\n=== CONFUSION MATRIX ===');
console.log('               | Actual Hit  | Actual Flop');
console.log('  Greenlight   |     ' + String(confMatrix.GREENLIGHT.HIT).padStart(4) + '     |     ' + String(confMatrix.GREENLIGHT.FLOP).padStart(4));
console.log('  Conditional  |     ' + String(confMatrix.CONDITIONAL.HIT).padStart(4) + '     |     ' + String(confMatrix.CONDITIONAL.FLOP).padStart(4));
console.log('  Dont Invest  |     ' + String(confMatrix.DONT_INVEST.HIT).padStart(4) + '     |     ' + String(confMatrix.DONT_INVEST.FLOP).padStart(4));

// Precision / Recall for Greenlight
const glHit = confMatrix.GREENLIGHT.HIT;
const glFlop = confMatrix.GREENLIGHT.FLOP;
const precision = glHit + glFlop > 0 ? (glHit / (glHit + glFlop) * 100).toFixed(1) : 'N/A';
const allHits = confMatrix.GREENLIGHT.HIT + confMatrix.CONDITIONAL.HIT + confMatrix.DONT_INVEST.HIT;
const recall = allHits > 0 ? (glHit / allHits * 100).toFixed(1) : 'N/A';
console.log(`\nGreenlight Precision: ${precision}% (of films we greenlit, how many actually hit)`);
console.log(`Greenlight Recall: ${recall}% (of actual hits, how many we correctly greenlit)`);

// False positive / false negative rates
console.log(`\nFalse Positive Rate: ${glFlop}/${glHit + glFlop} = ${glHit + glFlop > 0 ? (glFlop / (glHit + glFlop) * 100).toFixed(1) : 0}%`);
const diHit = confMatrix.DONT_INVEST.HIT;
const diFlop = confMatrix.DONT_INVEST.FLOP;
console.log(`Dont Invest Accuracy: ${diFlop}/${diHit + diFlop} = ${diHit + diFlop > 0 ? (diFlop / (diHit + diFlop) * 100).toFixed(1) : 0}% of flops correctly flagged`);

console.log('\n=== SAMPLE ERRORS (first 15) ===');
for (const e of errors.slice(0, 15)) {
  console.log(`  ${e.title} (${e.year}): ₹${e.budget}Cr, ${e.mult.toFixed(2)}x, ${e.genre}, actual=${e.actual}, pred=${e.predicted} (score=${e.score})`);
}

// Also compute a simplified "usefulness" metric
// If we only greenlit films that went on to be hits (>=2x), how much money would we save?
const greenlitFlops = testable.filter(f => {
  const pred = predictGreenlight(f, stats);
  return pred.verdict === 'GREENLIGHT' && f.multiple < 1.25;
});
const totalGreenlit = testable.filter(f => predictGreenlight(f, stats).verdict === 'GREENLIGHT');
const flopsAvoided = testable.filter(f => {
  const pred = predictGreenlight(f, stats);
  return pred.verdict === 'DONT_INVEST' && f.multiple < 1.25;
});
console.log(`\n=== ECONOMIC IMPACT ===`);
console.log(`Films greenlit: ${totalGreenlit.length}`);
console.log(`Greenlit films that flopped (<1.25x): ${greenlitFlops.length}`);
const flopBudget = greenlitFlops.reduce((s, f) => s + f.budget, 0);
console.log(`Total budget at risk on greenlit flops: ₹${flopBudget.toFixed(0)}Cr`);
console.log(`Flops correctly avoided (Dont Invest that would have flopped): ${flopsAvoided.length}`);
const savedBudget = flopsAvoided.reduce((s, f) => s + f.budget, 0);
console.log(`Estimated capital preserved by avoiding flops: ₹${savedBudget.toFixed(0)}Cr`);
