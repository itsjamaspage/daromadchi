'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Package, ShoppingCart, Calculator, Settings } from 'lucide-react'
import { useLang } from '@/app/providers'
import { translations } from '@/lib/i18n'

export default function BottomNav() {
  const pathname = usePathname()
  const { lang } = useLang()
  const d = translations[lang].dashboard

  const tabs = [
    { href: '/dashboard',            label: d.nav.dashboard,   icon: LayoutDashboard },
    { href: '/dashboard/products',   label: d.nav.products,    icon: Package         },
    { href: '/dashboard/orders',     label: d.nav.orders,      icon: ShoppingCart    },
    { href: '/dashboard/calculator', label: d.nav.calculator,  icon: Calculator      },
    { href: '/dashboard/settings',   label: d.nav.settings,    icon: Settings        },
  ]

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--border)] bg-[var(--bg-card)]/95 backdrop-blur-xl">
      <div className="flex items-stretch h-16">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link key={href} href={href}
              className="flex-1 flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-all"
              style={{ color: active ? 'var(--c1)' : 'var(--text-muted)' }}>
              <div className="w-8 h-6 flex items-center justify-center rounded-lg transition-all"
                style={{ background: active ? 'rgba(0,0,0,0.06)' : 'transparent' }}>
                <Icon className="w-4 h-4" />
              </div>
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
