import { NextRequest, NextResponse } from 'next/server'

type Handler = (req: NextRequest, ctx?: unknown) => Promise<NextResponse | Response>

export function withErrorHandler(handler: Handler): Handler {
  return async (req: NextRequest, ctx?: unknown) => {
    try {
      return await handler(req, ctx)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[API Error]', msg, err)
      return NextResponse.json(
        { error: 'Ichki server xatosi', detail: msg },
        { status: 500 },
      )
    }
  }
}
