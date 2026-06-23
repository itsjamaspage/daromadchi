import type { Metadata } from 'next'
import Link from 'next/link'
import HelpHeaderControls from '@/app/help/HelpHeaderControls'
import BackButton from '@/app/help/BackButton'

export const metadata: Metadata = {
  title: 'Privacy Policy — Daromadchi',
  description: 'Daromadchi Chrome Extension privacy policy',
}

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <header className="border-b border-[var(--border)] bg-[var(--nav-bg)] backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BackButton />
            <Link href="/" className="flex items-center gap-2 group">
              <img src="/icon.svg" alt="Daromadchi" className="w-7 h-7 rounded-lg" />
              <span className="font-semibold text-[var(--text-base)] text-sm group-hover:text-[var(--c1)] transition-colors">
                Daromadchi
              </span>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <HelpHeaderControls />
            <Link
              href="/dashboard"
              className="px-3 py-1.5 rounded-lg bg-[var(--c1)] text-[#020c1a] font-semibold text-xs hover:opacity-90 transition-opacity"
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
