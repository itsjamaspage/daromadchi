'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Package, ShoppingCart,
  ChevronRight, X, BarChart2, Calculator, FileText,
  Megaphone, Layers, AlertTriangle, CreditCard,
  CalendarDays, Users, Boxes,
} from 'lucide-react'
import { useLang, useTheme } from '@/app/providers'
import { translations } from '@/lib/i18n'
import HelpTooltip from '@/components/dashboard/HelpTooltip'
import { helpContent, type HelpSection } from '@/lib/help-tooltips'

type NavItem = { href: string; key: string; icon: React.ElementType }

const storeNavItems: NavItem[] = [
  { href: '/dashboard',                key: 'dashboard',     icon: LayoutDashboard },
  { href: '/dashboard/products',       key: 'products',      icon: Package         },
  { href: '/dashboard/stocks',         key: 'stocks',        icon: Boxes           },
  { href: '/dashboard/orders',         key: 'orders',        icon: ShoppingCart    },
  { href: '/dashboard/analytics',      key: 'analytics',     icon: BarChart2       },
  { href: '/dashboard/advertising',    key: 'advertising',   icon: Megaphone       },
  { href: '/dashboard/unit-economics', key: 'unitEconomics', icon: Layers          },
  { href: '/dashboard/pnl',            key: 'pnl',           icon: FileText        },
  { href: '/dashboard/calculator',     key: 'calculator',    icon: Calculator      },
  { href: '/dashboard/team',           key: 'team',          icon: Users           },
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
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const d = translations[lang].dashboard

  const sideBg     = isDark ? 'var(--bg-card)'                  : '#e8f0fd'
  const sideBdr    = isDark ? 'var(--border)'                   : 'rgba(14,34,51,0.1)'
  const sideLabel  = isDark ? 'var(--c1)'                       : 'rgba(14,34,51,0.5)'
  const sideText   = isDark ? 'var(--text-muted)'               : 'rgba(14,34,51,0.75)'
  const sideTitle  = isDark ? 'var(--text-base)'                : '#0e1b2e'
  const activeCol  = isDark ? 'var(--c1)'                       : '#0e1b2e'
  const activeBg   = isDark ? 'rgba(255,255,255,0.10)'          : 'rgba(14,27,46,0.1)'
  const activeBdr  = isDark ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(14,27,46,0.18)'

  function handleNavClick() {
    onClose?.()
  }

  return (
    <aside
      className={`${onClose ? 'sidebar-full' : 'sidebar-collapse'} h-full flex flex-col overflow-hidden`}
      style={{ background: sideBg, borderRight: `1px solid ${sideBdr}` }}
    >
      {/* Logo */}
      <div className="sidebar-logo-row flex items-center justify-between shrink-0" style={{ borderBottom: `1px solid ${sideBdr}` }}>
        <Link href="/dashboard" onClick={handleNavClick} className="flex items-center gap-3 min-w-0">
          <img src="/icon.svg" alt="Daromadchi" className="w-8 h-8 rounded-xl flex-shrink-0" />
          <span className="sidebar-label font-bold text-sm tracking-tight truncate" style={{ color: sideTitle }}>Daromadchi</span>
        </Link>
        {onClose && (
          <button onClick={onClose} className="lg:hidden p-1 ml-2" style={{ color: sideText }}>
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 space-y-0.5 overflow-y-auto overflow-x-hidden px-1.5">
        <p className="sidebar-label px-2 pt-1 pb-1.5 text-[9px] font-semibold uppercase tracking-widest truncate"
          style={{ color: sideLabel }}>
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
                  background: activeBg,
                  color: activeCol,
                  border: activeBdr,
                } : {
                  color: sideText,
                  border: '1px solid transparent',
                }}
              >
                <Icon className="w-4 h-4 flex-shrink-0" style={{ color: active ? activeCol : sideText }} />
                <span className="sidebar-label truncate flex-1">{label}</span>
                {active && <ChevronRight className="sidebar-label w-3 h-3 flex-shrink-0" style={{ color: activeCol }} />}
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
