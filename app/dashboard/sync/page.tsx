import { redirect } from 'next/navigation'

// Sync now lives entirely on the Settings page (token entry + sync + Telegram),
// so there is a single sync surface for the whole app. This route is kept only
// to redirect any old links/bookmarks.
export default function SyncStatusPage() {
  redirect('/dashboard/settings')
}
