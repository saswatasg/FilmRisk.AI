"use client"

import { useState, useRef, useEffect, useCallback } from 'react'
import { ArrowLeft, AlertCircle, Lock, Crown, ShieldCheck, X } from 'lucide-react'
import type { EvaluationInput, EvaluationResult } from '@/lib/types'
import { EvaluateFlow } from './evaluate-flow'
import { EvaluationResults } from './results'
import { LoadingOverlay } from './loading-overlay'
import { ErrorBoundary } from '@/components/error-boundary'
import { getEmail, authHeaders, clearAuthCookies, EVALUATION_FEE_LABEL } from '@/lib/client-auth'
import { FLOW_STORAGE_KEY } from '@/lib/evaluate-defaults'

type AuthState = 'checking' | 'login' | 'ready'
type GateCode = 'payment_required' | 'edits_exhausted'
interface Entitlement { purchased: boolean; runsUsed: number; editsLeft: number }

export default function EvaluatePage() {
  const [result, setResult] = useState<EvaluationResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastInput, setLastInput] = useState<EvaluationInput | undefined>(undefined)
  const [editing, setEditing] = useState(false)
  const [authState, setAuthState] = useState<AuthState>('checking')
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null)
  const [gate, setGate] = useState<GateCode | null>(null)
  const [gateError, setGateError] = useState<string | null>(null)

  const resultRef = useRef<EvaluationResult | null>(null)
  const errorRef = useRef<string | null>(null)
  const overlayDoneRef = useRef(false)
  const pendingInputRef = useRef<EvaluationInput | null>(null)

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

  const loadAccess = useCallback(async (): Promise<{ state: AuthState; entitlement: Entitlement } | null> => {
    try {
      const s = await fetch('/api/auth/session', { headers: authHeaders() })
      if (!s.ok) return { state: 'login', entitlement: { purchased: false, runsUsed: 0, editsLeft: 0 } }
      const p = await fetch('/api/purchase', { headers: authHeaders() })
      const ent = p.ok
        ? ((await p.json()) as Entitlement)
        : { purchased: false, runsUsed: 0, editsLeft: 0 }
      return { state: 'ready', entitlement: ent }
    } catch {
      return { state: 'login', entitlement: { purchased: false, runsUsed: 0, editsLeft: 0 } }
    }
  }, [])

  const applyAccess = useCallback((a: { state: AuthState; entitlement: Entitlement }) => {
    setAuthState(a.state)
    setEntitlement(a.entitlement)
  }, [])

  const refreshAccess = useCallback(async () => {
    const a = await loadAccess()
    if (a) applyAccess(a)
  }, [loadAccess, applyAccess])

  useEffect(() => {
    let cancelled = false
    loadAccess().then(a => { if (a && !cancelled) applyAccess(a) })
    return () => { cancelled = true }
  }, [loadAccess, applyAccess])

  async function handleLogin(email: string, password: string) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (!res.ok) throw new Error('login failed')
    await refreshAccess()
  }

  async function handleRegister(email: string, password: string) {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(res.status === 409 ? 'email already registered' : (data.error ?? 'registration failed'))
    }
    await handleLogin(email, password)
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST', headers: authHeaders() }).catch(() => {})
    clearAuthCookies()
    setAuthState('login')
    setEntitlement(null)
  }

  function loadRazorpayScript(): Promise<boolean> {
    return new Promise(resolve => {
      const w = window as unknown as { Razorpay?: unknown }
      if (w.Razorpay) return resolve(true)
      const s = document.createElement('script')
      s.src = 'https://checkout.razorpay.com/v1/checkout.js'
      s.onload = () => resolve(true)
      s.onerror = () => resolve(false)
      document.body.appendChild(s)
    })
  }

  async function startCheckout() {
    setGateError(null)
    try {
      const res = await fetch('/api/checkout', { method: 'POST', headers: authHeaders() })
      if (!res.ok) throw new Error('checkout failed')
      const { orderId } = await res.json()
      const loaded = await loadRazorpayScript()
      if (!loaded) throw new Error('Could not load the payment gateway')
      const w = window as unknown as { Razorpay: new (opts: Record<string, unknown>) => { open: () => void } }
      const rzp = new w.Razorpay({
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? '',
        order_id: orderId,
        name: 'Greenlit',
        description: 'One report · two edits included',
        theme: { color: '#da291c' },
        prefill: { email: getEmail() },
        handler: async (response: unknown) => {
          const { razorpay_payment_id } = response as { razorpay_payment_id: string }
          try {
            const r = await fetch('/api/purchase', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...authHeaders() },
              body: JSON.stringify({ paymentId: razorpay_payment_id, orderId }),
            })
            if (!r.ok) throw new Error('verification failed')
            setEntitlement(await r.json())
            setGate(null)
            setGateError(null)
            if (pendingInputRef.current) runEvaluation(pendingInputRef.current)
          } catch {
            setGateError('Payment received but verification failed. Contact support with your payment ID.')
          }
        },
        modal: { ondismiss: () => setGateError(null) },
      })
      rzp.open()
    } catch (err) {
      setGateError(err instanceof Error && err.message ? err.message : 'Checkout failed. Try again.')
    }
  }

  async function runEvaluation(input: EvaluationInput) {
    setLoading(true)
    overlayDoneRef.current = false
    resultRef.current = null
    errorRef.current = null
    setResult(null)
    setError(null)
    try {
      const res = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(input),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        if (res.status === 401) {
          clearAuthCookies()
          setAuthState('login')
          setLoading(false)
          return
        }
        if (res.status === 402) {
          setGate(err.code === 'edits_exhausted' ? 'edits_exhausted' : 'payment_required')
          setLoading(false)
          return
        }
        throw new Error(err.error ?? 'Evaluation failed')
      }
      const data: EvaluationResult = await res.json()
      resultRef.current = data
      setResult(data)
      setEditing(false)
      refreshAccess()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong'
      errorRef.current = msg
      setError(msg)
      setLoading(false)
    }
  }

  async function handleSubmit(input: EvaluationInput) {
    setLastInput(input)
    pendingInputRef.current = input
    setGateError(null)
    if (!entitlement?.purchased) {
      setGate('payment_required')
      return
    }
    if (entitlement.editsLeft <= 0) {
      setGate('edits_exhausted')
      return
    }
    await runEvaluation(input)
  }

  const handleOverlayComplete = useCallback(() => { overlayDoneRef.current = true }, [])
  const showOverlay = loading && (!overlayDoneRef.current || (!result && !error))

  function handleEdit() { setEditing(true); setResult(null); setError(null) }
  function handleNew() {
    setEditing(false); setResult(null); setLastInput(undefined); setError(null); setLoading(false); overlayDoneRef.current = false
    try { sessionStorage.removeItem(FLOW_STORAGE_KEY) } catch { /* ignore */ }
  }

  const purchaseNote = entitlement
    ? entitlement.purchased
      ? null
      : `${EVALUATION_FEE_LABEL} · one report with two edits — you'll confirm payment just before the result.`
    : null

  const showResults = authState === 'ready' && result && !loading && !editing

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#181818]">
        {showOverlay && <LoadingOverlay onComplete={handleOverlayComplete} />}
        <div className="mx-auto max-w-5xl px-4 py-16">
          {authState === 'checking' && (
            <div className="flex items-center justify-center py-24">
              <p className="text-[13px] text-[#969696]">Checking access…</p>
            </div>
          )}

          {authState === 'login' && (
            <div className="mx-auto max-w-md rounded-md border border-[#303030] bg-[#202020] p-8 text-center">
              <Lock className="mx-auto size-12 text-[#da291c]" />
              <h2 className="mt-4 text-[24px] font-medium text-white">Authentication required</h2>
              <p className="mt-2 text-sm text-[#969696]">Log in or create an account to access evaluations.</p>
              <LoginForm onLogin={handleLogin} onRegister={handleRegister} />
            </div>
          )}

          {authState === 'ready' && (
            <>
              {showResults ? (
                <div className="pt-8">
                  <EvaluationResults result={result!} />
                  <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                    <button type="button" onClick={handleEdit} className="group flex items-center gap-1.5 rounded-none border border-[#303030] bg-transparent px-6 py-2.5 text-sm text-[#969696] transition-colors duration-200 hover:border-white/40 hover:text-white">
                      <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" /> Edit inputs
                      {entitlement && entitlement.editsLeft > 0 && (
                        <span className="text-[#8f8f8f]">({entitlement.editsLeft} left)</span>
                      )}
                    </button>
                    <button type="button" onClick={handleNew} className="rounded-none border border-[#303030] bg-transparent px-6 py-2.5 text-sm text-[#969696] transition-colors duration-200 hover:border-white/25 hover:text-white">New evaluation</button>
                    <button type="button" onClick={handleLogout} className="text-sm text-[#8f8f8f] underline transition-colors hover:text-white">Log out</button>
                  </div>
                </div>
              ) : (
                <>
                  {error && !loading && (
                    <div className="mx-auto mb-6 max-w-lg rounded-md border border-[#f13a2c]/40 bg-[#f13a2c]/[0.07] p-4" role="alert">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="mt-0.5 size-4 shrink-0 text-[#f13a2c]" />
                        <div><p className="text-sm font-medium text-white">Evaluation failed</p><p className="mt-0.5 text-xs text-[#969696]">{error}</p></div>
                      </div>
                    </div>
                  )}
                  <EvaluateFlow onSubmit={handleSubmit} loading={loading} initialInput={lastInput} purchaseNote={purchaseNote} />
                </>
              )}
            </>
          )}
        </div>

        {authState === 'ready' && gate && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#181818]/92 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Purchase required">
            <div className="w-full max-w-md border border-[#303030] bg-[#202020] p-8">
              <div className="flex items-start justify-between">
                {gate === 'payment_required' ? (
                  <Crown className="size-10 text-[#da291c]" />
                ) : (
                  <ShieldCheck className="size-10 text-[#E5A83B]" />
                )}
                <button type="button" onClick={() => setGate(null)} aria-label="Close" className="text-[#8f8f8f] transition-colors hover:text-white">
                  <X className="size-5" />
                </button>
              </div>
              <h2 className="mt-5 text-[26px] font-medium leading-tight text-white">
                {gate === 'payment_required' ? 'Your report is ready to score' : 'Both edits used'}
              </h2>
              {gate === 'payment_required' ? (
                <>
                  <p className="mt-3 text-[15px] leading-relaxed text-[#969696]">
                    One report, {EVALUATION_FEE_LABEL} — the full memorandum with verdict, ranges,
                    comparables, risk diagnosis and levers, plus two edits to the inputs afterwards.
                  </p>
                  <dl className="mt-6 divide-y divide-[#303030] border-y border-[#303030] text-sm">
                    {[
                      { l: 'One report', v: EVALUATION_FEE_LABEL },
                      { l: 'Edits included', v: '2' },
                      { l: 'Format', v: 'Web + PDF' },
                    ].map(r => (
                      <div key={r.l} className="flex items-center justify-between py-3">
                        <dt className="text-[#969696]">{r.l}</dt>
                        <dd className="font-medium text-white">{r.v}</dd>
                      </div>
                    ))}
                  </dl>
                </>
              ) : (
                <p className="mt-3 text-[15px] leading-relaxed text-[#969696]">
                  This report included two edits to the inputs — both are used. Purchase another
                  report ({EVALUATION_FEE_LABEL}) to keep refining.
                </p>
              )}
              {gateError && <p className="mt-4 text-xs text-[#f13a2c]" role="alert">{gateError}</p>}
              <button
                type="button"
                onClick={startCheckout}
                className="mt-6 inline-flex h-12 w-full items-center justify-center bg-[#da291c] px-8 text-[14px] font-bold uppercase tracking-[1.4px] text-white transition-colors hover:bg-[#b01e0a]"
              >
                {gate === 'payment_required' ? `Pay ${EVALUATION_FEE_LABEL} · Score now` : `Buy another report · ${EVALUATION_FEE_LABEL}`}
              </button>
              <button
                type="button"
                onClick={() => setGate(null)}
                className="mt-3 w-full text-center text-[13px] text-[#8f8f8f] underline transition-colors hover:text-white"
              >
                Back to my inputs
              </button>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  )
}

function LoginForm({ onLogin, onRegister }: { onLogin: (e: string, p: string) => Promise<void>; onRegister: (e: string, p: string) => Promise<void> }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isRegister, setIsRegister] = useState(false)
  const [err, setErr] = useState('')
  const [pending, setPending] = useState(false)

  async function submit() {
    if (!email.trim() || !password) { setErr('Email and password are required'); return }
    if (isRegister && password.length < 8) { setErr('Password must be at least 8 characters'); return }
    setErr('')
    setPending(true)
    try {
      if (isRegister) await onRegister(email.trim(), password)
      else await onLogin(email.trim(), password)
    } catch (e) {
      setErr(e instanceof Error && e.message ? e.message : 'Invalid credentials')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="mt-6 space-y-3">
      <label className="block">
        <span className="sr-only">Email</span>
        <input
          type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" autoComplete="email"
          className="w-full rounded-none border border-[#303030] bg-[#181818] px-4 py-3 text-sm text-white placeholder:text-[#8f8f8f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        />
      </label>
      <label className="block">
        <span className="sr-only">Password</span>
        <input
          type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={isRegister ? 'Password (min 8 characters)' : 'Password'} autoComplete={isRegister ? 'new-password' : 'current-password'}
          onKeyDown={e => { if (e.key === 'Enter') submit() }}
          className="w-full rounded-none border border-[#303030] bg-[#181818] px-4 py-3 text-sm text-white placeholder:text-[#8f8f8f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        />
      </label>
      {err && <p className="text-xs text-[#f13a2c]" role="alert">{err}</p>}
      <button
        type="button" onClick={submit} disabled={pending}
        className="w-full rounded-none bg-[#da291c] px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-[#b01e0a] disabled:opacity-50"
      >
        {pending ? 'Please wait…' : isRegister ? 'Create account' : 'Log in'}
      </button>
      <button type="button" onClick={() => { setIsRegister(!isRegister); setErr('') }} className="text-xs text-[#969696] underline hover:text-white">
        {isRegister ? 'Already have an account? Log in' : 'Create a new account'}
      </button>
    </div>
  )
}
