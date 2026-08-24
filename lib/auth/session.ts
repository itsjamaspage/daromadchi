import { auth } from './config'
import { decode } from 'next-auth/jwt'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function getCurrentUser() {
  const session = await auth()

  if (!session?.user?.email) {
    return null
  }

  // Emails are stored lowercased (signup, Google sign-in, credentials all
  // normalize). Match case-insensitively so a session whose email arrives in a
  // different case (e.g. an OAuth provider that preserves the typed casing)
  // still resolves to the SAME account — instead of finding no row and
  // rendering an "authenticated but empty" dashboard.
  const user = await db.query.users.findFirst({
    where: eq(users.email, session.user.email.trim().toLowerCase()),
  })

  return user
}

export async function requireAuth() {
  const user = await getCurrentUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  return user
}

/**
 * Authenticate a request that carries a Bearer token (NextAuth JWT).
 * Returns the user row or null.
 */
export async function getUserFromBearerToken(authHeader: string | null) {
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return null

  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET
  if (!secret) return null

  try {
    const payload = await decode({ token, secret, salt: '' })
    const email = payload?.email as string | undefined
    if (!email) return null
    return await db.query.users.findFirst({
      where: eq(users.email, email.trim().toLowerCase()),
    }) ?? null
  } catch {
    return null
  }
}
