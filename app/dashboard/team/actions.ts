'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

type InviteResult =
  | { success: true }
  | { success: false; reason: 'already_registered' | 'error' }

export async function inviteTeamMember(
  email: string,
  role: 'admin' | 'viewer',
): Promise<InviteResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const admin = createAdminClient()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ''
  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${siteUrl}/dashboard`,
    data: { invited_by: user.id, team_role: role },
  })

  if (error) {
    if (error.message.toLowerCase().includes('already been registered')) {
      return { success: false, reason: 'already_registered' }
    }
    return { success: false, reason: 'error' }
  }
  return { success: true }
}
