'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard, Package, ShoppingCart,
  LogOut, ChevronRight, X, Settings, BarChart2, Calculator, FileText,
  Sun, Moon, Megaphone, Database, Layers, Bell, BellRing, AlertTriangle, CreditCard,
  CalendarDays, Users, HelpCircle, UserCircle,
} from 'lucide-react'
import { useTheme, useLang } from '@/app/providers'
import { translations } from '@/lib/i18n'
import type { Lang } from '@/lib/i18n'
import HelpTooltip from '@/components/dashboard/HelpTooltip'
import { helpContent, type HelpSection } from '@/lib/help-tooltips'
import Glossary from '@/components/dashboard/Glossary'

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
  { href: '/dashboard/alerts',         key: 'alerts',        icon: AlertTriangle   },
  { href: '/dashboard/payouts',        key: 'payouts',       icon: CreditCard      },
  { href: '/dashboard/seasonality',    key: 'seasonality',   icon: CalendarDays    },
]

const settingsNavItems: NavItem[] = [
  { href: '/dashboard/notifications', key: 'notifications', icon: BellRing    },
  { href: '/dashboard/billing',       key: 'billing',       icon: CreditCard  },
  { href: '/dashboard/profile',       key: 'profile',       icon: UserCircle  },
  { href: '/help',                    key: 'help',          icon: HelpCircle  },
]

const SETTINGS_LABELS: Record<string, string> = {
  notifications: 'Bildirishnomalar',
  billing:       "Tarif va to'lov",
  profile:       'Profil',
  help:          'Yordam markazi',
}

interface SidebarProps {
  onClose?: () => void
}

const LANGS: { value: Lang; label: string }[] = [
  { value: 'uz', label: 'UZ' },
  { value: 'ru', label: 'RU' },
  { value: 'en', label: 'EN' },
]

export default function Sidebar({ onClose }: SidebarProps) {
  const pathname          = usePathname()
  const router            = useRouter()
  const supabase          = createClient()
  const { theme, toggle } = useTheme()
  const { lang, setLang } = useLang()
  const d                 = translations[lang].dashboard

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  function handleNavClick() {
    onClose?.()
  }

  const settingsActive = pathname === '/dashboard/settings'

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

        {/* Store section */}
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
                  background: 'rgba(124,58,237,0.12)',
                  color: 'var(--c1)',
                  border: '1px solid rgba(124,58,237,0.2)',
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

        <div className="my-2 mx-2" style={{ borderTop: '1px solid var(--border)' }} />

        {/* Settings section */}
        <p className="sidebar-label px-2 pb-1.5 text-[9px] font-semibold uppercase tracking-widest truncate"
          style={{ color: 'var(--c1)' }}>
          {d.nav.settings ?? 'Sozlamalar'}
        </p>
        {settingsNavItems.map(({ href, key, icon: Icon }) => {
          const active = pathname === href
          const label = (d.nav as unknown as Record<string, string>)[key] ?? SETTINGS_LABELS[key] ?? key
          return (
            <Link
              key={href}
              href={href}
              onClick={handleNavClick}
              title={label}
              className="flex items-center gap-3 px-2 py-2 rounded-xl text-sm font-medium transition-all"
              style={active ? {
                background: 'rgba(124,58,237,0.12)',
                color: 'var(--c1)',
                border: '1px solid rgba(124,58,237,0.2)',
              } : {
                color: 'var(--text-muted)',
                border: '1px solid transparent',
              }}
            >
              <Icon className="w-4 h-4 flex-shrink-0" style={{ color: active ? 'var(--c1)' : 'var(--text-muted)' }} />
              <span className="sidebar-label truncate">{label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Bottom controls */}
      <div className="shrink-0 px-1.5 pb-3 space-y-1" style={{ borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
        {/* Theme + Lang row */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={toggle}
            title={theme === 'dark' ? d.lightMode : d.darkMode}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-all flex-shrink-0"
            style={{ color: 'var(--text-muted)', background: 'var(--bg-input)' }}
          >
            {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
          <div className="sidebar-label flex items-center gap-1 flex-1 overflow-hidden">
            {LANGS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setLang(value)}
                className="flex-1 text-[9px] font-semibold py-1 rounded-lg transition-all"
                style={lang === value ? {
                  background: 'rgba(124,58,237,0.12)',
                  color: 'var(--c1)',
                  border: '1px solid rgba(124,58,237,0.2)',
                } : {
                  color: 'var(--text-muted)',
                  border: '1px solid transparent',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="sidebar-label">
          <Glossary />
        </div>

        <Link
          href="/dashboard/settings"
          onClick={handleNavClick}
          title={d.nav.settings ?? 'Sozlamalar'}
          className="flex items-center gap-3 px-2 py-2 rounded-xl text-sm font-medium transition-all"
          style={settingsActive ? {
            background: 'rgba(124,58,237,0.12)',
            color: 'var(--c1)',
            border: '1px solid rgba(124,58,237,0.2)',
          } : {
            color: 'var(--text-muted)',
            border: '1px solid transparent',
          }}
        >
          <Settings className="w-4 h-4 flex-shrink-0" style={{ color: settingsActive ? 'var(--c1)' : 'var(--text-muted)' }} />
          <span className="sidebar-label truncate">{d.nav.settings ?? 'Sozlamalar'}</span>
        </Link>

        <button
          onClick={handleLogout}
          title={d.nav.logout ?? 'Chiqish'}
          className="w-full flex items-center gap-3 px-2 py-2 rounded-xl text-sm font-medium transition-all"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#f87171'; (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.06)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          <span className="sidebar-label truncate">{d.nav.logout ?? 'Chiqish'}</span>
        </button>
      </div>
    </aside>
  )
}
