'use client'

import Link from 'next/link'
import { XCircle } from 'lucide-react'

export default function CancelPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--bg-base)', color: 'var(--text-base)' }}>
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
          <XCircle className="w-10 h-10 text-red-400" />
        </div>
        <h1 className="text-2xl font-black mb-3">To'lov bekor qilindi</h1>
        <p className="mb-8" style={{ color: 'var(--text-muted)' }}>
          To'lov amalga oshmadi. Qaytadan urinib ko'ring yoki boshqa usulni tanlang.
        </p>
        <div className="flex gap-3 justify-center">
          <Link href="/pricing"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold px-6 py-3 rounded-xl transition-all">
            Qayta urinish
          </Link>
          <Link href="/dashboard"
            className="inline-flex items-center px-6 py-3 rounded-xl border font-medium transition-all"
            style={{ borderColor: 'var(--border2)', color: 'var(--text-dim)' }}>
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
