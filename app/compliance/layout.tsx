import type { Metadata } from 'next'
import Link from 'next/link'
import ComplianceHeaderControls from './ComplianceHeaderControls'

export const metadata: Metadata = {
  title: 'Ma\'lumotlar Muvofiqlik — Daromadchi',
  description: 'Daromadchi platformasida shaxsiy ma\'lumotlarni qayta ishlash, xavfsizlik va O\'zbekiston qonunlariga muvofiqlik hujjati.',
}

export default function ComplianceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <header
        className="border-b border-[var(--border)] bg-[var(--nav-bg)] backdrop-blur-md sticky top-0 z-40"
        style={{ height: 68 }}
      >
        <div className="max-w-6xl mx-auto px-6 sm:px-8 h-full flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <img src="/icon.svg" alt="Daromadchi" className="w-9 h-9 rounded-xl" />
            <span className="font-bold text-base text-[var(--text-base)] group-hover:text-[var(--c1)] transition-colors">
              Daromadchi
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <ComplianceHeaderControls />
            <Link
              href="/dashboard"
              className="px-4 py-2 rounded-xl bg-[var(--c1)] text-[#020c1a] font-bold text-sm hover:opacity-90 transition-opacity hidden sm:block"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      {children}
    </div>
  )
}
