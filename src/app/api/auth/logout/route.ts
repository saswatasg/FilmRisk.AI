import { NextRequest, NextResponse } from 'next/server'
import { extractToken, invalidateSession } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const token = extractToken(request.headers.get('Authorization')) ?? request.cookies.get('token')?.value ?? null
  if (token) await invalidateSession(token)
  const res = NextResponse.json({ ok: true })
  res.cookies.delete('token')
  res.cookies.delete('email')
  return res
}
