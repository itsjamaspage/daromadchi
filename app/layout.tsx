import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import './globals.css'
import Providers from './providers'
import type { Lang } from '@/lib/i18n'

export const metadata: Metadata = {
  title: 'Daromadchi — Multi-Marketplace Analytics',
  description: 'Uzum Market, Yandex Market va Wildberries sotuvchilari uchun analitika platformasi',
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const lang = (cookieStore.get('lang')?.value ?? 'uz') as Lang

  return (
    <html lang={lang} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icon.svg" />
        <meta name="theme-color" content="#00d4ff" />
        {/* Apply saved theme before first paint to avoid flash */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('theme');document.documentElement.setAttribute('data-theme',t||'dark');}catch(e){document.documentElement.setAttribute('data-theme','dark');}})()` }} />
      </head>
      <body className="antialiased">
        <Providers initialLang={lang}>{children}</Providers>
      </body>
    </html>
  )
}
