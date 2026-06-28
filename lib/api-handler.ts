import { NextRequest, NextResponse } from 'next/server'

type Handler = (req: NextRequest, ctx?: unknown) => Promise<NextResponse | Response>

export function withErrorHandler(handler: Handler): Handler {
  return async (req: NextRequest, ctx?: unknown) => {
    try {
      return await handler(req, ctx)
    } catch (err) {
      console.error('[API Error]', err)
      return NextResponse.json(
        { error: 'Ichki server xatosi' },
        { status: 500 },
      )
    }
  }
}
