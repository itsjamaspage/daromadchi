'use client'

import { useEffect } from 'react'
import { markNotificationsSeen } from '@/lib/notif-seen'

// Renders nothing — its only job is to record, when the notifications page
// mounts, that the user has now seen the current set of alerts, which clears
// the top-bar badge.
export default function MarkNotificationsSeen({ count }: { count: number }) {
  useEffect(() => {
    markNotificationsSeen(count)
  }, [count])
  return null
}
