import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { User } from '@supabase/supabase-js'

export const supabaseAdmin: SupabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function getAuthUser(authHeader: string | null): Promise<User | null> {
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return null
  const { data: { user } } = await supabaseAdmin.auth.getUser(token)
  return user ?? null
}

export async function getShopIds(userId: string, shopId?: string | null): Promise<string[]> {
  let q = supabaseAdmin.from('shops').select('id').eq('user_id', userId)
  if (shopId) q = q.eq('id', shopId)
  const { data } = await q
  return (data ?? []).map((s: { id: string }) => s.id)
}
