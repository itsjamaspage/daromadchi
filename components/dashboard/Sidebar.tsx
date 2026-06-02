'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard, Package, ShoppingCart,
  LogOut, ChevronRight, X, Settings, BarChart2, Calculator, FileText, Globe2,
  Sun, Moon, Megaphone, Search, Database, Layers, Bell, CreditCard, Tag,
  MessageSquare, CalendarDays, Users, HelpCircle, UserCircle, Monitor,
} from 'lucide-react'
import { useTheme, useLang } from '@/app/providers'
import { translations } from '@/lib/i18n'
import type { Lang } from '@/lib/i18n'

type NavItem = { href: string; key: string; icon: React.ElementType }

const storeNavItems: NavItem[] = [
  { href: '/dashboard',                key: 'dashboard',     icon: LayoutDashboard },
  { href: '/dashboard/products',       key: 'products',      icon: Package         },
  { href: '/dashboard/orders',         key: 'orders',        icon: ShoppingCart    },
  { href: '/dashboard/analytics',      key: 'analytics',     icon: BarChart2       },
  { href: '/dashboard/advertising',    key: 'advertising',   icon: Megaphone       },
  { href: '/dashboard/search-phrases', key: 'searchPhrases', icon: Search          },
  { href: '/dashboard/unit-economics', key: 'unitEconomics', icon: Layers          },
  { href: '/dashboard/pnl',            key: 'pnl',           icon: FileText        },
  { href: '/dashboard/calculator',     key: 'calculator',    icon: Calculator      },
  { href: '/dashboard/keywords',       key: 'keywords',      icon: Search          },
  { href: '/dashboard/team',           key: 'team',          icon: Users           },
  { href: '/dashboard/data-state',     key: 'dataState',     icon: Database        },
  { href: '/dashboard/price-tracking', key: 'priceTracking', icon: Tag             },
  { href: '/dashboard/alerts',         key: 'alerts',        icon: Bell            },
  { href: '/dashboard/payouts',        key: 'payouts',       icon: CreditCard      },
  { href: '/dashboard/reviews',        key: 'reviews',       icon: MessageSquare   },
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
  labelColor,
  pathname,
  onNavClick,
  navT,
  fallbackLabels,
}: {
  items: NavItem[]
  label: string
  labelColor: string
  pathname: string
  onNavClick: () => void
  navT: Record<string, string>
  fallbackLabels?: Record<string, string>
}) {
  return (
    <div>
      <p className={`px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest ${labelColor}`}>
        {label}
      </p>
      <div className="space-y-0.5">
        {items.map(({ href, key, icon: Icon }) => {
          const active = pathname === href
          const itemLabel = navT[key] ?? fallbackLabels?.[key] ?? key
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

  return (
    <aside className="h-full w-60 bg-[#0d0d1a] border-r border-white/[0.05] flex flex-col">
      {/* Logo row */}
      <div className="p-5 border-b border-white/[0.05] flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <img src="/icon.svg" alt="Daromadchi" className="w-9 h-9 rounded-xl shadow-md" />
          <div>
            <span className="font-bold text-white text-base tracking-tight group-hover:text-violet-300 transition-colors">Daromadchi</span>
            <p className="text-[10px] text-slate-500 leading-none mt-0.5">Uzum Market</p>
          </div>
        </Link>
        {onClose && (
          <button onClick={onClose} className="lg:hidden text-slate-500 hover:text-white transition-colors p-1">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
        <NavSection
          items={storeNavItems}
          label={d.nav.store}
          labelColor="text-violet-400/60"
          pathname={pathname}
          onNavClick={handleNavClick}
          navT={d.nav as unknown as Record<string, string>}
        />

        <div className="border-t border-white/[0.04]" />

        <NavSection
          items={[{ href: '/dashboard/market', key: 'marketResearch', icon: Globe2 }]}
          label={d.nav.market}
          labelColor="text-cyan-400/60"
          pathname={pathname}
          onNavClick={handleNavClick}
          navT={d.nav as unknown as Record<string, string>}
        />

        <div className="border-t border-white/[0.04]" />

        <NavSection
          items={settingsNavItems}
          label={d.nav.settings ?? 'Sozlamalar'}
          labelColor="text-slate-400/60"
          pathname={pathname}
          onNavClick={handleNavClick}
          navT={d.nav as unknown as Record<string, string>}
          fallbackLabels={SETTINGS_LABELS}
        />
      </nav>

      {/* Theme + Language + Settings + Logout */}
      <div className="p-3 border-t border-white/[0.05] space-y-1">
        <div className="flex items-center gap-2 px-1 py-1">
          <button
            onClick={toggle}
            title={theme === 'dark' ? "Yorug' rejim" : "Qorong'u rejim"}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-all"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <div className="flex items-center gap-1 flex-1">
            {LANGS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setLang(value)}
                className={`flex-1 text-[10px] font-semibold py-1 rounded-lg transition-all ${
                  lang === value
                    ? 'bg-violet-600/20 text-violet-300 border border-violet-500/20'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

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
          {d.nav.settings ?? 'Sozlamalar'}
          {pathname === '/dashboard/settings' && <ChevronRight className="w-3 h-3 ml-auto text-violet-400" />}
        </Link>

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/[0.08] transition-all"
        >
          <LogOut className="w-4 h-4" />
          {d.nav.logout ?? 'Chiqish'}
        </button>
      </div>
    </aside>
  )
}
