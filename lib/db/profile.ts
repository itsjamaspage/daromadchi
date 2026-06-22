import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUserId } from '@/lib/db/shop-context'

export interface UserProfile {
  fullName: string
  email: string
  phone: string
}

const supabaseConfigured =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project')

export async function getProfile(): Promise<UserProfile> {
  const empty: UserProfile = { fullName: '', email: '', phone: '' }
  if (!supabaseConfigured) return empty

  const userId = await getCurrentUserId()
  if (!userId) return empty

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('users')
    .select('full_name, email, phone')
    .eq('id', userId)
    .maybeSingle()

  return {
    fullName: (data?.full_name as string) ?? '',
    email:    (data?.email as string) ?? '',
    phone:    (data?.phone as string) ?? '',
  }
}
