'use client'

import { useState, useRef, useEffect, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { signOut } from 'next-auth/react'
import {
  BellRing, CreditCard, UserCircle, HelpCircle,
  Settings, LogOut, ChevronDown, Sun, Moon,
} from 'lucide-react'
import { useTheme, useLang } from '@/app/providers'
import { translations } from '@/lib/i18n'
import type { Lang } from '@/lib/i18n'
import Glossary from '@/components/dashboard/Glossary'
import { subscribeNotifSeen, getSeenCount, getServerSeenCount } from '@/lib/notif-seen'

const LANGS: { value: Lang; label: string }[] = [
  { value: 'uz', label: 'UZ' },
  { value: 'ru', label: 'RU' },
  { value: 'en', label: 'EN' },
]

interface Props { userName: string; userEmail: string; notificationCount?: number }

export default function DashboardTopBar({ userName, userEmail, notificationCount = 0 }: Props) {
  const [open, setOpen]   = useState(false)
  const dropRef           = useRef<HTMLDivElement>(null)
  const router            = useRouter()
  const { theme, toggle } = useTheme()
  const { lang, setLang } = useLang()
  const d                 = translations[lang].dashboard

  // Alerts the user has already seen (from opening the notifications page) are
  // subtracted from the badge, so visiting that page clears it to 0.
  const seenCount = useSyncExternalStore(subscribeNotifSeen, getSeenCount, getServerSeenCount)
  const unseen    = Math.max(0, notificationCount - seenCount)

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  async function handleLogout() {
    setOpen(false)
    // NextAuth v5's redirectTo builds an absolute URL from AUTH_URL/NEXTAUTH_URL
    // on the server — if that env is stale (e.g. localhost:3000) the browser
    // gets sent there. Navigate client-side with a relative URL instead so
    // the user always lands on the current origin's /login.
    await signOut({ redirect: false })
    window.location.assign('/login')
  }

  const initial = userName[0]?.toUpperCase() ?? 'U'

  const notifLabel = (d.nav as Record<string,string>).notifications ?? 'Bildirishnomalar'

  const menuItems = [
    { href: '/dashboard/billing',       icon: CreditCard,  label: (d.nav as Record<string,string>).billing        ?? "Tarif va to'lov"   },
    { href: '/dashboard/profile',       icon: UserCircle,  label: (d.nav as Record<string,string>).profile        ?? 'Profil'           },
    { href: '/help',                    icon: HelpCircle,  label: (d.nav as Record<string,string>).help           ?? 'Yordam markazi'   },
    { href: '/dashboard/settings',      icon: Settings,    label: (d.nav as Record<string,string>).settings       ?? 'Sozlamalar'       },
  ]

  const isDark = theme === 'dark'
  const topBg     = isDark ? 'var(--bg-card)'        : '#e8f0fd'
  const topBdr    = isDark ? 'var(--border)'          : 'rgba(14,34,51,0.1)'
  const topTxt    = isDark ? 'var(--text-base)'       : '#0e1b2e'
  const topMut    = isDark ? 'var(--text-muted)'      : 'rgba(14,34,51,0.65)'
  const topBtn    = isDark ? 'var(--bg-input)'        : 'rgba(14,34,51,0.06)'
  const topBtnBdr = isDark ? 'var(--border)'          : 'rgba(14,34,51,0.15)'

  return (
    <header
      className="hidden lg:flex fixed top-0 left-14 right-0 h-14 z-30 items-center justify-end px-6 border-b gap-3"
      style={{ background: topBg, borderColor: topBdr }}
    >
      {/* Notifications — moved out of the profile dropdown, sits next to the
          theme toggle. Badge shows the total number of in-app alerts. */}
      <Link
        href="/dashboard/notifications"
        className="relative w-9 h-9 flex items-center justify-center rounded-xl border transition-all"
        style={{ background: topBtn, borderColor: topBtnBdr, color: topMut }}
        title={notifLabel}
        aria-label={notifLabel}
      >
        <BellRing className="w-4 h-4" />
        {unseen > 0 && (
          <span
            className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full text-[10px] font-bold leading-none"
            style={{ background: '#ef4444', color: '#fff' }}
          >
            {unseen > 99 ? '99+' : unseen}
          </span>
        )}
      </Link>

      {/* Theme toggle — always visible in header */}
      <button
        onClick={toggle}
        className="w-9 h-9 flex items-center justify-center rounded-xl border transition-all"
        style={{ background: topBtn, borderColor: topBtnBdr, color: topMut }}
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
            borderColor: topBtnBdr,
            background:  topBtn,
          }}
        >
          {/* Avatar */}
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden"
            style={{ background: 'var(--c1)', color: 'var(--on-c1)' }}
          >
            {initial}
          </div>

          <div className="text-left">
            <p className="text-sm font-semibold leading-tight" style={{ color: topTxt }}>
              {userName}
            </p>
            <p className="text-[11px] leading-tight" style={{ color: topMut }}>
              {userEmail}
            </p>
          </div>

          <ChevronDown
            className="w-3.5 h-3.5 shrink-0 transition-transform"
            style={{ color: topMut, transform: open ? 'rotate(180deg)' : 'none' }}
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
              <p className="text-sm font-semibold" style={{ color: 'var(--text-base)' }}>{userName}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{userEmail}</p>
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
                        background: 'var(--bg-card2)',
                        color: 'var(--c1)',
                        border: '1px solid var(--border)',
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
