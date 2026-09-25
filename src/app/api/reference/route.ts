import { NextResponse } from 'next/server'
import tierRef from '@/generated/tier-reference.json'

export async function GET() {
  return NextResponse.json(tierRef)
}
