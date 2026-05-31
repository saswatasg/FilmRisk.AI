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
import { Loader2, ChevronRight, Film, Users, Banknote, FileText } from 'lucide-react'
import type { EvaluationInput, EvaluationResult } from '@/lib/types'
import { EvaluationResults } from './results'

const GENRES = [
  'Action', 'Comedy', 'Drama', 'Romance', 'Thriller', 'Horror', 'Musical',
  'Biopic', 'Historical', 'Sci-Fi', 'Fantasy', 'Crime', 'Social', 'Family',
  'Animation', 'Documentary', 'Mythological',
]

const TIERS = ['A', 'B', 'C', 'D']

function defaultInput(): EvaluationInput {
  return {
    filmTitle: '',
    primaryGenre: 'Drama',
    secondaryGenre: '',
    logline: '',
    conceptClarity: 6,
    novelty: 5,
    director: '',
    leadActor1: '',
    leadActor2: '',
    directorTier: 'C',
    actorTier: 'C',
    totalBudgetCr: 30,
    pAndABudgetCr: 6,
    productionBudgetCr: 22,
    contingencyPercent: 10,
    ottRightsCr: 0,
    satelliteRightsCr: 0,
    musicRightsCr: 0,
    overseasRightsCr: 0,
    brandRevenueCr: 0,
    financingCostCr: 0,
    theatricalSharePercent: 50,
    recoveryMultiple: 2.5,
    isSequel: false,
    isRemake: false,
    hasFranchisePotential: false,
    targetAudience: 'Mass',
    marketTiming: 'neutral',
    productionHouse: '',
    productionTeamScore: 6,
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
    if (value !== null) {
      update(key, value as EvaluationInput[K])
    }
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
          Fill in the project details below to receive a greenlight assessment, financier risk analysis, and financial projections.
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
            <CardHeader><CardTitle>Film Information</CardTitle><CardDescription>Basic project details and concept assessment</CardDescription></CardHeader>
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
                  placeholder="Describe the film's premise, hook, and target audience in 2-3 sentences"
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

              <div className="grid gap-4 sm:grid-cols-3">
                <LabelCheckbox checked={input.isSequel} onChange={v => update('isSequel', v)} label="Sequel / Franchise Entry" />
                <LabelCheckbox checked={input.isRemake} onChange={v => update('isRemake', v)} label="Remake / Adaptation" />
                <LabelCheckbox checked={input.hasFranchisePotential} onChange={v => update('hasFranchisePotential', v)} label="Franchise Potential" />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Target Audience</Label>
                   <Select value={input.targetAudience} onValueChange={v => selectUpdate('targetAudience', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Mass">Mass / Family</SelectItem>
                      <SelectItem value="Urban">Urban / Premium</SelectItem>
                      <SelectItem value="Youth">Youth</SelectItem>
                      <SelectItem value="Niche">Niche / Festival</SelectItem>
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
            <CardHeader><CardTitle>Talent & Production Team</CardTitle><CardDescription>Key creative personnel and their market standing</CardDescription></CardHeader>
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
                  <Label>Lead Actor 1</Label>
                  <Input placeholder="Lead actor name" value={input.leadActor1} onChange={e => update('leadActor1', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Lead Actor 1 Tier</Label>
                   <Select value={input.actorTier} onValueChange={v => selectUpdate('actorTier', v)}>
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
                  <Label>Lead Actor 2 (optional)</Label>
                  <Input placeholder="Second lead" value={input.leadActor2} onChange={e => update('leadActor2', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Production House</Label>
                  <Input placeholder="e.g. Dharma Productions" value={input.productionHouse} onChange={e => update('productionHouse', e.target.value)} />
                </div>
              </div>

              <div className="space-y-3">
                <Label>Production Team Score: {input.productionTeamScore}/10</Label>
                <Slider min={1} max={10} value={[input.productionTeamScore ?? 6]} onValueChange={v => { const val = Array.isArray(v) ? v[0] : v; update('productionTeamScore', val) }} />
                <p className="text-xs text-muted-foreground">
                  {input.productionTeamScore && input.productionTeamScore >= 8 ? 'Experienced producer and line producer with reliable track record' :
                   input.productionTeamScore && input.productionTeamScore >= 5 ? 'Adequate team with some gaps' :
                   'Limited production experience — execution risk elevated'}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="budget" className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Budget & Cost Structure</CardTitle><CardDescription>Production budget, P&A, contingency, and financing</CardDescription></CardHeader>
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
            <CardHeader><CardTitle>Rights & Revenue</CardTitle><CardDescription>Pre-sold rights, brand revenue, and theatrical share assumptions</CardDescription></CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>OTT / Digital Rights (₹ Cr)</Label>
                  <Input type="number" min={0} step={0.5} value={input.ottRightsCr} onChange={e => update('ottRightsCr', parseFloat(e.target.value) || 0)} />
                </div>
                <div className="space-y-2">
                  <Label>Satellite Rights (₹ Cr)</Label>
                  <Input type="number" min={0} step={0.5} value={input.satelliteRightsCr} onChange={e => update('satelliteRightsCr', parseFloat(e.target.value) || 0)} />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Music Rights (₹ Cr)</Label>
                  <Input type="number" min={0} step={0.5} value={input.musicRightsCr} onChange={e => update('musicRightsCr', parseFloat(e.target.value) || 0)} />
                </div>
                <div className="space-y-2">
                  <Label>Overseas Rights (₹ Cr)</Label>
                  <Input type="number" min={0} step={0.5} value={input.overseasRightsCr} onChange={e => update('overseasRightsCr', parseFloat(e.target.value) || 0)} />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Brand Integration / Sponsorship (₹ Cr)</Label>
                  <Input type="number" min={0} step={0.5} value={input.brandRevenueCr} onChange={e => update('brandRevenueCr', parseFloat(e.target.value) || 0)} />
                </div>
                <div className="space-y-2">
                  <Label>Theatrical Share (%)</Label>
                  <Input type="number" min={10} max={70} step={1} value={input.theatricalSharePercent} onChange={e => update('theatricalSharePercent', parseFloat(e.target.value) || 50)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Recovery Multiple Target</Label>
                <Input type="number" min={0.5} max={10} step={0.1} value={input.recoveryMultiple} onChange={e => update('recoveryMultiple', parseFloat(e.target.value) || 2.5)} />
                <p className="text-xs text-muted-foreground">The gross-to-budget multiple required for full capital recovery</p>
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

function LabelCheckbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 rounded-lg border border-input px-3 py-2 text-sm cursor-pointer hover:bg-muted/50 has-checked:border-primary has-checked:bg-primary/5">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="size-4 accent-primary" />
      {label}
    </label>
  )
}

function conceptClarityHint(v: number): string {
  if (v >= 8) return 'Well-defined premise with clear audience hook and market positioning'
  if (v >= 5) return 'Adequate clarity — consider sharpening the logline and target audience fit'
  return 'Concept needs more definition to assess market viability'
}

function noveltyHint(v: number): string {
  if (v >= 7) return 'Fresh concept with distinct original elements'
  if (v >= 4) return 'Moderately original — some familiar elements present'
  return 'Heavily derivative — higher novelty would strengthen the investment case'
}
