import { NextRequest, NextResponse } from 'next/server'
import { authenticate, extractToken } from '@/lib/auth'

export const EVALUATION_FEE_PAISE = 499900

export async function POST(request: NextRequest) {
  const token = extractToken(request.headers.get('Authorization')) ?? request.cookies.get('token')?.value ?? null
  const payload = await authenticate(token)
  if (!payload) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  try {
    const { default: Razorpay } = await import('razorpay')
    const rzp = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    })
    const order = await rzp.orders.create({
      amount: EVALUATION_FEE_PAISE,
      currency: 'INR',
      receipt: `eval_${Date.now()}`,
      notes: { userId: payload.userId, purpose: 'one-report-2-edits' },
    })
    return NextResponse.json({ orderId: order.id, amount: order.amount, currency: order.currency })
  } catch {
    return NextResponse.json({ error: 'checkout failed' }, { status: 500 })
  }
}
