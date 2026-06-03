import { NextResponse } from 'next/server'
import { getStockAlerts } from '@/lib/db/alerts'

export async function GET() {
  const alerts = await getStockAlerts()
  return NextResponse.json({ alerts })
}
