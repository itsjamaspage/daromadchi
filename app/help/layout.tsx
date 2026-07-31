import type { Metadata } from 'next'
import Link from 'next/link'
import HelpHeaderControls from './HelpHeaderControls'
import BackButton from './BackButton'

export const metadata: Metadata = {
  title: 'Help Center — Daromadchi',
  description: 'Guides and articles for using the Daromadchi platform',
}

export default function HelpLayout({ children }: { children: React.ReactNode }) {
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

          <HelpHeaderControls />
        </div>
      </header>

      {children}
    </div>
  )
}

