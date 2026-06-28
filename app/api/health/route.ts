import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    env: process.env.NEXT_PUBLIC_ENV ?? 'production',
    timestamp: new Date().toISOString(),
  })
}
