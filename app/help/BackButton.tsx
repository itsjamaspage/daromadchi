'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

export default function BackButton() {
  const router = useRouter()

  function goBack() {
    // Return to the previously visited page/section; fall back to the dashboard
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <button
      onClick={goBack}
      aria-label="Back"
      className="flex items-center justify-center w-8 h-8 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--c1)] hover:border-[var(--border2)] transition-colors"
    >
      <ArrowLeft className="w-4 h-4" />
    </button>
  )
}
