'use client'

import { useEffect } from 'react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Dashboard error]', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
        Sahifani yuklashda xatolik yuz berdi
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 rounded-xl text-sm font-medium transition-opacity hover:opacity-80"
        style={{ background: 'var(--c1)', color: '#fff' }}
      >
        Qayta urinish
      </button>
    </div>
  )
}
