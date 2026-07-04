"use client"

import { useState, useRef, useEffect, useCallback } from 'react'
import { ArrowLeft, AlertCircle } from 'lucide-react'
import type { EvaluationInput, EvaluationResult } from '@/lib/types'
import { EvaluateForm } from './evaluate-form'
import { EvaluationResults } from './results'
import { LoadingOverlay } from './loading-overlay'
import { ErrorBoundary } from '@/components/error-boundary'

export default function EvaluatePage() {
  const [result, setResult] = useState<EvaluationResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastInput, setLastInput] = useState<EvaluationInput | null>(null)
  const [editing, setEditing] = useState(false)

  const resultRef = useRef<EvaluationResult | null>(null)
  const errorRef = useRef<string | null>(null)
  const overlayDoneRef = useRef(false)

  useEffect(() => {
    if (!loading) return
    const poll = setInterval(() => {
      if (overlayDoneRef.current && (resultRef.current || errorRef.current)) {
        if (errorRef.current) setError(errorRef.current)
        setLoading(false)
        clearInterval(poll)
      }
    }, 100)
    return () => clearInterval(poll)
  }, [loading])

  async function handleSubmit(input: EvaluationInput) {
    setLoading(true)
    overlayDoneRef.current = false
    resultRef.current = null
    errorRef.current = null
    setResult(null)
    setError(null)
    setLastInput(input)

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
      resultRef.current = data
      setResult(data)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong'
      errorRef.current = msg
      setError(msg)
    }
  }

  const handleOverlayComplete = useCallback(() => {
    overlayDoneRef.current = true
  }, [])

  const showOverlay = loading && (!overlayDoneRef.current || (!result && !error))

  function handleEdit() {
    setEditing(true)
    setResult(null)
    setError(null)
  }

  function handleNew() {
    setEditing(false)
    setResult(null)
    setLastInput(null)
    setError(null)
    setLoading(false)
    overlayDoneRef.current = false
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-black">
        {showOverlay && <LoadingOverlay onComplete={handleOverlayComplete} />}

        <div className="mx-auto max-w-5xl px-4 py-16">
          {result && !loading && !editing ? (
            <div className="pt-8">
              <EvaluationResults result={result} />
              <div className="mt-8 flex justify-center gap-4">
                <button
                  type="button"
                  onClick={handleEdit}
                  className="group flex items-center gap-1.5 rounded-full border border-white/10 bg-transparent px-6 py-2.5 text-sm text-white/60 transition-all duration-200 hover:border-emerald-500/30 hover:text-emerald-400 hover:bg-emerald-500/5 active:scale-95"
                >
                  <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
                  Edit inputs
                </button>
                <button
                  type="button"
                  onClick={handleNew}
                  className="group rounded-full border border-white/10 bg-transparent px-6 py-2.5 text-sm text-white/60 transition-all duration-200 hover:border-white/20 hover:text-white/80 active:scale-95"
                >
                  New evaluation
                </button>
              </div>
            </div>
          ) : (
            <>
              {error && !loading && (
                <div className="mx-auto mb-6 max-w-lg animate-slide-up rounded-xl border border-red-900/40 bg-red-950/20 p-4" role="alert">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-400" />
                    <div>
                      <p className="text-sm font-medium text-red-300">Evaluation failed</p>
                      <p className="mt-0.5 text-xs text-red-400/70">{error}</p>
                      <button
                        type="button"
                        onClick={() => setError(null)}
                        className="mt-2 text-xs text-red-400/50 underline underline-offset-2 hover:text-red-400/80"
                      >
                        Dismiss and try again
                      </button>
                    </div>
                  </div>
                </div>
              )}
              <EvaluateForm onSubmit={handleSubmit} loading={loading} initialInput={lastInput ?? undefined} />
            </>
          )}
        </div>
      </div>
    </ErrorBoundary>
  )
}
