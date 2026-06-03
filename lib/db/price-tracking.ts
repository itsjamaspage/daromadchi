import type { CompetitorPrice } from '@/lib/types'

const supabaseConfigured = process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project')

export async function getCompetitorPrices(): Promise<CompetitorPrice[]> {
  if (!supabaseConfigured) return []
  // Real: query competitor_prices table joined with products
  return []
}

export type { CompetitorPrice }
