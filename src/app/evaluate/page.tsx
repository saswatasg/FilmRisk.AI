"use client"

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Loader2, ChevronRight, Users, Banknote, FileText, AlertCircle } from 'lucide-react'
import type { EvaluationInput, EvaluationResult } from '@/lib/types'
import { EvaluationResults } from './results'

const MONTHS = [
  { value: 1, label: 'January' }, { value: 2, label: 'February' },
  { value: 3, label: 'March' }, { value: 4, label: 'April' },
  { value: 5, label: 'May' }, { value: 6, label: 'June' },
  { value: 7, label: 'July' }, { value: 8, label: 'August' },
  { value: 9, label: 'September' }, { value: 10, label: 'October' },
  { value: 11, label: 'November' }, { value: 12, label: 'December' },
]

const GENRES = [
  'Action', 'Comedy', 'Drama', 'Romance', 'Thriller', 'Horror', 'Musical',
  'Biopic', 'Biography', 'Crime', 'Fantasy', 'Social', 'Mystery', 'Adventure',
  'Animation', 'Sports', 'War',
]

const TIERS = ['A', 'B', 'C', 'D']

const PRODUCTION_HOUSES = [
  '', 'Yash Raj Films', 'Dharma Productions', 'T-Series', 'Red Chillies Entertainment',
  'Maddock Films', 'Excel Entertainment', 'RSVP Movies', 'Viacom18 Studios',
  'PVR Pictures', 'Zee Studios', 'Pen Movies', 'Eros International',
  'Sony Pictures Networks', 'Fox Star Studios', 'Disney India',
  'UTV Motion Pictures', 'Balaji Motion Pictures', 'Tips Industries',
  'Lavender Films', 'Cine1 Studios', 'Nadiadwala Grandson',
]

function defaultInput(): EvaluationInput {
  return {
    filmTitle: '',
    primaryGenre: 'Drama',
    logline: '',
    conceptClarity: 6,
    novelty: 5,
    director: '',
    leadActor1: '',
    directorTier: 'C',
    actorTier: 'C',
    productionHouse: '',
    totalBudgetCr: 30,
    productionBudgetCr: 22,
    pAndABudgetCr: 6,
    contingencyPercent: 10,
    ottRightsCr: 0,
    satelliteRightsCr: 0,
    musicRightsCr: 0,
    overseasRightsCr: 0,
    brandRevenueCr: 0,
    financingCostCr: 0,
    theatricalSharePercent: 40,
    marketTiming: 'neutral',
    releaseMonth: 6,
  }
}

export default function EvaluatePage() {
  const [input, setInput] = useState<EvaluationInput>(defaultInput)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<EvaluationResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  function update<K extends keyof EvaluationInput>(key: K, value: EvaluationInput[K]) {
    setInput(prev => ({ ...prev, [key]: value }))
  }

  function selectUpdate<K extends keyof EvaluationInput>(key: K, value: string | null) {
    if (value !== null) update(key, value as EvaluationInput[K])
  }

  async function handleSubmit() {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Evaluation failed')
      }
      const data: EvaluationResult = await res.json()
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Film Evaluation</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Historical data-driven greenlight assessment using ~700 films with verified financials (2015–2025).
        </p>
      </div>

      <Tabs defaultValue="info" className="mb-8">
        <TabsList className="mb-6 w-full overflow-x-auto sm:w-auto">
          <TabsTrigger value="info" className="gap-2 whitespace-nowrap"><FileText className="size-4" /> Film Info</TabsTrigger>
          <TabsTrigger value="talent" className="gap-2 whitespace-nowrap"><Users className="size-4" /> Talent</TabsTrigger>
          <TabsTrigger value="budget" className="gap-2 whitespace-nowrap"><Banknote className="size-4" /> Budget & Rights</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Film Information</CardTitle>
              <CardDescription>Genre, concept, and market timing</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Film Title</Label>
                  <Input placeholder="e.g. Untitled Project" value={input.filmTitle} onChange={e => update('filmTitle', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Primary Genre</Label>
                  <Select value={input.primaryGenre} onValueChange={v => selectUpdate('primaryGenre', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {GENRES.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Logline / Concept Summary</Label>
                <Textarea
                  placeholder="Describe the film's premise and audience hook in 2-3 sentences"
                  value={input.logline}
                  onChange={e => update('logline', e.target.value)}
                  rows={3}
                />
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-3">
                  <Label>Concept Clarity: {input.conceptClarity}/10</Label>
                  <Slider min={1} max={10} value={[input.conceptClarity]} onValueChange={v => { const val = Array.isArray(v) ? v[0] : v; update('conceptClarity', val) }} />
                </div>
                <div className="space-y-3">
                  <Label>Novelty / Originality: {input.novelty}/10</Label>
                  <Slider min={1} max={10} value={[input.novelty]} onValueChange={v => { const val = Array.isArray(v) ? v[0] : v; update('novelty', val) }} />
                </div>
              </div>

              <Separator />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Release Month</Label>
                  <Select value={String(input.releaseMonth)} onValueChange={v => { const val = parseInt(v || '6'); update('releaseMonth', isNaN(val) ? 6 : val) }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MONTHS.map(m => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Market Timing</Label>
                  <Select value={input.marketTiming} onValueChange={v => selectUpdate('marketTiming', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="strong">Strong Window</SelectItem>
                      <SelectItem value="neutral">Neutral</SelectItem>
                      <SelectItem value="weak">Weak / Crowded</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="talent" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Talent Configuration</CardTitle>
              <CardDescription>Director, lead actor, and production house</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Director</Label>
                  <Input placeholder="Director name" value={input.director} onChange={e => update('director', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Director Tier</Label>
                  <Select value={input.directorTier} onValueChange={v => selectUpdate('directorTier', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TIERS.map(t => <SelectItem key={t} value={t}>{t}-Tier</SelectItem>)}
                      <SelectItem value="unknown">Unknown / Debut</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Lead Actor</Label>
                  <Input placeholder="Lead actor name" value={input.leadActor1} onChange={e => update('leadActor1', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Actor Tier</Label>
                  <Select value={input.actorTier} onValueChange={v => selectUpdate('actorTier', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TIERS.map(t => <SelectItem key={t} value={t}>{t}-Tier</SelectItem>)}
                      <SelectItem value="unknown">Unknown / Debut</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Production House</Label>
                <Select value={input.productionHouse} onValueChange={v => selectUpdate('productionHouse', v)}>
                  <SelectTrigger><SelectValue placeholder="Select production house" /></SelectTrigger>
                  <SelectContent>
                    {PRODUCTION_HOUSES.map(h => (
                      <SelectItem key={h} value={h}>{h || 'None / Unknown'}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="budget" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Budget & Rights</CardTitle>
              <CardDescription>Financial structure</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Total Budget (₹ Cr)</Label>
                  <Input type="number" min={0} step={0.5} value={input.totalBudgetCr} onChange={e => update('totalBudgetCr', parseFloat(e.target.value) || 0)} />
                </div>
                <div className="space-y-2">
                  <Label>Production Budget (₹ Cr)</Label>
                  <Input type="number" min={0} step={0.5} value={input.productionBudgetCr} onChange={e => update('productionBudgetCr', parseFloat(e.target.value) || 0)} />
                </div>
                <div className="space-y-2">
                  <Label>P&A Budget (₹ Cr)</Label>
                  <Input type="number" min={0} step={0.5} value={input.pAndABudgetCr} onChange={e => update('pAndABudgetCr', parseFloat(e.target.value) || 0)} />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Contingency (%)</Label>
                  <Input type="number" min={0} max={25} step={0.5} value={input.contingencyPercent} onChange={e => update('contingencyPercent', parseFloat(e.target.value) || 0)} />
                </div>
                <div className="space-y-2">
                  <Label>Financing Cost (₹ Cr)</Label>
                  <Input type="number" min={0} step={0.1} value={input.financingCostCr} onChange={e => update('financingCostCr', parseFloat(e.target.value) || 0)} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Revenue & Rights</CardTitle>
              <CardDescription>Pre-sold rights and theatrical assumptions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>OTT / Digital Rights (₹ Cr)</Label>
                  <Input type="number" min={0} step={0.5} value={input.ottRightsCr} onChange={e => update('ottRightsCr', parseFloat(e.target.value) || 0)} />
                  <p className="text-xs text-muted-foreground">Market: 40–60% of budget for strong projects</p>
                </div>
                <div className="space-y-2">
                  <Label>Satellite Rights (₹ Cr)</Label>
                  <Input type="number" min={0} step={0.5} value={input.satelliteRightsCr} onChange={e => update('satelliteRightsCr', parseFloat(e.target.value) || 0)} />
                  <p className="text-xs text-muted-foreground">Market: 5–15% of budget; ~10% typical post-pandemic</p>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Music Rights (₹ Cr)</Label>
                  <Input type="number" min={0} step={0.5} value={input.musicRightsCr} onChange={e => update('musicRightsCr', parseFloat(e.target.value) || 0)} />
                  <p className="text-xs text-muted-foreground">Market: 10–20% of budget</p>
                </div>
                <div className="space-y-2">
                  <Label>Overseas Rights (₹ Cr)</Label>
                  <Input type="number" min={0} step={0.5} value={input.overseasRightsCr} onChange={e => update('overseasRightsCr', parseFloat(e.target.value) || 0)} />
                  <p className="text-xs text-muted-foreground">Market: 10–25% of budget</p>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Brand Revenue (₹ Cr)</Label>
                  <Input type="number" min={0} step={0.5} value={input.brandRevenueCr} onChange={e => update('brandRevenueCr', parseFloat(e.target.value) || 0)} />
                  <p className="text-xs text-muted-foreground">Market: 5–15% of budget</p>
                </div>
                <div className="space-y-2">
                  <Label>Theatrical Share (%)</Label>
                  <Input type="number" min={10} max={70} step={1} value={input.theatricalSharePercent} onChange={e => update('theatricalSharePercent', parseFloat(e.target.value) || 40)} />
                  <p className="text-xs text-muted-foreground">Real-world: ~35–40% to producer</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex items-center gap-4">
        <Button size="lg" onClick={handleSubmit} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : null}
          {loading ? 'Evaluating...' : 'Run Evaluation'}
          {!loading && <ChevronRight className="size-4" />}
        </Button>
        <Button variant="outline" size="lg" onClick={() => { setInput(defaultInput()); setResult(null); setError(null) }}>
          Reset
        </Button>
      </div>

      {error && (
        <Card className="mt-6 border-destructive/50">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {result ? (
        <EvaluationResults result={result} className="mt-8" />
      ) : !loading && (
        <Card className="mt-8 border-dashed">
          <CardHeader>
            <CardTitle className="text-base text-muted-foreground">Quick Start</CardTitle>
            <CardDescription>Click an example to pre-fill the form and run your first evaluation</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              {EXAMPLES.map((ex, i) => (
                <button key={i} type="button" onClick={() => { setInput(ex.input); setResult(null); setError(null) }}
                  className="rounded-lg border p-4 text-left transition-colors hover:border-primary/50 hover:bg-muted/50">
                  <p className="font-medium text-sm">{ex.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{ex.genre} &middot; ₹{ex.budget}Cr</p>
                  <p className="mt-1 text-xs text-muted-foreground">{ex.description}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

const EXAMPLES = [
  {
    title: 'Mass Action Film',
    genre: 'Action',
    budget: 120,
    description: 'A-tier talent, big set pieces, strong OTT pre-sale',
    input: {
      filmTitle: 'Mass Action Film', primaryGenre: 'Action', logline: 'A high-octane action thriller set in the underbelly of Mumbai with a star-driven ensemble cast.',
      conceptClarity: 8, novelty: 5,
      director: 'Kabir Khan', leadActor1: 'Tiger Shroff', directorTier: 'B', actorTier: 'B',
      productionHouse: 'Yash Raj Films',
      totalBudgetCr: 120, productionBudgetCr: 80, pAndABudgetCr: 30, contingencyPercent: 10,
      ottRightsCr: 55, satelliteRightsCr: 15, musicRightsCr: 12, overseasRightsCr: 20, brandRevenueCr: 8,
      financingCostCr: 5, theatricalSharePercent: 40, marketTiming: 'strong' as const, releaseMonth: 11,
    },
  },
  {
    title: 'Indie Drama Debut',
    genre: 'Drama',
    budget: 15,
    description: 'Small budget, festival play, limited pre-sale',
    input: {
      filmTitle: 'Indie Drama Debut', primaryGenre: 'Drama', logline: 'A deeply personal story of a small-town musician finding her voice against all odds.',
      conceptClarity: 7, novelty: 8,
      director: 'New Director', leadActor1: 'Rising Star', directorTier: 'D', actorTier: 'C',
      productionHouse: '',
      totalBudgetCr: 15, productionBudgetCr: 11, pAndABudgetCr: 3, contingencyPercent: 7,
      ottRightsCr: 4, satelliteRightsCr: 2, musicRightsCr: 3, overseasRightsCr: 2, brandRevenueCr: 0,
      financingCostCr: 1, theatricalSharePercent: 42, marketTiming: 'neutral' as const, releaseMonth: 5,
    },
  },
  {
    title: 'Holiday Comedy',
    genre: 'Comedy',
    budget: 60,
    description: 'B-tier talent, Diwali release, strong satellite',
    input: {
      filmTitle: 'Holiday Comedy', primaryGenre: 'Comedy', logline: 'A laugh-out-loud family comedy set during Diwali, blending tradition with modern humor.',
      conceptClarity: 7, novelty: 6,
      director: 'Anees Bazmee', leadActor1: 'Kartik Aaryan', directorTier: 'C', actorTier: 'B',
      productionHouse: 'Dharma Productions',
      totalBudgetCr: 60, productionBudgetCr: 40, pAndABudgetCr: 14, contingencyPercent: 10,
      ottRightsCr: 22, satelliteRightsCr: 8, musicRightsCr: 6, overseasRightsCr: 8, brandRevenueCr: 5,
      financingCostCr: 2, theatricalSharePercent: 40, marketTiming: 'strong' as const, releaseMonth: 10,
    },
  },
]
