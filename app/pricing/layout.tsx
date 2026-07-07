import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Tariflar',
  description: 'Daromadchi tariflar — Bepul, Pro va Pro+ rejalar. Uzum, Wildberries va Yandex Market sotuvchilari uchun marketplace analitika. Oylik 300,000 so\'mdan boshlanadi.',
  openGraph: {
    title: 'Daromadchi tariflar — Bepul, Pro va Pro+ rejalar',
    description: 'Marketplace analitika platformasi narxlari. Bepul sinab ko\'ring, keyin Pro yoki Pro+ rejaga o\'ting.',
    url: 'https://www.daromadchi.uz/pricing',
  },
  alternates: { canonical: 'https://www.daromadchi.uz/pricing' },
}

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children
}
