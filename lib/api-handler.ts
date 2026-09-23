import { NextRequest, NextResponse } from 'next/server'

type Handler = (req: NextRequest, ctx?: unknown) => Promise<NextResponse | Response>

export function withErrorHandler(handler: Handler): Handler {
  return async (req: NextRequest, ctx?: unknown) => {
    try {
      return await handler(req, ctx)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      const stack = err instanceof Error ? err.stack?.split('\n').slice(0, 3).join(' | ') : undefined
      console.error('[API Error]', msg, err)
      return NextResponse.json(
        { error: 'Ichki server xatosi', detail: msg, trace: stack },
        { status: 500 },
      )
    }
  }
}
