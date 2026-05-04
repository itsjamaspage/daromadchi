'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard, Package, ShoppingCart, TrendingUp,
  LogOut, ChevronRight, X, Settings, BarChart2, Calculator, FileText, Globe2,
} from 'lucide-react'

type NavItem = { href: string; label: string; icon: React.ElementType }

const storeNav: NavItem[] = [
  { href: '/dashboard',            label: 'Dashboard',     icon: LayoutDashboard },
  { href: '/dashboard/products',   label: 'Mahsulotlar',   icon: Package         },
  { href: '/dashboard/orders',     label: 'Buyurtmalar',   icon: ShoppingCart    },
  { href: '/dashboard/analytics',  label: 'Tahlil',        icon: BarChart2       },
  { href: '/dashboard/pnl',        label: 'F & Z hisobot', icon: FileText        },
  { href: '/dashboard/calculator', label: 'Kalkulyator',   icon: Calculator      },
]

const marketNav: NavItem[] = [
  { href: '/dashboard/market', label: 'Bozor tadqiqoti', icon: Globe2 },
]

interface SidebarProps {
  onClose?: () => void
}

function NavSection({
  items,
  label,
  labelColor,
  pathname,
  onNavClick,
}: {
  items: NavItem[]
  label: string
  labelColor: string
  pathname: string
  onNavClick: () => void
}) {
  return (
    <div>
      <p className={`px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest ${labelColor}`}>
        {label}
      </p>
      <div className="space-y-0.5">
        {items.map(({ href, label: itemLabel, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavClick}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                active
                  ? 'bg-violet-600/20 text-violet-300 border border-violet-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-violet-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
              {itemLabel}
              {active && <ChevronRight className="w-3 h-3 ml-auto text-violet-400" />}
            </Link>
          )
        })}
      </div>
    </div>
  )
}

export default function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  function handleNavClick() {
    onClose?.()
  }

  return (
    <aside className="h-full w-60 bg-[#0d0d1a] border-r border-white/[0.05] flex flex-col">
      {/* Logo row */}
      <div className="p-5 border-b border-white/[0.05] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-md shadow-violet-500/30">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-bold text-white text-base tracking-tight">Daromadchi</span>
            <p className="text-[10px] text-slate-500 leading-none mt-0.5">Uzum Market</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden text-slate-500 hover:text-white transition-colors p-1"
            aria-label="Yopish"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
        <NavSection
          items={storeNav}
          label="Do'konim"
          labelColor="text-violet-400/60"
          pathname={pathname}
          onNavClick={handleNavClick}
        />

        <div className="border-t border-white/[0.04]" />

        <NavSection
          items={marketNav}
          label="Bozor"
          labelColor="text-cyan-400/60"
          pathname={pathname}
          onNavClick={handleNavClick}
        />
      </nav>

      {/* Settings + Logout */}
      <div className="p-3 border-t border-white/[0.05] space-y-0.5">
        <Link
          href="/dashboard/settings"
          onClick={handleNavClick}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
            pathname === '/dashboard/settings'
              ? 'bg-violet-600/20 text-violet-300 border border-violet-500/20'
              : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
          }`}
        >
          <Settings className={`w-4 h-4 flex-shrink-0 ${pathname === '/dashboard/settings' ? 'text-violet-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
          Sozlamalar
          {pathname === '/dashboard/settings' && <ChevronRight className="w-3 h-3 ml-auto text-violet-400" />}
        </Link>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/[0.08] transition-all"
        >
          <LogOut className="w-4 h-4" />
          Chiqish
        </button>
      </div>
    </aside>
  )
}
