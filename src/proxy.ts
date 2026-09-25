import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'

function getToken(request: NextRequest): string {
  const cookie = request.cookies.get('token')?.value
  if (cookie) return cookie
  const authHeader = request.headers.get('Authorization')
  return authHeader?.replace('Bearer ', '') ?? ''
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith('/api/evaluate')) {
    const token = getToken(request)
    if (!token) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'invalid token' }, { status: 401 })
    }
    return NextResponse.next()
  }

  return NextResponse.next()
}
