import { eq } from 'drizzle-orm'
import { db, users } from '@/lib/db'
import { getCurrentUserId } from '@/lib/db/shop-context'

export interface UserProfile {
  fullName: string
  email: string
  phone: string
}

export async function getProfile(): Promise<UserProfile> {
  const empty: UserProfile = { fullName: '', email: '', phone: '' }
  const userId = await getCurrentUserId()
  if (!userId) return empty

  const rows = await db.select({
    full_name: users.full_name,
    email: users.email,
    phone: users.phone,
  }).from(users).where(eq(users.id, userId)).limit(1)

  if (rows.length === 0) return empty
  return {
    fullName: rows[0].full_name ?? '',
    email:    rows[0].email ?? '',
    phone:    rows[0].phone ?? '',
  }
}
