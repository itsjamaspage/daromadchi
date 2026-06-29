import { NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/api-handler'

const CORS: HeadersInit = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS })
}

export const GET = withErrorHandler(async () => {
  return NextResponse.json({
    botUsername: process.env.TELEGRAM_BOT_USERNAME ?? '',
    channelUsername: 'daromadchi_uz',
  }, { headers: CORS })
})
