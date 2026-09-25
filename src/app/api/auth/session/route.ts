import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'no token' }, { status: 401 })
  const payload = verifyToken(token)
  if (!payload) return NextResponse.json({ error: 'invalid token' }, { status: 401 })
  const user = await import('@/lib/auth').then(m => m.getUserById(payload.userId))
  if (!user) return NextResponse.json({ error: 'user not found' }, { status: 404 })
  return NextResponse.json({ user })
}
