import { NextResponse } from 'next/server'
import { getStockAlerts } from '@/lib/db/alerts'
import { withErrorHandler } from '@/lib/api-handler'

export const GET = withErrorHandler(async () => {
  const alerts = await getStockAlerts()
  return NextResponse.json({ alerts })
})
