import { NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/api-handler'

export const GET = withErrorHandler(async () => {
  return NextResponse.json({
    status: 'ok',
    env: process.env.NEXT_PUBLIC_ENV ?? 'production',
    timestamp: new Date().toISOString(),
  })
})
