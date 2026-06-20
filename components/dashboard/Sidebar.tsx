'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Package, ShoppingCart,
  ChevronRight, X, BarChart2, Calculator, FileText,
  Megaphone, Database, Layers, AlertTriangle, CreditCard,
  CalendarDays, Users, RefreshCw,
} from 'lucide-react'
import { useLang } from '@/app/providers'
import { translations } from '@/lib/i18n'
import HelpTooltip from '@/components/dashboard/HelpTooltip'
import { helpContent, type HelpSection } from '@/lib/help-tooltips'

type NavItem = { href: string; key: string; icon: React.ElementType }

const storeNavItems: NavItem[] = [
  { href: '/dashboard',                key: 'dashboard',     icon: LayoutDashboard },
  { href: '/dashboard/products',       key: 'products',      icon: Package         },
  { href: '/dashboard/orders',         key: 'orders',        icon: ShoppingCart    },
  { href: '/dashboard/analytics',      key: 'analytics',     icon: BarChart2       },
  { href: '/dashboard/advertising',    key: 'advertising',   icon: Megaphone       },
  { href: '/dashboard/unit-economics', key: 'unitEconomics', icon: Layers          },
  { href: '/dashboard/pnl',            key: 'pnl',           icon: FileText        },
  { href: '/dashboard/calculator',     key: 'calculator',    icon: Calculator      },
  { href: '/dashboard/team',           key: 'team',          icon: Users           },
  { href: '/dashboard/data-state',     key: 'dataState',     icon: Database        },
  { href: '/dashboard/sync',           key: 'sync',          icon: RefreshCw       },
  { href: '/dashboard/alerts',         key: 'alerts',        icon: AlertTriangle   },
  { href: '/dashboard/payouts',        key: 'payouts',       icon: CreditCard      },
  { href: '/dashboard/seasonality',    key: 'seasonality',   icon: CalendarDays    },
]

interface SidebarProps {
  onClose?: () => void
}

export default function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname()
  const { lang } = useLang()
  const d        = translations[lang].dashboard

  function handleNavClick() {
    onClose?.()
  }

  return (
    <aside
      className="sidebar-collapse h-full flex flex-col overflow-hidden"
      style={{ background: 'var(--bg-card)', borderRight: '1px solid var(--border)' }}
    >
      {/* Logo */}
      <div className="sidebar-logo-row flex items-center justify-between shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <Link href="/dashboard" onClick={handleNavClick} className="flex items-center gap-3 min-w-0">
          <img src="/icon.svg" alt="Daromadchi" className="w-8 h-8 rounded-xl flex-shrink-0" />
          <span className="sidebar-label font-bold text-sm tracking-tight truncate" style={{ color: 'var(--text-base)' }}>Daromadchi</span>
        </Link>
        {onClose && (
          <button onClick={onClose} className="lg:hidden p-1 ml-2" style={{ color: 'var(--text-muted)' }}>
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 space-y-0.5 overflow-y-auto overflow-x-hidden px-1.5">
        <p className="sidebar-label px-2 pt-1 pb-1.5 text-[9px] font-semibold uppercase tracking-widest truncate"
          style={{ color: 'var(--c1)' }}>
          {d.nav.store}
        </p>
        {storeNavItems.map(({ href, key, icon: Icon }) => {
          const active = pathname === href
          const label = (d.nav as unknown as Record<string, string>)[key] ?? key
          return (
            <div key={href} className="flex items-center">
              <Link
                href={href}
                onClick={handleNavClick}
                title={label}
                className="flex-1 flex items-center gap-3 px-2 py-2 rounded-xl text-sm font-medium transition-all min-w-0"
                style={active ? {
                  background: 'rgba(131,192,249,0.15)',
                  color: 'var(--c1)',
                  border: '1px solid rgba(131,192,249,0.3)',
                } : {
                  color: 'var(--text-muted)',
                  border: '1px solid transparent',
                }}
              >
                <Icon className="w-4 h-4 flex-shrink-0" style={{ color: active ? 'var(--c1)' : 'var(--text-muted)' }} />
                <span className="sidebar-label truncate flex-1">{label}</span>
                {active && <ChevronRight className="sidebar-label w-3 h-3 flex-shrink-0" style={{ color: 'var(--c1)' }} />}
              </Link>
              {(key in helpContent) && (
                <span className="sidebar-label">
                  <HelpTooltip section={key as HelpSection} variant="plain" />
                </span>
              )}
            </div>
          )
        })}
      </nav>
    </aside>
  )
}
