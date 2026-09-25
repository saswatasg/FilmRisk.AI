import { NextRequest, NextResponse } from 'next/server'
import { createUser } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()
    if (!email || !password) {
      return NextResponse.json({ error: 'email and password required' }, { status: 400 })
    }
    if (String(password).length < 8) {
      return NextResponse.json({ error: 'password must be at least 8 characters' }, { status: 400 })
    }
    const existing = await createUser(email, password)
    return NextResponse.json({ id: existing.id, email: existing.email }, { status: 201 })
  } catch (err: unknown) {
    if ((err as { code?: string }).code === '23505') {
      return NextResponse.json({ error: 'email already registered' }, { status: 409 })
    }
    return NextResponse.json({ error: 'registration failed' }, { status: 500 })
  }
}
