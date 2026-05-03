import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Daromadchi — Uzum Market Analytics',
  description: 'Uzum marketplace sotuvchilar uchun analitika paneli',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz">
      <body className="bg-[#0a0a0f] text-slate-200 antialiased">
        {children}
      </body>
    </html>
  )
}
