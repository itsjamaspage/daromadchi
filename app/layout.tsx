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
  title: {
    default: 'Daromadchi — Uzum, Wildberries, Yandex Market analitika platformasi',
    template: '%s | Daromadchi',
  },
  description: 'Uzum, Wildberries va Yandex Market sotuvchilari uchun marketplace analitika platformasi. Sotuv tahlili, daromad va foyda hisoblash, tovar analitikasi — barchasi bir joyda.',
  keywords: ['marketplace analitika', 'Uzum sotuvchilar uchun', 'Wildberries analitika', 'Yandex Market analitika', 'sotuv tahlili', 'daromad va foyda hisoblash', 'tovar analitikasi', 'marketplace analytics Uzbekistan'],
  metadataBase: new URL('https://www.daromadchi.uz'),
  openGraph: {
    type: 'website',
    locale: 'uz_UZ',
    url: 'https://www.daromadchi.uz',
    siteName: 'Daromadchi',
    title: 'Daromadchi — Uzum, Wildberries, Yandex Market analitika platformasi',
    description: 'Uzum, Wildberries va Yandex Market sotuvchilari uchun marketplace analitika. Sotuv tahlili, daromad va foyda hisoblash, tovar analitikasi.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Daromadchi — Marketplace Analytics' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Daromadchi — Marketplace analitika platformasi',
    description: 'Uzum, Wildberries va Yandex Market sotuvchilari uchun sotuv tahlili va analitika.',
    images: ['/og-image.png'],
  },
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
  alternates: {
    canonical: 'https://www.daromadchi.uz',
  },
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const lang = (cookieStore.get('lang')?.value ?? 'uz') as Lang

  return (
    <html lang={lang} className={`${spaceGrotesk.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icon.svg" />
        <meta name="theme-color" content="#161616" media="(prefers-color-scheme: dark)" />
        <meta name="theme-color" content="#83c0f7" media="(prefers-color-scheme: light)" />
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('theme');document.documentElement.setAttribute('data-theme',t||'light');document.documentElement.style.backgroundColor=t==='dark'?'#161616':'#83c0f7';}catch(e){document.documentElement.setAttribute('data-theme','light');document.documentElement.style.backgroundColor='#83c0f7';}})()` }} />
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
