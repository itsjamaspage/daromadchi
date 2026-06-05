'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard, Package, ShoppingCart,
  LogOut, ChevronRight, X, Settings, BarChart2, Calculator, FileText, Globe2,
  Sun, Moon, Megaphone, Search, Database, Layers, Bell, CreditCard, Tag,
  CalendarDays, Users, HelpCircle, UserCircle, Monitor,
} from 'lucide-react'
import { useTheme, useLang } from '@/app/providers'
import { translations } from '@/lib/i18n'
import type { Lang } from '@/lib/i18n'
import HelpTooltip from '@/components/dashboard/HelpTooltip'
import { helpContent, type HelpSection } from '@/lib/help-tooltips'
import Glossary from '@/components/dashboard/Glossary'

type NavItem = { href: string; key: string; icon: React.ElementType }

const hasHelp = (key: string): key is HelpSection => key in helpContent

const storeNavItems: NavItem[] = [
  { href: '/dashboard',                key: 'dashboard',     icon: LayoutDashboard },
  { href: '/dashboard/products',       key: 'products',      icon: Package         },
  { href: '/dashboard/orders',         key: 'orders',        icon: ShoppingCart    },
  { href: '/dashboard/analytics',      key: 'analytics',     icon: BarChart2       },
  { href: '/dashboard/advertising',    key: 'advertising',   icon: Megaphone       },
  { href: '/dashboard/unit-economics', key: 'unitEconomics', icon: Layers          },
  { href: '/dashboard/pnl',            key: 'pnl',           icon: FileText        },
  { href: '/dashboard/calculator',     key: 'calculator',    icon: Calculator      },
  { href: '/dashboard/keywords',       key: 'keywords',      icon: Search          },
  { href: '/dashboard/team',           key: 'team',          icon: Users           },
  { href: '/dashboard/data-state',     key: 'dataState',     icon: Database        },
  { href: '/dashboard/price-tracking', key: 'priceTracking', icon: Tag             },
  { href: '/dashboard/alerts',         key: 'alerts',        icon: Bell            },
  { href: '/dashboard/payouts',        key: 'payouts',       icon: CreditCard      },
  { href: '/dashboard/seasonality',    key: 'seasonality',   icon: CalendarDays    },
]

const settingsNavItems: NavItem[] = [
  { href: '/dashboard/notifications', key: 'notifications', icon: Bell        },
  { href: '/dashboard/billing',       key: 'billing',       icon: CreditCard  },
  { href: '/dashboard/profile',       key: 'profile',       icon: UserCircle  },
  { href: '/dashboard/devices',       key: 'devices',       icon: Monitor     },
  { href: '/help',                    key: 'help',          icon: HelpCircle  },
]

const SETTINGS_LABELS: Record<string, string> = {
  notifications: 'Bildirishnomalar',
  billing:       "Tarif va to'lov",
  profile:       'Profil',
  devices:       'Qurilmalar',
  help:          'Yordam markazi',
}

interface SidebarProps {
  onClose?: () => void
}

function NavSection({
  items,
  label,
  pathname,
  onNavClick,
  navT,
  fallbackLabels,
}: {
  items: NavItem[]
  label: string
  pathname: string
  onNavClick: () => void
  navT: Record<string, string>
  fallbackLabels?: Record<string, string>
}) {
  return (
    <div>
      <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--c1)', opacity: 0.6 }}>
        {label}
      </p>
      <div className="space-y-0.5">
        {items.map(({ href, key, icon: Icon }) => {
          const active = pathname === href
          const itemLabel = navT[key] ?? fallbackLabels?.[key] ?? key
          const hasHelp = key in helpContent
          return (
            <div key={href} className="flex items-center gap-0.5">
              <Link
                href={href}
                onClick={onNavClick}
                className="flex-1 min-w-0 flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
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
                <span className="truncate">{itemLabel}</span>
                {active && <ChevronRight className="w-3 h-3 ml-auto flex-shrink-0" style={{ color: 'var(--c1)' }} />}
              </Link>
              {hasHelp && <HelpTooltip section={key as HelpSection} variant="plain" />}
            </div>
          )
        })}
      </div>
    </div>
  )
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
    <aside className="h-full w-60 flex flex-col" style={{ background: 'var(--bg-card)', borderRight: '1px solid var(--border)' }}>
      {/* Logo row */}
      <div className="p-5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
        <Link href="/dashboard" className="flex items-center gap-3 group">
          <img src="/icon.svg" alt="Daromadchi" className="w-9 h-9 rounded-xl shadow-md" />
          <div>
            <span className="font-bold text-base tracking-tight transition-colors" style={{ color: 'var(--text-base)' }}>Daromadchi</span>
            <p className="text-[10px] leading-none mt-0.5" style={{ color: 'var(--text-muted)' }}>Uzum Market</p>
          </div>
        </Link>
        {onClose && (
          <button onClick={onClose} className="lg:hidden transition-colors p-1" style={{ color: 'var(--text-muted)' }}>
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
        <NavSection
          items={storeNavItems}
          label={d.nav.store}
          pathname={pathname}
          onNavClick={handleNavClick}
          navT={d.nav as unknown as Record<string, string>}
        />

        <div style={{ borderTop: '1px solid var(--border)' }} />

        <NavSection
          items={[{ href: '/dashboard/market', key: 'marketResearch', icon: Globe2 }]}
          label={d.nav.market}
          pathname={pathname}
          onNavClick={handleNavClick}
          navT={d.nav as unknown as Record<string, string>}
        />

        <div style={{ borderTop: '1px solid var(--border)' }} />

        <NavSection
          items={settingsNavItems}
          label={d.nav.settings ?? 'Sozlamalar'}
          pathname={pathname}
          onNavClick={handleNavClick}
          navT={d.nav as unknown as Record<string, string>}
          fallbackLabels={SETTINGS_LABELS}
        />
      </nav>

      {/* Theme + Language + Settings + Logout */}
      <div className="p-3 space-y-1" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2 px-1 py-1">
          <button
            onClick={toggle}
            title={theme === 'dark' ? d.lightMode : d.darkMode}
            className="flex items-center justify-center w-8 h-8 rounded-lg transition-all"
            style={{ color: 'var(--text-muted)', background: 'var(--bg-input)' }}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <div className="flex items-center gap-1 flex-1">
            {LANGS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setLang(value)}
                className="flex-1 text-[10px] font-semibold py-1 rounded-lg transition-all"
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

        <Glossary />

        <Link
          href="/dashboard/settings"
          onClick={handleNavClick}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
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
          {d.nav.settings ?? 'Sozlamalar'}
          {settingsActive && <ChevronRight className="w-3 h-3 ml-auto" style={{ color: 'var(--c1)' }} />}
        </Link>

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#f87171'; (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.06)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}
        >
          <LogOut className="w-4 h-4" />
          {d.nav.logout ?? 'Chiqish'}
        </button>
      </div>
    </aside>
  )
}
