'use client'

import type { EvaluationResult, ScoreComponent } from '@/lib/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  AlertCircle, CheckCircle2, TrendingUp, BarChart3, Lightbulb,
} from 'lucide-react'

const verdictConfig = {
  greenlight: { label: 'Greenlight', class: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' },
  conditional: { label: 'Conditional', class: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
  dont_invest: { label: "Don't Invest", class: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
}

const riskConfig = {
  low: { label: 'Low Risk', class: 'bg-emerald-100 text-emerald-800' },
  moderate: { label: 'Moderate Risk', class: 'bg-amber-100 text-amber-800' },
  high: { label: 'High Risk', class: 'bg-orange-100 text-orange-800' },
  very_high: { label: 'Very High Risk', class: 'bg-red-100 text-red-800' },
}

const severityConfig = {
  low: 'bg-emerald-100 text-emerald-800',
  moderate: 'bg-amber-100 text-amber-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
}

export function EvaluationResults({ result, className }: { result: EvaluationResult; className?: string }) {
  const vc = verdictConfig[result.greenlight.verdict]
  const rc = riskConfig[result.financierRisk.riskLevel]

  return (
    <div className={className}>
      <Card className="border-emerald-200 dark:border-emerald-900">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-xl">{result.projectSummary.title}</CardTitle>
              <CardDescription>
                {result.projectSummary.genre} &middot; Dir. {result.projectSummary.director} &middot; ₹{result.projectSummary.totalBudgetCr}Cr
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Badge className={vc.class}>{vc.label}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              icon={<CheckCircle2 className="size-4 text-emerald-600" />}
              label="Greenlight Score"
              value={`${result.greenlight.totalScore}/100`}
              detail={result.greenlight.verdict === 'greenlight' ? 'Approved' : result.greenlight.verdict === 'conditional' ? 'Conditional' : 'Not Recommended'}
            />
            <MetricCard
              icon={<BarChart3 className="size-4 text-blue-600" />}
              label="Financier Risk"
              value={rc.label}
              detail={`${result.financierRisk.capitalRecoveryProb}% recovery prob.`}
            />
            <MetricCard
              icon={<TrendingUp className="size-4 text-emerald-600" />}
              label="Base Case ROI"
              value={`${result.financialProjection.scenarios[1]?.roiPercent ?? 0}%`}
              detail={`${result.financialProjection.scenarios[1]?.multiple ?? 0}x multiple`}
            />
            <MetricCard
              icon={<AlertCircle className="size-4 text-amber-600" />}
              label="Risk Factors"
              value={`${result.riskDiagnosis.factors.length} identified`}
              detail={result.riskDiagnosis.overallRisk.replace('_', ' ')}
            />
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <ScoreBreakdownCard
          title="Producer Greenlight Score"
          total={result.greenlight.totalScore}
          maxTotal={100}
          components={result.greenlight.components}
          confidence={result.greenlight.confidence}
        />
        <ScoreBreakdownCard
          title="Financier Risk Score"
          total={result.financierRisk.riskScore}
          maxTotal={100}
          components={result.financierRisk.components}
          confidence={null}
          invert
        />
      </div>

      <FinancialProjectionsCard projection={result.financialProjection} />

      <ComparableFilmsCard films={result.comparableFilms} />

      <RiskDiagnosisCard diagnosis={result.riskDiagnosis} />
    </div>
  )
}

function MetricCard({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-lg font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground capitalize">{detail}</p>
    </div>
  )
}

function ScoreBreakdownCard({ title, total, maxTotal, components, confidence, invert }: {
  title: string; total: number; maxTotal: number; components: ScoreComponent[]; confidence: string | null; invert?: boolean
}) {
  const pct = Math.round((total / maxTotal) * 100)
  const barColor = invert
    ? pct >= 70 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500'
    : pct >= 70 ? 'bg-emerald-500' : pct >= 45 ? 'bg-amber-500' : 'bg-red-500'

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{title}</CardTitle>
          {confidence && (
            <Badge variant="outline" className="text-xs">
              {confidence} confidence
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold">{total}</span>
          <span className="text-sm text-muted-foreground">/ {maxTotal}</span>
          <div className="flex-1">
            <div className="h-2 w-full rounded-full bg-muted">
              <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>
        <Separator />
        <div className="space-y-2">
          {components.map(c => (
            <div key={c.label} className="flex items-center justify-between text-sm">
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{c.label}</span>
                  <span className="text-muted-foreground">{c.score}/{c.maxScore} &times; {(c.weight * 100).toFixed(0)}%</span>
                </div>
                <p className="text-xs text-muted-foreground">{c.explanation}</p>
              </div>
              <span className="ml-2 w-8 text-right font-mono text-sm">{c.contribution.toFixed(1)}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function FinancialProjectionsCard({ projection }: { projection: EvaluationResult['financialProjection'] }) {
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="text-base">Financial Projections</CardTitle>
        <CardDescription>ROI scenarios and break-even analysis</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          {projection.scenarios.map(s => (
            <div key={s.label} className={`rounded-lg border p-4 ${s.label === 'Base Case' ? 'border-primary/30 bg-primary/5' : ''}`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{s.label}</span>
                <Badge variant="outline" className="text-xs">{s.probability}</Badge>
              </div>
              <p className="mt-2 text-lg font-semibold">₹{s.grossCr}Cr</p>
              <p className="text-xs text-muted-foreground">{s.multiple}x gross multiple</p>
              <Separator className="my-2" />
              <div className="flex justify-between text-sm">
                <span className={s.netProfitCr >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                  {s.netProfitCr >= 0 ? '+' : ''}₹{s.netProfitCr}Cr
                </span>
                <span className={s.roiPercent >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                  {s.roiPercent >= 0 ? '+' : ''}{s.roiPercent}%
                </span>
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-lg bg-muted/50 p-3 text-sm">
          <span className="font-medium">Break-even gross: </span>
          <span>₹{projection.breakEvenGrossCr}Cr &middot; </span>
          <span className="font-medium">Safe budget range: </span>
          <span>₹{projection.safeBudgetRange.min}Cr &ndash; ₹{projection.safeBudgetRange.max}Cr</span>
        </div>
      </CardContent>
    </Card>
  )
}

function ComparableFilmsCard({ films }: { films: EvaluationResult['comparableFilms'] }) {
  if (films.films.length === 0) return null

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="text-base">Comparable Films</CardTitle>
        <CardDescription>{films.querySummary}</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Film</TableHead>
              <TableHead>Year</TableHead>
              <TableHead>Genre</TableHead>
              <TableHead>Budget</TableHead>
              <TableHead>Gross</TableHead>
              <TableHead>Multiple</TableHead>
              <TableHead>Verdict</TableHead>
              <TableHead>Match</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {films.films.map(f => (
              <TableRow key={f.film.film_id}>
                <TableCell className="font-medium">{f.film.display_title}</TableCell>
                <TableCell>{f.film.release_year}</TableCell>
                <TableCell>{f.film.primary_genre}</TableCell>
                <TableCell>{f.film.budget_cr != null ? `₹${f.film.budget_cr}Cr` : '—'}</TableCell>
                <TableCell>{f.film.worldwide_gross_cr != null ? `₹${f.film.worldwide_gross_cr}Cr` : '—'}</TableCell>
                <TableCell>{f.film.gross_multiple != null ? `${f.film.gross_multiple}x` : '—'}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">{f.film.verdict_raw || '—'}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-12 rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${f.similarityScore}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground">{f.similarityScore}%</span>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function RiskDiagnosisCard({ diagnosis }: { diagnosis: EvaluationResult['riskDiagnosis'] }) {
  return (
    <Card className="mt-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Risk Diagnosis</CardTitle>
          <Badge className={riskConfig[diagnosis.overallRisk]?.class ?? ''}>
            {diagnosis.overallRisk.replace('_', ' ')}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {diagnosis.factors.map(f => (
          <div key={f.factor} className="rounded-lg border p-3">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{f.factor}</span>
                    <Badge className={`text-xs ${severityConfig[f.severity]}`}>{f.severity}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{f.description}</p>
                </div>
              </div>
            </div>
          </div>
        ))}

        <Separator />

        <div>
          <h4 className="mb-2 flex items-center gap-2 text-sm font-medium">
            <Lightbulb className="size-4 text-amber-500" />
            Recommendations
          </h4>
          <ol className="space-y-2">
            {diagnosis.topRecommendations.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                  {i + 1}
                </span>
                <span className="text-muted-foreground">{r}</span>
              </li>
            ))}
          </ol>
        </div>
      </CardContent>
    </Card>
  )
}
