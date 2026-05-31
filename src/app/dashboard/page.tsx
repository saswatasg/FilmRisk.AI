'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Film, BarChart3, TrendingUp, Database } from 'lucide-react'
import type { DatasetSummary } from '@/lib/types'

export default function DashboardPage() {
  const [summary, setSummary] = useState<DatasetSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dataset')
      .then(r => r.json())
      .then(d => { setSummary(d.summary); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Dataset overview and market intelligence
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard icon={<Database className="size-4" />} label="Total Films" value={summary?.totalFilms ?? '—'} loading={loading} />
        <MetricCard icon={<Film className="size-4" />} label="With Budget Data" value={summary?.filmsWithBudget ?? '—'} loading={loading} />
        <MetricCard icon={<TrendingUp className="size-4" />} label="With Gross Data" value={summary?.filmsWithGross ?? '—'} loading={loading} />
        <MetricCard icon={<BarChart3 className="size-4" />} label="Date Range" value={summary ? `${summary.dateRange.min}–${summary.dateRange.max}` : '—'} loading={loading} />
      </div>

      {summary && (
        <>
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-base">Genres</CardTitle>
              <CardDescription>{summary.genres.length} primary genres represented</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {summary.genres.map(g => (
                  <Badge key={g} variant="secondary">{g}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-base">Box Office Verdict Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(summary.verdicts)
                  .sort(([, a], [, b]) => b - a)
                  .map(([verdict, count]) => (
                    <div key={verdict} className="flex items-center gap-3 text-sm">
                      <span className="w-28 font-medium capitalize">{verdict}</span>
                      <div className="flex-1">
                        <div className="h-5 w-full rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary/60"
                            style={{ width: `${(count / summary.totalFilms) * 100}%` }}
                          />
                        </div>
                      </div>
                      <span className="w-16 text-right text-muted-foreground">{count}</span>
                      <span className="w-12 text-right text-muted-foreground">
                        {((count / summary.totalFilms) * 100).toFixed(1)}%
                      </span>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

function MetricCard({ icon, label, value, loading }: { icon: React.ReactNode; label: string; value: string | number; loading: boolean }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {icon}
          {label}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-7 w-20 animate-pulse rounded bg-muted" />
        ) : (
          <p className="text-2xl font-semibold">{value}</p>
        )}
      </CardContent>
    </Card>
  )
}
