"use client"

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { User, LogIn } from 'lucide-react'

function getToken(): string {
  if (typeof document === 'undefined') return ''
  return document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, '$1')
}

export function AuthNav() {
  const [token, setToken] = useState(getToken())

  useEffect(() => {
    const check = setInterval(() => setToken(getToken()), 1000)
    return () => clearInterval(check)
  }, [])

  if (token) {
    const email = document.cookie.replace(/(?:(?:^|.*;\s*)email\s*=\s*([^;]*).*$)|^.*$/, '$1')
    return (
      <div className="flex items-center gap-4">
        <span className="text-[13px] text-[#969696]">{email}</span>
        <Link href="/evaluate" className="inline-flex h-10 items-center bg-[#da291c] px-5 text-[13px] font-bold uppercase tracking-[1.4px] text-white transition-colors hover:bg-[#b01e0a]">
          Score a film
        </Link>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-4">
      <Link href="/evaluate" className="hidden text-[13px] font-semibold uppercase tracking-[0.65px] text-[#969696] transition-colors hover:text-white sm:block">Evaluate</Link>
      <Link href="/#how-it-works" className="hidden py-2 text-[13px] font-semibold uppercase tracking-[0.65px] text-[#969696] transition-colors hover:text-white sm:block">How it works</Link>
      <Link href="/evaluate" className="inline-flex h-10 items-center bg-[#da291c] px-5 text-[13px] font-bold uppercase tracking-[1.4px] text-white transition-colors hover:bg-[#b01e0a]">
        Log in
      </Link>
    </div>
  )
}
