import { NextRequest, NextResponse } from 'next/server'
import { authenticate, extractToken, createPurchase, getEntitlement } from '@/lib/auth'

async function requireUser(request: NextRequest) {
  const token = extractToken(request.headers.get('Authorization')) ?? request.cookies.get('token')?.value ?? null
  return authenticate(token)
}

export async function GET(request: NextRequest) {
  const payload = await requireUser(request)
  if (!payload) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const ent = await getEntitlement(payload.userId)
  return NextResponse.json({ ok: ent.purchased, ...ent })
}

export async function POST(request: NextRequest) {
  const payload = await requireUser(request)
  if (!payload) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  try {
    const { paymentId, orderId } = await request.json()
    if (!paymentId || !orderId) {
      return NextResponse.json({ error: 'paymentId and orderId required' }, { status: 400 })
    }

    const { default: Razorpay } = await import('razorpay')
    const rzp = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    })
    const payment = (await rzp.payments.fetch(paymentId)) as {
      order_id: string
      status: string
      amount: number
    }
    if (payment.order_id !== orderId) {
      return NextResponse.json({ error: 'payment/order mismatch' }, { status: 402 })
    }
    if (payment.status !== 'captured' && payment.status !== 'authorized') {
      return NextResponse.json({ error: 'payment not completed' }, { status: 402 })
    }
    if (Number(payment.amount) !== 499900) {
      return NextResponse.json({ error: 'amount mismatch' }, { status: 402 })
    }

    const purchaseId = await createPurchase(payload.userId, paymentId, 499900)
    const ent = await getEntitlement(payload.userId)
    return NextResponse.json({ purchaseId, ok: true, ...ent })
  } catch {
    return NextResponse.json({ error: 'purchase verification failed' }, { status: 402 })
  }
}
