/* Shared defaults for the evaluate flow (Typeform-style) and its parity tests.
   Single source of truth: the flow and scripts/verify-flow.ts both import this. */
import type { EvaluationInput } from './types'

export const FLOW_STORAGE_KEY = 'greenlit-evaluate-flow'

export const BUDGET_PROD_PCT = 0.60
export const BUDGET_PA_PCT = 0.25
export const BUDGET_CONTINGENCY = 10
export const BUDGET_FINANCE_PCT = 0.05
export const THEATRICAL_PCT = 40

export const PRESALE_PCT = {
  ott: 0.50, satellite: 0.12, music: 0.15, overseas: 0.18, brand: 0.05,
}

export function r1(v: number): number { return Math.round(v * 10) / 10 }

export const FLOW_DEFAULTS: EvaluationInput = (() => {
  const budget = 30
  return {
    filmTitle: '',
    primaryGenre: 'Drama',
    secondaryGenre: '',
    sequelFlag: false,
    logline: '',
    conceptClarity: 6,
    novelty: 5,
    director: '',
    leadActor1: '',
    directorTier: 'C',
    actorTier: 'C',
    productionHouse: '',
    totalBudgetCr: budget,
    productionBudgetCr: r1(budget * BUDGET_PROD_PCT),
    pAndABudgetCr: r1(budget * BUDGET_PA_PCT),
    contingencyPercent: BUDGET_CONTINGENCY,
    financingCostCr: r1(budget * BUDGET_FINANCE_PCT),
    ottRightsCr: 0,
    satelliteRightsCr: 0,
    musicRightsCr: 0,
    overseasRightsCr: 0,
    brandRevenueCr: 0,
    theatricalSharePercent: THEATRICAL_PCT,
    marketTiming: 'neutral',
    releaseMonth: 6,
  }
})()

export const GENRES_20 = [
  'Action', 'Adventure', 'Animation', 'Biography', 'Comedy', 'Crime', 'Documentary',
  'Drama', 'Family', 'Fantasy', 'Historical', 'Horror', 'Music', 'Musical', 'Mystery',
  'Romance', 'Social', 'Sport', 'Thriller', 'War',
]

export const PRODUCTION_HOUSES_21 = [
  '', 'Yash Raj Films', 'Dharma Productions', 'T-Series', 'Red Chillies Entertainment',
  'Maddock Films', 'Excel Entertainment', 'RSVP Movies', 'Viacom18 Studios',
  'PVR Pictures', 'Zee Studios', 'Pen Movies', 'Eros International',
  'Sony Pictures Networks', 'Fox Star Studios', 'Disney India',
  'UTV Motion Pictures', 'Balaji Motion Pictures', 'Tips Industries',
  'Lavender Films', 'Cine1 Studios', 'Nadiadwala Grandson',
]

export const MONTHS_12 = [
  { value: 1, label: 'Jan' }, { value: 2, label: 'Feb' }, { value: 3, label: 'Mar' },
  { value: 4, label: 'Apr' }, { value: 5, label: 'May' }, { value: 6, label: 'Jun' },
  { value: 7, label: 'Jul' }, { value: 8, label: 'Aug' }, { value: 9, label: 'Sep' },
  { value: 10, label: 'Oct' }, { value: 11, label: 'Nov' }, { value: 12, label: 'Dec' },
]
