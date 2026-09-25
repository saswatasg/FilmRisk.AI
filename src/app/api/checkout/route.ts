import { NextRequest, NextResponse } from 'next/server'
import Razorpay from 'razorpay'
import { verifyToken } from '@/lib/auth'

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
})

const EVALUATION_FEE = 4900

export async function POST(request: NextRequest) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const payload = verifyToken(token)
  if (!payload) return NextResponse.json({ error: 'invalid token' }, { status: 401 })

  try {
    const order = await razorpay.orders.create({
      amount: EVALUATION_FEE,
      currency: 'INR',
      receipt: `eval_${Date.now()}`,
      notes: { userId: payload.userId, purpose: 'single-evaluation' },
    })
    return NextResponse.json({ orderId: order.id, amount: order.amount, currency: order.currency })
  } catch (err) {
    return NextResponse.json({ error: 'checkout failed' }, { status: 500 })
  }
}
