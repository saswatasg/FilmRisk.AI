"use client"

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getEmail, getToken, authHeaders, clearAuthCookies } from '@/lib/client-auth'

export function AuthNav() {
  const [token, setToken] = useState('')
  const [email, setEmail] = useState('')

  useEffect(() => {
    const sync = () => { setToken(getToken()); setEmail(getEmail()) }
    sync()
    const poll = setInterval(sync, 1000)
    return () => clearInterval(poll)
  }, [])

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST', headers: authHeaders() }).catch(() => {})
    clearAuthCookies()
    setToken('')
    setEmail('')
  }

  if (token) {
    return (
      <div className="flex items-center gap-4">
        <span className="hidden text-[13px] text-[#969696] sm:block">{email}</span>
        <Link href="/evaluate" className="inline-flex h-10 items-center bg-[#da291c] px-5 text-[13px] font-bold uppercase tracking-[1.4px] text-white transition-colors hover:bg-[#b01e0a]">
          Score a film
        </Link>
        <button type="button" onClick={logout} className="text-[13px] font-semibold uppercase tracking-[0.65px] text-[#8f8f8f] transition-colors hover:text-white">
          Log out
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-5">
      <Link href="/#standard" className="hidden text-[13px] font-semibold uppercase tracking-[0.65px] text-[#969696] transition-colors hover:text-white sm:block">The standard</Link>
      <Link href="/#record" className="hidden text-[13px] font-semibold uppercase tracking-[0.65px] text-[#969696] transition-colors hover:text-white sm:block">The evidence</Link>
      <Link href="/evaluate" className="inline-flex h-10 items-center bg-[#da291c] px-5 text-[13px] font-bold uppercase tracking-[1.4px] text-white transition-colors hover:bg-[#b01e0a]">
        Evaluate
      </Link>
    </div>
  )
}
