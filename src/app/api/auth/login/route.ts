import { NextRequest, NextResponse } from 'next/server'
import { findUserByEmail, verifyPassword, isLegacyHash, upgradePassword, createSession, signToken, hashPassword } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()
    const user = await findUserByEmail(email)
    if (!user || !(await verifyPassword(password, user.password))) {
      return NextResponse.json({ error: 'invalid credentials' }, { status: 401 })
    }
    if (isLegacyHash(user.password)) {
      await upgradePassword(user.id, await hashPassword(password))
    }
    const jwt = signToken({ userId: user.id })
    await createSession(user.id, jwt, new Date(Date.now() + 86400000))
    const res = NextResponse.json({ token: jwt, user: { id: user.id, email: user.email } })
    const opts = { path: '/', maxAge: 86400, sameSite: 'strict' as const }
    res.cookies.set('token', jwt, opts)
    res.cookies.set('email', user.email, opts)
    return res
  } catch {
    return NextResponse.json({ error: 'login failed' }, { status: 500 })
  }
}
