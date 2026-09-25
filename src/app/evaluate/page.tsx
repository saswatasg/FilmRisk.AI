"use client"

import { useState, useRef, useEffect, useCallback } from 'react'
import { ArrowLeft, AlertCircle, Lock, Crown } from 'lucide-react'
import type { EvaluationInput, EvaluationResult } from '@/lib/types'
import { EvaluateFlow } from './evaluate-flow'
import { EvaluationResults } from './results'
import { LoadingOverlay } from './loading-overlay'
import { ErrorBoundary } from '@/components/error-boundary'

type AuthState = 'unauthenticated' | 'no_purchase' | 'authenticated' | 'loading'

export default function EvaluatePage() {
  const [result, setResult] = useState<EvaluationResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastInput, setLastInput] = useState<EvaluationInput | undefined>(undefined)
  const [editing, setEditing] = useState(false)
  const [authState, setAuthState] = useState<AuthState>('loading')

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

  useEffect(() => {
    fetch('/api/auth/session', { headers: { Authorization: `Bearer ${getToken()}` } })
      .then(r => r.json())
      .then(data => {
        if (data.user) {
          fetch('/api/purchase', { headers: { Authorization: `Bearer ${getToken()}` } })
            .then(r => r.json())
            .then(p => setAuthState(p.ok ? 'authenticated' : 'no_purchase'))
            .catch(() => setAuthState('unauthenticated'))
        } else {
          setAuthState('unauthenticated')
        }
      })
      .catch(() => setAuthState('unauthenticated'))
  }, [])

  function getToken(): string {
    return document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, '$1')
  }

  function setToken(token: string) {
    document.cookie = `token=${token}; path=/; max-age=86400; SameSite=strict`
  }

  async function handleLogin(email: string, password: string) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (!res.ok) throw new Error('login failed')
    const data = await res.json()
    setToken(data.token)
    setAuthState('authenticated')
  }

  async function handleRegister(email: string, password: string) {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (!res.ok) throw new Error('registration failed')
    await handleLogin(email, password)
  }

  async function handleCheckout() {
    const token = getToken()
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error('checkout failed')
    const { orderId } = await res.json()
    const Razorpay = (await import('razorpay')).default as unknown as { new (opts: Record<string, unknown>): { on: (event: string, cb: (...args: unknown[]) => void) => void; open: () => void } }
    const rzp = new Razorpay({ key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? 'rzp_test_replace', amount: 4900, currency: 'INR', order_id: orderId, name: 'Greenlit', description: 'Single evaluation' })
    rzp.on('payment.success', async (response: unknown) => {
      const r = response as { razorpay_payment_id: string }
      await fetch('/api/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ paymentId: r.razorpay_payment_id, orderId }),
      })
      setAuthState('authenticated')
    })
    rzp.open()
  }

  async function handleSubmit(input: EvaluationInput) {
    setLoading(true)
    overlayDoneRef.current = false
    resultRef.current = null
    errorRef.current = null
    setResult(null)
    setError(null)
    setLastInput(input)
    const token = getToken()
    try {
      const res = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(input),
      })
      if (!res.ok) {
        const err = await res.json()
        if (res.status === 402) { setError('Purchase required — buy a single evaluation to proceed.') }
        else if (res.status === 401) { setError('Session expired. Please log in again.') }
        else { throw new Error(err.error ?? 'Evaluation failed') }
        setLoading(false)
        return
      }
      const data: EvaluationResult = await res.json()
      resultRef.current = data
      setResult(data)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong'
      errorRef.current = msg
      setError(msg)
      setLoading(false)
    }
  }

  const handleOverlayComplete = useCallback(() => { overlayDoneRef.current = true }, [])
  const showOverlay = loading && (!overlayDoneRef.current || (!result && !error))

  function handleEdit() { setEditing(true); setResult(null); setError(null) }
  function handleNew() { setEditing(false); setResult(null); setLastInput(undefined); setError(null); setLoading(false); overlayDoneRef.current = false }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#181818]">
        {showOverlay && <LoadingOverlay onComplete={handleOverlayComplete} />}
        <div className="mx-auto max-w-5xl px-4 py-16">
          {authState === 'loading' && (
            <div className="mx-auto flex items-center justify-center py-24">
              <p className="text-[13px] text-[#969696]">Checking access…</p>
            </div>
          )}
          {authState === 'unauthenticated' && (
            <div className="mx-auto max-w-md rounded-md border border-[#303030] bg-[#202020] p-8 text-center">
              <Lock className="mx-auto size-12 text-[#da291c]" />
              <h2 className="mt-4 text-[24px] font-medium text-white">Authentication required</h2>
              <p className="mt-2 text-sm text-[#969696]">Log in or create an account to access evaluations.</p>
              <LoginForm onLogin={handleLogin} onRegister={handleRegister} />
            </div>
          )}
          {authState === 'no_purchase' && (
            <div className="mx-auto max-w-md rounded-md border border-[#303030] bg-[#202020] p-8 text-center">
              <Crown className="mx-auto size-12 text-[#E5A83B]" />
              <h2 className="mt-4 text-[24px] font-medium text-white">Single evaluation</h2>
              <p className="mt-2 text-sm text-[#969696]">Unlock one film evaluation for ₹49.</p>
              <button onClick={handleCheckout} className="mt-6 inline-flex h-12 items-center bg-[#da291c] px-8 text-[14px] font-bold uppercase tracking-[1.4px] text-white">
                Pay ₹49
              </button>
              {error && <p className="mt-3 text-xs text-[#f13a2c]">{error}</p>}
            </div>
          )}
          {authState !== 'loading' && ((authState === 'authenticated' && result && !loading && !editing) ? (
            <div className="pt-8">
              <EvaluationResults result={result} />
              <div className="mt-8 flex justify-center gap-4">
                <button type="button" onClick={handleEdit} className="group flex items-center gap-1.5 rounded-none border border-[#303030] bg-transparent px-6 py-2.5 text-sm text-[#969696] transition-colors duration-200 hover:border-white/40 hover:text-white">
                  <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" /> Edit inputs
                </button>
                <button type="button" onClick={handleNew} className="rounded-none border border-[#303030] bg-transparent px-6 py-2.5 text-sm text-[#969696] transition-colors duration-200 hover:border-white/25 hover:text-white">New evaluation</button>
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
              <EvaluateFlow onSubmit={handleSubmit} loading={loading} initialInput={lastInput} />
            </>
          ))}
        </div>
      </div>
    </ErrorBoundary>
  )
}

function LoginForm({ onLogin, onRegister }: { onLogin: (e: string, p: string) => Promise<void>; onRegister: (e: string, p: string) => Promise<void> }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isRegister, setIsRegister] = useState(false)
  const [err, setErr] = useState('')
  return (
    <div className="mt-6 space-y-3">
      <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" className="w-full rounded-none border border-[#303030] bg-[#181818] px-4 py-2.5 text-sm text-white placeholder:text-[#666]" />
      <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" className="w-full rounded-none border border-[#303030] bg-[#181818] px-4 py-2.5 text-sm text-white placeholder:text-[#666]" />
      {err && <p className="text-xs text-[#f13a2c]">{err}</p>}
      <button onClick={() => { isRegister ? onRegister(email, password).catch(() => setErr('Invalid credentials')) : onLogin(email, password).catch(() => setErr('Invalid credentials')) } } className="w-full rounded-none bg-[#da291c] px-4 py-2.5 text-sm font-bold text-white">
        {isRegister ? 'Create account' : 'Log in'}
      </button>
      <button onClick={() => setIsRegister(!isRegister)} className="text-xs text-[#969696] underline">
        {isRegister ? 'Already have an account? Log in' : 'Create a new account'}
      </button>
    </div>
  )
}
