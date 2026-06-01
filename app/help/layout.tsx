import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Yordam Markazi — Daromadchi',
  description: "Daromadchi platformasidan foydalanish bo'yicha qo'llanmalar va maqolalar",
}

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      {/* Top bar */}
      <header className="border-b border-[var(--border)] bg-[var(--nav-bg)] backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[var(--c1)] to-[var(--c2)] flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <span className="font-bold text-[var(--text-base)] text-sm group-hover:text-[var(--c1)] transition-colors" style={{ fontFamily: 'var(--font-display)' }}>
              Daromadchi
            </span>
          </Link>

          <nav className="flex items-center gap-4 text-sm">
            <Link href="/help" className="text-[var(--text-muted)] hover:text-[var(--c1)] transition-colors">
              Yordam markazi
            </Link>
            <Link
              href="/dashboard"
              className="px-3 py-1.5 rounded-lg bg-[var(--c1)] text-[#020c1a] font-semibold text-xs hover:opacity-90 transition-opacity"
            >
              Dashboard
            </Link>
          </nav>
        </div>
      </header>

      {children}
    </div>
  )
}
