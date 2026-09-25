import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, createPurchase } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const payload = verifyToken(token)
  if (!payload) return NextResponse.json({ error: 'invalid token' }, { status: 401 })

  try {
    const { paymentId, orderId } = await request.json()
    const purchaseId = await createPurchase(payload.userId, orderId, 4900)
    return NextResponse.json({ purchaseId, ok: true })
  } catch (err) {
    return NextResponse.json({ error: 'purchase failed' }, { status: 500 })
  }
}
