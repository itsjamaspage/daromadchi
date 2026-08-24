/* eslint-disable react-hooks/set-state-in-effect */
'use client'

import { useState, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { Menu, Sun, Moon, ChevronDown, UserCircle, CreditCard, Settings, HelpCircle, LogOut } from 'lucide-react'
import Link from 'next/link'
import { signOut } from 'next-auth/react'
import Sidebar from './Sidebar'
import { useTheme, useLang } from '@/app/providers'
import { translations } from '@/lib/i18n'
import type { Lang } from '@/lib/i18n'

const LANGS: { value: Lang; label: string }[] = [
  { value: 'uz', label: 'UZ' },
  { value: 'ru', label: 'RU' },
  { value: 'en', label: 'EN' },
]

export default function MobileNav({ lockedKeys = [], userEmail = '', userName = '' }: { lockedKeys?: string[]; userEmail?: string; userName?: string }) {
  const [open, setOpen]               = useState(false)  // nav drawer
  const [profileOpen, setProfileOpen] = useState(false)  // profile dropdown
  const pathname              = usePathname()
  const { theme, toggle }     = useTheme()
  const { lang, setLang }     = useLang()
  const d                     = translations[lang].dashboard
  const profileRef            = useRef<HTMLDivElement>(null)

  useEffect(() => { setOpen(false); setProfileOpen(false) }, [pathname])
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])
  // Close the profile dropdown on an outside tap.
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const nav = d.nav as Record<string, string>
  const initial = (userName || userEmail || 'U')[0]?.toUpperCase() ?? 'U'
  const menuItems = [
    { href: '/dashboard/profile',  icon: UserCircle, label: nav.profile  ?? 'Profil'          },
    { href: '/dashboard/billing',  icon: CreditCard, label: nav.billing  ?? "Tarif va to'lov" },
    { href: '/dashboard/settings', icon: Settings,   label: nav.settings ?? 'Sozlamalar'      },
    { href: '/help',               icon: HelpCircle, label: nav.help     ?? 'Yordam markazi'  },
  ]

  async function handleLogout() {
    setProfileOpen(false)
    // Relative navigation — NextAuth v5's redirectTo can build an absolute URL
    // from a stale AUTH_URL, so sign out without a redirect and go client-side.
    await signOut({ redirect: false })
    window.location.assign('/login')
  }

  const darkTop = theme === 'dark'

  return (
    <>
      {/* Top bar — mobile only */}
      <header
        className="lg:hidden fixed top-0 left-0 right-0 z-40 h-14 border-b flex items-center px-4 gap-2"
        style={{
          background: darkTop ? 'var(--bg-card)' : '#e8f0fd',
          borderColor: darkTop ? 'var(--border)' : 'rgba(14,34,51,0.1)',
        }}
      >
        <button
          onClick={() => setOpen(true)}
          className="p-1 transition-colors"
          style={{ color: darkTop ? 'var(--text-muted)' : 'rgba(14,34,51,0.65)' }}
          aria-label="Menyuni ochish"
        >
          <Menu className="w-5 h-5" />
        </button>
        <Link href="/dashboard" className="font-bold text-sm tracking-tight flex-1 min-w-0 truncate transition-colors"
          style={{ color: darkTop ? 'var(--text-base)' : '#0e1b2e' }}>
          Daromadchi
        </Link>

        {/* Language pills */}
        <div className="flex items-center gap-0.5">
          {LANGS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setLang(value)}
              className="text-[10px] font-semibold px-2 py-1 rounded-lg transition-all"
              style={{
                background: lang === value ? 'var(--bg-card2)' : 'transparent',
                color: lang === value ? 'var(--c1)' : 'var(--text-muted)',
                border: lang === value ? '1px solid var(--border2)' : '1px solid transparent',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Theme toggle */}
        <button
          onClick={toggle}
          className="p-1.5 rounded-lg transition-colors"
          style={{ color: darkTop ? 'var(--text-muted)' : 'rgba(14,34,51,0.65)' }}
          aria-label="Theme"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-blue-500" />}
        </button>

        {/* Profile avatar + dropdown */}
        {userEmail && (
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setProfileOpen(o => !o)}
              className="flex items-center gap-1"
              aria-label={nav.profile ?? 'Profil'}
            >
              <span className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                style={{ background: 'var(--c1)', color: 'var(--on-c1)' }}>
                {initial}
              </span>
              <ChevronDown className="w-3 h-3 shrink-0 transition-transform"
                style={{ color: darkTop ? 'var(--text-muted)' : 'rgba(14,34,51,0.55)', transform: profileOpen ? 'rotate(180deg)' : 'none' }} />
            </button>

            {profileOpen && (
              <div
                className="absolute right-0 top-full mt-2 w-60 rounded-2xl border shadow-2xl z-50 overflow-hidden"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
              >
                {/* Account header */}
                <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-base)' }}>{userName || (nav.profile ?? 'Profil')}</p>
                  <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{userEmail}</p>
                </div>
                {/* Links */}
                <div className="py-1.5">
                  {menuItems.map(({ href, icon: Icon, label }) => (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {label}
                    </Link>
                  ))}
                </div>
                {/* Logout */}
                <div className="px-2 py-2 border-t" style={{ borderColor: 'var(--border)' }}>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm font-semibold transition-colors"
                    style={{ color: '#ef4444', background: 'rgba(239,68,68,0.08)' }}
                  >
                    <LogOut className="w-4 h-4 shrink-0" />
                    {nav.logout ?? 'Chiqish'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </header>

      {/* Backdrop */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Slide-in nav drawer */}
      <div className={`lg:hidden fixed top-0 left-0 h-full z-50 transition-transform duration-300 ease-in-out ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <Sidebar onClose={() => setOpen(false)} lockedKeys={lockedKeys} />
      </div>
    </>
  )
}
