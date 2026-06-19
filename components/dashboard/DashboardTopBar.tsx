'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  BellRing, CreditCard, UserCircle, HelpCircle,
  Settings, LogOut, ChevronDown, Sun, Moon,
} from 'lucide-react'
import { useTheme, useLang } from '@/app/providers'
import { translations } from '@/lib/i18n'
import type { Lang } from '@/lib/i18n'
import Glossary from '@/components/dashboard/Glossary'

const LANGS: { value: Lang; label: string }[] = [
  { value: 'uz', label: 'UZ' },
  { value: 'ru', label: 'RU' },
  { value: 'en', label: 'EN' },
]

interface UserInfo { name: string; email: string; avatar?: string }

export default function DashboardTopBar() {
  const [open, setOpen]   = useState(false)
  const [user, setUser]   = useState<UserInfo | null>(null)
  const dropRef           = useRef<HTMLDivElement>(null)
  const router            = useRouter()
  const supabase          = createClient()
  const { theme, toggle } = useTheme()
  const { lang, setLang } = useLang()
  const d                 = translations[lang].dashboard

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return
      setUser({
        name:   data.user.user_metadata?.full_name
                || data.user.user_metadata?.name
                || data.user.email?.split('@')[0]
                || 'User',
        email:  data.user.email ?? '',
        avatar: data.user.user_metadata?.avatar_url,
      })
    })
  }, [])

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  async function handleLogout() {
    setOpen(false)
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const initial = user?.name?.[0]?.toUpperCase() ?? 'U'

  const menuItems = [
    { href: '/dashboard/notifications', icon: BellRing,   label: (d.nav as Record<string,string>).notifications  ?? 'Bildirishnomalar' },
    { href: '/dashboard/billing',       icon: CreditCard,  label: (d.nav as Record<string,string>).billing        ?? "Tarif va to'lov"   },
    { href: '/dashboard/profile',       icon: UserCircle,  label: (d.nav as Record<string,string>).profile        ?? 'Profil'           },
    { href: '/help',                    icon: HelpCircle,  label: (d.nav as Record<string,string>).help           ?? 'Yordam markazi'   },
    { href: '/dashboard/settings',      icon: Settings,    label: (d.nav as Record<string,string>).settings       ?? 'Sozlamalar'       },
  ]

  return (
    <header
      className="hidden lg:flex fixed top-0 left-14 right-0 h-14 z-30 items-center justify-end px-6 border-b gap-3"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
    >
      {/* Theme toggle — always visible in header */}
      <button
        onClick={toggle}
        className="w-9 h-9 flex items-center justify-center rounded-xl border transition-all"
        style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}
        title={theme === 'dark' ? d.lightMode : d.darkMode}
      >
        {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>

      <div className="relative" ref={dropRef}>
        {/* Profile pill */}
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl border transition-all"
          style={{
            borderColor: open ? 'var(--border2)' : 'var(--border)',
            background:  'var(--bg-input)',
          }}
        >
          {/* Avatar */}
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden"
            style={{ background: 'var(--c1)', color: '#fff' }}
          >
            {user?.avatar
              ? <img src={user.avatar} alt="" className="w-full h-full object-cover" />
              : initial}
          </div>

          <div className="text-left">
            <p className="text-sm font-semibold leading-tight" style={{ color: 'var(--text-base)' }}>
              {user?.name ?? '…'}
            </p>
            <p className="text-[11px] leading-tight" style={{ color: 'var(--text-muted)' }}>
              {user?.email}
            </p>
          </div>

          <ChevronDown
            className="w-3.5 h-3.5 shrink-0 transition-transform"
            style={{ color: 'var(--text-muted)', transform: open ? 'rotate(180deg)' : 'none' }}
          />
        </button>

        {/* Dropdown */}
        {open && (
          <div
            className="absolute right-0 top-full mt-2 w-64 rounded-2xl border shadow-2xl z-50 overflow-hidden"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
          >
            {/* User header */}
            <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-base)' }}>{user?.name}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{user?.email}</p>
            </div>

            {/* Nav links */}
            <div className="py-1.5">
              {menuItems.map(({ href, icon: Icon, label }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-2 text-sm transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-base)'; (e.currentTarget as HTMLElement).style.background = 'var(--bg-input)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {label}
                </Link>
              ))}
            </div>

            {/* Theme + Lang + Glossary + Logout */}
            <div className="px-4 py-3 border-t space-y-2" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2">
                <button
                  onClick={toggle}
                  className="w-8 h-8 flex items-center justify-center rounded-lg shrink-0"
                  style={{ background: 'var(--bg-input)', color: 'var(--text-muted)' }}
                  title={theme === 'dark' ? d.lightMode : d.darkMode}
                >
                  {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                </button>
                <div className="flex gap-1 flex-1">
                  {LANGS.map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => setLang(value)}
                      className="flex-1 text-[10px] font-semibold py-1.5 rounded-lg transition-all"
                      style={lang === value ? {
                        background: 'rgba(73,79,223,0.1)',
                        color: 'var(--c1)',
                        border: '1px solid rgba(73,79,223,0.2)',
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

              <div><Glossary /></div>

              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-2 py-2 rounded-xl text-sm font-medium transition-all"
                style={{ color: '#f87171' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.06)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                <LogOut className="w-4 h-4 shrink-0" />
                {(d.nav as Record<string,string>).logout ?? 'Chiqish'}
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
