/**
 * Owner-only analytics. Gated server-side: a non-admin never gets the HTML,
 * let alone the data. The matching API route (app/api/admin/analytics) repeats
 * the same check independently.
 */
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getAdminUser } from '@/lib/auth/admin'
import { getAdminAnalytics } from '@/lib/db/admin-analytics'
import AdminClient from './AdminClient'

// Always render per request: these numbers must never be served from a cache
// that could outlive the admin session.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function AdminPage() {
  const admin = await getAdminUser()
  if (!admin) redirect('/dashboard')

  const data = await getAdminAnalytics()
  return <AdminClient data={data} />
}
