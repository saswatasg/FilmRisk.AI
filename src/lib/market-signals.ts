import type { MarketSignal, MarketSignalReport, ScoreComponent, EvaluationInput } from './types'

function mockSignals(): MarketSignal[] {
  const quarter = Math.floor((new Date().getMonth() / 3))
  const sets: MarketSignal[][] = [
    [
      { category: 'economic', headline: 'RBI holds repo rate — steady credit environment for production financing', sentiment: 'positive', impact: 1.5, affectedGenres: ['Action', 'Drama'] },
      { category: 'political', headline: 'General election year — regional cinema expected to see increased footfall', sentiment: 'positive', impact: 2, affectedGenres: ['Social', 'Drama', 'Biopic'] },
      { category: 'social_trend', headline: 'Action genre trending #1 on OTT platforms for 3 consecutive months', sentiment: 'positive', impact: 2.5, affectedGenres: ['Action', 'Thriller'] },
      { category: 'industry', headline: 'OTT rights valuation up 18% YoY — strong pre-sale market', sentiment: 'positive', impact: 2, affectedGenres: ['Comedy', 'Romance'] },
      { category: 'economic', headline: 'Rising production costs in Mumbai — budget pressure on mid-range films', sentiment: 'negative', impact: -1.5, affectedGenres: ['Drama', 'Romance'] },
      { category: 'social_trend', headline: 'Comedy revival — audience craving light-hearted content post-pandemic', sentiment: 'positive', impact: 1.5, affectedGenres: ['Comedy', 'Romance'] },
    ],
    [
      { category: 'economic', headline: 'Consumer spending on entertainment up 12% — strong box office outlook', sentiment: 'positive', impact: 2.5 },
      { category: 'political', headline: 'Film-friendly state policies in Maharashtra & UP — production incentives', sentiment: 'positive', impact: 1.5, affectedGenres: ['Action', 'Drama'] },
      { category: 'social_trend', headline: 'Viral meme culture boosting niche genre awareness', sentiment: 'positive', impact: 1, affectedGenres: ['Comedy', 'Horror'] },
      { category: 'industry', headline: 'Satellite rights market compressed — down 15% from peak', sentiment: 'negative', impact: -2, affectedGenres: ['Musical', 'Family'] },
      { category: 'economic', headline: 'Inflation easing — disposable income recovery in tier-2 cities', sentiment: 'positive', impact: 1.5, affectedGenres: ['Drama', 'Comedy'] },
      { category: 'social_trend', headline: 'Horror genre gaining younger audience via social media buzz', sentiment: 'positive', impact: 2, affectedGenres: ['Horror', 'Thriller'] },
    ],
    [
      { category: 'economic', headline: 'Advertising revenue up — brand integration deals becoming lucrative', sentiment: 'positive', impact: 1.5, affectedGenres: ['Action', 'Comedy'] },
      { category: 'political', headline: 'Anti-piracy legislation tightening — better theatrical windows', sentiment: 'positive', impact: 1.5, affectedGenres: ['Action', 'Thriller'] },
      { category: 'social_trend', headline: 'Biopic fatigue setting in — audience seeking fresh stories', sentiment: 'negative', impact: -2, affectedGenres: ['Biopic', 'Biography'] },
      { category: 'industry', headline: 'Multiplex expansion in tier-3 cities — widening theatrical reach', sentiment: 'positive', impact: 2 },
      { category: 'economic', headline: 'Film insurance premiums rising — higher production overhead', sentiment: 'negative', impact: -1, affectedGenres: ['Action'] },
      { category: 'social_trend', headline: 'Short-form video driving music consumption — music rights value rising', sentiment: 'positive', impact: 1.5, affectedGenres: ['Musical', 'Romance'] },
    ],
    [
      { category: 'economic', headline: 'Rupee strengthening against USD — lower overseas production costs', sentiment: 'positive', impact: 1.5 },
      { category: 'political', headline: 'GST simplification for entertainment sector under discussion', sentiment: 'positive', impact: 1 },
      { category: 'social_trend', headline: 'Rewatching trend — cult classics finding new audience on OTT', sentiment: 'positive', impact: 1, affectedGenres: ['Drama', 'Crime'] },
      { category: 'industry', headline: 'Star power declining — content-driven films outperforming star vehicles', sentiment: 'neutral', impact: 0 },
      { category: 'economic', headline: 'Credit tightening for film financing — higher cost of capital', sentiment: 'negative', impact: -1.5, affectedGenres: ['Drama', 'Romance'] },
      { category: 'social_trend', headline: 'Sports genre riding cricket World Cup momentum', sentiment: 'positive', impact: 2, affectedGenres: ['Sports'] },
    ],
  ]
  return sets[quarter] ?? sets[0]!
}

async function fetchLiveSignals(): Promise<MarketSignal[] | null> {
  const apiKey = process.env.GNEWS_API_KEY
  if (!apiKey) return null

  try {
    const url = `https://gnews.io/api/v4/search?q=Bollywood+OR+%22Indian+cinema%22+OR+%22box+office%22&lang=en&country=in&max=6&apikey=${apiKey}`
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) })
    if (!res.ok) return null

    const data = await res.json()
    if (!data.articles || !Array.isArray(data.articles)) return null

    const signals: MarketSignal[] = data.articles.slice(0, 6).map((a: { title: string; description: string }) => {
      const title = (a.title ?? a.description ?? '').toLowerCase()
      let sentiment: 'positive' | 'negative' | 'neutral' = 'neutral'
      let impact = 0
      if (/surge|growth|record|boom|strong|positive|recovery|revival|opportunity/i.test(title)) { sentiment = 'positive'; impact = 1.5 }
      else if (/decline|drop|crisis|struggle|weak|risk|loss|slowdown|threat|fall/i.test(title)) { sentiment = 'negative'; impact = -1.5 }
      return {
        category: 'industry' as const,
        headline: a.title ?? 'Market update',
        sentiment,
        impact,
      }
    })

    return signals.length > 0 ? signals : null
  } catch {
    return null
  }
}

export async function fetchMarketSignals(): Promise<MarketSignalReport> {
  const live = await fetchLiveSignals()
  const signals = live ?? mockSignals()
  const compositeScore = signals.reduce((sum, s) => sum + s.impact, 0)
  const clamped = Math.max(-10, Math.min(10, compositeScore))

  return {
    signals,
    compositeScore: clamped,
    source: live ? 'live' : 'mock',
    timestamp: new Date().toISOString(),
  }
}

export function scoreMarketSentiment(report: MarketSignalReport, input: EvaluationInput): ScoreComponent {
  let relevantImpacts = 0
  let count = 0

  for (const signal of report.signals) {
    if (signal.affectedGenres && signal.affectedGenres.length > 0) {
      if (signal.affectedGenres.includes(input.primaryGenre)) {
        relevantImpacts += signal.impact
        count++
      }
    } else {
      relevantImpacts += signal.impact * 0.5
      count++
    }
  }

  const avgImpact = count > 0 ? relevantImpacts / count : 0
  const score = Math.max(1, Math.min(10, 5.5 + avgImpact))

  return {
    label: 'Market Sentiment',
    score: Math.round(score * 10) / 10,
    maxScore: 10,
    weight: 0.05,
    contribution: 0,
    explanation: `${report.signals.length} signals tracked · composite ${report.compositeScore > 0 ? '+' : ''}${report.compositeScore}`,
    trajectory: report.compositeScore > 1 ? 'up' : report.compositeScore < -1 ? 'down' : 'stable',
  }
}
