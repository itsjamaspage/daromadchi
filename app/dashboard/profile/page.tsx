import { getProfile } from '@/lib/db/profile'
import ProfileClient from './ProfileClient'

export default async function ProfilePage() {
  const profile = await getProfile()
  return <ProfileClient profile={profile} />
}
