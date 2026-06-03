import { createClient } from '@/lib/supabase/server'

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

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return empty

  const { data } = await supabase
    .from('users')
    .select('full_name, email')
    .eq('id', user.id)
    .maybeSingle()

  return {
    fullName: (data?.full_name as string) ?? (user.user_metadata?.full_name as string) ?? '',
    email:    (data?.email as string) ?? user.email ?? '',
    phone:    (user.user_metadata?.phone as string) ?? '',
  }
}
