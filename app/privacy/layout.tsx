import type { Metadata } from 'next'
import Link from 'next/link'
import PrivacyHeaderControls from './PrivacyHeaderControls'
import BackButton from '@/app/help/BackButton'

export const metadata: Metadata = {
  title: 'Privacy Policy — Daromadchi',
  description: 'Daromadchi Chrome Extension privacy policy',
}

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <header className="border-b border-[var(--border)] bg-[var(--nav-bg)] backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-6 sm:px-8 h-18 flex items-center justify-between" style={{ height: 68 }}>
          <div className="flex items-center gap-4">
            <BackButton />
            <Link href="/" className="flex items-center gap-3 group">
              <img src="/icon.svg" alt="Daromadchi" className="w-9 h-9 rounded-xl" />
              <span className="font-bold text-[var(--text-base)] text-base group-hover:text-[var(--c1)] transition-colors">
                Daromadchi
              </span>
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <PrivacyHeaderControls />
            <Link
              href="/dashboard"
              className="px-4 py-2 rounded-xl bg-[var(--c1)] text-[#020c1a] font-bold text-sm hover:opacity-90 transition-opacity"
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
