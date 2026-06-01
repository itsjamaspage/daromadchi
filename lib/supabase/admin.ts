import { createClient } from '@supabase/supabase-js'

// Service-role client — only usable in server-side code (API routes, server actions).
// Never expose SUPABASE_SERVICE_ROLE_KEY to the client.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase admin credentials not configured (SUPABASE_SERVICE_ROLE_KEY missing)')
  return createClient(url, key, { auth: { persistSession: false } })
}
