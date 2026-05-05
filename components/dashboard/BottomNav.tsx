'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Package, ShoppingCart, Calculator, Settings } from 'lucide-react'

const tabs = [
  { href: '/dashboard',            label: 'Bosh',        icon: LayoutDashboard },
  { href: '/dashboard/products',   label: 'Mahsulot',    icon: Package         },
  { href: '/dashboard/orders',     label: 'Buyurtma',    icon: ShoppingCart    },
  { href: '/dashboard/calculator', label: 'Kalkulyator', icon: Calculator      },
  { href: '/dashboard/settings',   label: 'Sozlama',     icon: Settings        },
]

export default function BottomNav() {
  const pathname = usePathname()
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-white/[0.06] bg-[#0d0d1a]/95 backdrop-blur-xl">
      <div className="flex items-stretch h-16">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link key={href} href={href}
              className={`flex-1 flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-all ${
                active ? 'text-violet-400' : 'text-slate-500 hover:text-slate-300'
              }`}>
              <div className={`w-8 h-6 flex items-center justify-center rounded-lg transition-all ${
                active ? 'bg-violet-500/15' : ''
              }`}>
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
