'use client'

import Link from 'next/link'
import { CheckCircle } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function SuccessContent() {
  const params  = useSearchParams()
  const provider = params.get('provider') ?? 'click'
  const label    = provider === 'payme' ? 'Payme' : 'Click'

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--bg-base)', color: 'var(--text-base)' }}>
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10 text-emerald-400" />
        </div>
        <h1 className="text-2xl font-black mb-3">To'lov muvaffaqiyatli!</h1>
        <p className="mb-2" style={{ color: 'var(--text-muted)' }}>
          {label} orqali to'lov qabul qilindi. Hisobingiz bir necha soniya ichida yangilanadi.
        </p>
        <p className="text-sm mb-8" style={{ color: 'var(--text-muted)' }}>
          Savol bo'lsa — <a href="https://t.me/itsjamaspage" target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:underline">@itsjamaspage</a>
        </p>
        <Link href="/dashboard"
          className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold px-6 py-3 rounded-xl transition-all shadow-lg shadow-violet-500/25">
          Dashboardga o'tish →
        </Link>
      </div>
    </div>
  )
}

export default function SuccessPage() {
  return (
    <Suspense>
      <SuccessContent />
    </Suspense>
  )
}
