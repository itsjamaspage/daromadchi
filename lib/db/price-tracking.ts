import { competitorPrices as mock } from '@/lib/mock-data'
import type { CompetitorPrice } from '@/lib/mock-data'

const supabaseConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project')

export async function getCompetitorPrices(): Promise<CompetitorPrice[]> {
  if (!supabaseConfigured) return mock
  // Real: query competitor_prices table joined with products
  return mock
}

export type { CompetitorPrice }
