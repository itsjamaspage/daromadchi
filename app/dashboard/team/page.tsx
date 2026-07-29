import { Users } from 'lucide-react'
import ComingSoon from '@/components/dashboard/ComingSoon'
import { getT } from '@/lib/server-i18n'

// Team invites was the only server-backed piece here and it lived entirely
// on Supabase Auth's inviteUserByEmail. Rebuilding it means the same
// nodemailer + invite-token infrastructure planned for the email
// verification / password reset flow, so it comes back once that ships.
// The rest of the previous page was static placeholder UI (no data plane).
export default async function TeamPage() {
  const t = await getT()
  const d = t.dashboard
  return <ComingSoon title={d.nav.team} icon={Users} />
}
