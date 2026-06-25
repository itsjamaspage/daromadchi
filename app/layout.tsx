import type { Metadata } from 'next'
import { Space_Grotesk, JetBrains_Mono } from 'next/font/google'
import { cookies } from 'next/headers'
import { Suspense } from 'react'
import './globals.css'
import Providers from './providers'
import type { Lang } from '@/lib/i18n'
import LoadingOverlay from './components/LoadingOverlay'
import NavigationEvents from './components/NavigationEvents'

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-space',
  weight: ['300', '400', '500', '600', '700'],
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono-landing',
  weight: ['400', '500', '600', '700'],
})

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
    <html lang={lang} className={`${spaceGrotesk.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning style={{ backgroundColor: '#161616' }}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icon.svg" />
        <meta name="theme-color" content="#16A34A" />
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('theme');document.documentElement.setAttribute('data-theme',t||'dark');}catch(e){document.documentElement.setAttribute('data-theme','dark');}})()` }} />
      </head>
      <body className="antialiased">
        <div style={{ position: 'relative', zIndex: 1 }}>
          <Providers initialLang={lang}>{children}</Providers>
          <Suspense><NavigationEvents /></Suspense>
          <LoadingOverlay />
        </div>
      </body>
    </html>
  )
}
