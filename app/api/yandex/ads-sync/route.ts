import { NextResponse } from 'next/server'

// Yandex Market does not expose per-product ad performance metrics
// (clicks, impressions, DRR) through the Partner API v2.
// Yandex advertising runs through Yandex Direct which requires a
// separate OAuth flow and API integration. This endpoint is a
// placeholder for when that integration is built.
export async function POST() {
  return NextResponse.json({
    ok: true,
    statsUpserted: 0,
    message: 'Yandex Market ad performance API is not yet available. Coming soon.',
  })
}
