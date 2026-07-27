'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

const POLL_INTERVAL_MS = 60_000

export function useSyncPolling(initialLastSyncedAt: string | null) {
  const [hasNewData, setHasNewData] = useState(false)
  const baselineRef = useRef(initialLastSyncedAt)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const poll = useCallback(async () => {
    try {
      const res = await fetch('/api/sync-status')
      if (!res.ok) return
      const { lastSyncedAt } = await res.json() as { lastSyncedAt: string | null }
      if (
        lastSyncedAt &&
        baselineRef.current &&
        new Date(lastSyncedAt).getTime() > new Date(baselineRef.current).getTime()
      ) {
        setHasNewData(true)
      }
    } catch { /* network error — skip this poll */ }
  }, [])

  const startPolling = useCallback(() => {
    if (intervalRef.current) return
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS)
  }, [poll])

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const refresh = useCallback(() => {
    setHasNewData(false)
    baselineRef.current = new Date().toISOString()
  }, [])

  useEffect(() => {
    startPolling()
    const handler = () => {
      if (document.visibilityState === 'visible') startPolling()
      else stopPolling()
    }
    document.addEventListener('visibilitychange', handler)
    return () => {
      stopPolling()
      document.removeEventListener('visibilitychange', handler)
    }
  }, [startPolling, stopPolling])

  return { hasNewData, refresh }
}
