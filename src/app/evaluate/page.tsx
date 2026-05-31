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
import { Loader2, ChevronRight, Users, Banknote, FileText } from 'lucide-react'
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
        <TabsList className="mb-6">
          <TabsTrigger value="info" className="gap-2"><FileText className="size-4" /> Film Info</TabsTrigger>
          <TabsTrigger value="talent" className="gap-2"><Users className="size-4" /> Talent</TabsTrigger>
          <TabsTrigger value="budget" className="gap-2"><Banknote className="size-4" /> Budget & Rights</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Film Information</CardTitle>
              <CardDescription>Genre, concept, and market timing — data-backed genre viability scoring</CardDescription>
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
                  <p className="text-xs text-muted-foreground">{conceptClarityHint(input.conceptClarity)}</p>
                </div>
                <div className="space-y-3">
                  <Label>Novelty / Originality: {input.novelty}/10</Label>
                  <Slider min={1} max={10} value={[input.novelty]} onValueChange={v => { const val = Array.isArray(v) ? v[0] : v; update('novelty', val) }} />
                  <p className="text-xs text-muted-foreground">{noveltyHint(input.novelty)}</p>
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
              <CardDescription>Director and lead actor tiers — scored against historical combo win rates from the dataset</CardDescription>
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
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="budget" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Budget & Rights</CardTitle>
              <CardDescription>Financial structure — scored against historical budget band and genre performance</CardDescription>
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
              <CardDescription>Pre-sold rights and theatrical assumptions — the key financier mitigant</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>OTT / Digital Rights (₹ Cr)</Label>
                  <Input type="number" min={0} step={0.5} value={input.ottRightsCr} onChange={e => update('ottRightsCr', parseFloat(e.target.value) || 0)} />
                  <p className="text-xs text-muted-foreground">Market: 40–60% of budget for strong projects; performance-linked pricing is standard</p>
                </div>
                <div className="space-y-2">
                  <Label>Satellite Rights (₹ Cr)</Label>
                  <Input type="number" min={0} step={0.5} value={input.satelliteRightsCr} onChange={e => update('satelliteRightsCr', parseFloat(e.target.value) || 0)} />
                  <p className="text-xs text-muted-foreground">Market: 5–15% of budget (down 50%+ from pre-pandemic levels, ~10% of budget typical)</p>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Music Rights (₹ Cr)</Label>
                  <Input type="number" min={0} step={0.5} value={input.musicRightsCr} onChange={e => update('musicRightsCr', parseFloat(e.target.value) || 0)} />
                  <p className="text-xs text-muted-foreground">Market: 10–20% of budget for big films; varies by music label and star power</p>
                </div>
                <div className="space-y-2">
                  <Label>Overseas Rights (₹ Cr)</Label>
                  <Input type="number" min={0} step={0.5} value={input.overseasRightsCr} onChange={e => update('overseasRightsCr', parseFloat(e.target.value) || 0)} />
                  <p className="text-xs text-muted-foreground">Market: 10–25% of budget; heavily dependent on NRI diaspora markets</p>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Brand Revenue (₹ Cr)</Label>
                  <Input type="number" min={0} step={0.5} value={input.brandRevenueCr} onChange={e => update('brandRevenueCr', parseFloat(e.target.value) || 0)} />
                  <p className="text-xs text-muted-foreground">Market: 5–15% of budget; brand integrations are a growing revenue stream</p>
                </div>
                <div className="space-y-2">
                  <Label>Theatrical Share (%)</Label>
                  <Input type="number" min={10} max={70} step={1} value={input.theatricalSharePercent} onChange={e => update('theatricalSharePercent', parseFloat(e.target.value) || 40)} />
                  <p className="text-xs text-muted-foreground">Real-world: ~35–40% after distributor/exhibitor cuts (Week 1 multiplex: ~41% to distributor)</p>
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

      {result && <EvaluationResults result={result} className="mt-8" />}
    </div>
  )
}

function conceptClarityHint(v: number): string {
  if (v >= 8) return 'Well-defined premise with clear audience hook and market positioning'
  if (v >= 5) return 'Adequate clarity — consider sharpening the logline'
  return 'Concept needs more definition to assess market viability'
}

function noveltyHint(v: number): string {
  if (v >= 7) return 'Fresh concept with distinct original elements'
  if (v >= 4) return 'Moderately original — some familiar elements'
  return 'Heavily derivative — higher novelty strengthens the case'
}
