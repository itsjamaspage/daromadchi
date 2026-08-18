/**
 * Single-admin gate.
 *
 * Identity comes from the ADMIN_EMAIL env var — the SAME mechanism the existing
 * admin-only category endpoints already use (app/api/categories/{unmatched,
 * suggestions}/route.ts). There is no is_admin column and no schema change: the
 * owner's email is configuration, not data, so it cannot be escalated by anything
 * that can write to the users table.
 *
 * Unset ADMIN_EMAIL ⇒ NOBODY is an admin (fail closed).
 */
import 'server-only'
import { getCurrentUser } from './session'

function normalize(v: string | null | undefined): string | null {
  const s = v?.trim().toLowerCase()
  return s ? s : null
}

/** True only when `email` matches the configured ADMIN_EMAIL (case-insensitive). */
export function isAdminEmail(email: string | null | undefined): boolean {
  const configured = normalize(process.env.ADMIN_EMAIL)
  const candidate = normalize(email)
  return configured !== null && candidate !== null && configured === candidate
}

/**
 * The signed-in admin, or null for anonymous visitors AND for signed-in
 * non-admins. Callers MUST treat null as "deny" — never as "unknown".
 */
export async function getAdminUser() {
  const user = await getCurrentUser()
  if (!user || !isAdminEmail(user.email)) return null
  return user
}

/** Route-handler helper: null when allowed, else the response shape to return. */
export async function requireAdminApi(): Promise<{ error: string; status: 401 | 403 } | null> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Unauthorized', status: 401 }
  if (!isAdminEmail(user.email)) return { error: 'Forbidden', status: 403 }
  return null
}
