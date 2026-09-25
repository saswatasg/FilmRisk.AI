import { NextRequest, NextResponse } from 'next/server'
import { findUserByEmail, verifyPassword, createSession, signToken } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()
    const user = await findUserByEmail(email)
    if (!user || !verifyPassword(password, user.password)) {
      return NextResponse.json({ error: 'invalid credentials' }, { status: 401 })
    }
    const rawToken = `jwt_${Date.now()}_${Math.random().toString(36).slice(2)}`
    const expiresAt = new Date(Date.now() + 86400000)
    await createSession(user.id, rawToken, expiresAt)
    const jwt = signToken({ userId: user.id })
    return NextResponse.json({ token: jwt, user: { id: user.id, email: user.email } })
  } catch (err) {
    return NextResponse.json({ error: 'login failed' }, { status: 500 })
  }
}
