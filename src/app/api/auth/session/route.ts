import { NextRequest, NextResponse } from 'next/server'
import { authenticate, extractToken, getUserById } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const token = extractToken(request.headers.get('Authorization')) ?? request.cookies.get('token')?.value ?? null
  const payload = await authenticate(token)
  if (!payload) return NextResponse.json({ error: 'no session' }, { status: 401 })
  const user = await getUserById(payload.userId)
  if (!user) return NextResponse.json({ error: 'user not found' }, { status: 404 })
  return NextResponse.json({ user })
}
