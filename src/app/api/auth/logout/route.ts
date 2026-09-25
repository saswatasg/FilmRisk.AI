import { NextRequest, NextResponse } from 'next/server'
import { invalidateSession } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '')
  if (token) await invalidateSession(token)
  return NextResponse.json({ ok: true })
}
