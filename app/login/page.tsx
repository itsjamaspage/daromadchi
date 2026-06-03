'use client'

import { useState, useRef, useEffect, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Mail, Lock, Loader2, Eye, EyeOff, User, CheckCircle, ArrowLeft } from 'lucide-react'
import { useTheme, useLang } from '@/app/providers'
import { translations } from '@/lib/i18n'

const supabaseConfigured =
  typeof process !== 'undefined' &&
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project')

const ui = {
  uz: {
    tagline: 'Savdo tahlil platformasi',
    tabs: { login: 'Kirish', signup: "Ro'yxatdan o'tish" },
    email: 'Email', password: 'Parol', name: 'To\'liq ism',
    namePh: 'Alisher Umarov',
    emailPh: 'email@example.com',
    loginBtn: 'Kirish', signupBtn: 'Hisob yaratish',
    loggingIn: 'Kirish...', signingUp: 'Hisob yaratilmoqda...',
    noAccount: "Hisobingiz yo'qmi?", hasAccount: 'Hisobingiz bormi?',
    signupLink: "Ro'yxatdan o'tish", loginLink: 'Kirish',
    success: "Hisob yaratildi! Tasdiqlash uchun emailni tekshiring.",
    back: 'Bosh sahifaga',
    demo: 'Demo: demo@daromadchi.uz / demo1234',
    forgotPw: 'Parolni unutdingizmi?',
  },
  en: {
    tagline: 'Sales analytics platform',
    tabs: { login: 'Sign in', signup: 'Sign up' },
    email: 'Email', password: 'Password', name: 'Full name',
    namePh: 'John Smith',
    emailPh: 'email@example.com',
    loginBtn: 'Sign in', signupBtn: 'Create account',
    loggingIn: 'Signing in...', signingUp: 'Creating account...',
    noAccount: "Don't have an account?", hasAccount: 'Already have an account?',
    signupLink: 'Sign up', loginLink: 'Sign in',
    success: 'Account created! Check your email to confirm.',
    back: 'Back to home',
    demo: 'Demo: demo@daromadchi.uz / demo1234',
    forgotPw: 'Forgot password?',
  },
  ru: {
    tagline: 'Платформа аналитики продаж',
    tabs: { login: 'Войти', signup: 'Регистрация' },
    email: 'Email', password: 'Пароль', name: 'Полное имя',
    namePh: 'Иван Иванов',
    emailPh: 'email@example.com',
    loginBtn: 'Войти', signupBtn: 'Создать аккаунт',
    loggingIn: 'Вход...', signingUp: 'Создание аккаунта...',
    noAccount: 'Нет аккаунта?', hasAccount: 'Уже есть аккаунт?',
    signupLink: 'Зарегистрироваться', loginLink: 'Войти',
    success: 'Аккаунт создан! Проверьте email для подтверждения.',
    back: 'На главную',
    demo: 'Демо: demo@daromadchi.uz / demo1234',
    forgotPw: 'Забыли пароль?',
  },
}

function LangDropdown({ lang, setLang, inputBg, inputBorder, textMuted, card }: {
  lang: string; setLang: (l: 'uz'|'en'|'ru') => void
  inputBg: string; inputBorder: string; textMuted: string; card: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])
  const langs = ['uz', 'en', 'ru'] as const
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold uppercase transition-all border"
        style={{ background: inputBg, borderColor: inputBorder, color: '#a78bfa' }}>
        {lang}
        <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 12 12" fill="none">
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 rounded-xl overflow-hidden border shadow-xl z-50"
          style={{ background: card, borderColor: inputBorder, minWidth: '4rem' }}>
          {langs.map(l => (
            <button key={l} onClick={() => { setLang(l); setOpen(false) }}
              className="w-full px-3 py-2 text-xs font-bold uppercase text-left transition-all"
              style={{
                background: lang === l ? 'rgba(139,92,246,0.15)' : 'transparent',
                color: lang === l ? '#a78bfa' : textMuted,
              }}>
              {l}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function LoginForm() {
  const { theme, toggle } = useTheme()
  const { lang, setLang } = useLang()
  const t = ui[lang in ui ? lang as keyof typeof ui : 'uz']

  const searchParams = useSearchParams()
  const refCode = searchParams.get('ref') ?? ''

  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [name,     setName]     = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [success,  setSuccess]  = useState(false)
  const router = useRouter()

  const isDark = theme === 'dark'
  const bg     = isDark ? '#07070f'  : '#f3f3fa'
  const card   = isDark ? '#0e0e1a'  : '#ffffff'
  const border = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(139,92,246,0.15)'
  const inputBg = isDark ? '#1c1c2e' : '#eeeefc'
  const inputBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(139,92,246,0.2)'
  const textBase  = isDark ? '#e2e8f0' : '#1a1a2e'
  const textMuted = isDark ? '#64748b' : '#6b7280'
  const labelColor = isDark ? '#94a3b8' : '#4b5563'

  function switchMode(m: 'login' | 'signup') {
    setMode(m); setError(''); setSuccess(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')

    if (!supabaseConfigured) {
      router.push('/dashboard'); router.refresh(); return
    }

    try {
      const supabase = createClient()

      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) { setError(error.message); setLoading(false) }
        else { router.push('/dashboard'); router.refresh() }
      } else {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: name } },
        })
        if (error) { setError(error.message); setLoading(false) }
        else {
          if (refCode && data.user) {
            await fetch('/api/referral/track', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ refCode, newUserId: data.user.id }),
            }).catch(() => {})
          }
          if (data.session) { router.push('/dashboard'); router.refresh() }
          else { setSuccess(true); setLoading(false) }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
      setLoading(false)
    }
  }

  const inputCls = `w-full rounded-xl pl-10 pr-4 py-3 text-sm outline-none transition-all`

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: bg }}>

      {/* background orbs */}
      <div className="absolute top-1/4 left-1/4 w-80 h-80 rounded-full bg-violet-600/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full bg-indigo-600/8 blur-3xl pointer-events-none" />

      {/* top bar */}
      <div className="fixed top-0 left-0 right-0 flex items-center justify-between px-5 py-4 z-10">
        <Link href="/" className="flex items-center gap-1.5 text-sm transition-colors"
          style={{ color: textMuted }}>
          <ArrowLeft className="w-4 h-4" /> {t.back}
        </Link>
        <div className="flex items-center gap-2">
          {/* lang dropdown */}
          <LangDropdown lang={lang} setLang={setLang} inputBg={inputBg} inputBorder={inputBorder} textMuted={textMuted} card={card} />
          {/* theme */}
          <button onClick={toggle}
            className="w-8 h-8 rounded-xl flex items-center justify-center border transition-all text-sm"
            style={{ background: inputBg, borderColor: inputBorder }}>
            {isDark ? '☀️' : '🌙'}
          </button>
        </div>
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-7">
          <Link href="/">
            <img src="/icon.svg" alt="Daromadchi" className="w-14 h-14 rounded-2xl mb-4 shadow-xl hover:scale-105 transition-transform cursor-pointer" />
          </Link>
          <h1 className="text-3xl font-black tracking-tight" style={{ color: textBase }}>Daromadchi</h1>
          <p className="mt-1 text-sm" style={{ color: textMuted }}>{t.tagline}</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-8 shadow-2xl border" style={{ background: card, borderColor: border }}>
          {/* top neon line */}
          <div className="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-violet-500 to-transparent rounded-full" />

          {/* Tabs */}
          <div className="flex rounded-xl p-1 mb-6 gap-1" style={{ background: isDark ? '#13131f' : '#e8e8f8' }}>
            {(['login','signup'] as const).map(m => (
              <button key={m} onClick={() => switchMode(m)}
                className="flex-1 py-2.5 rounded-lg text-sm font-bold transition-all"
                style={{
                  background: mode === m ? 'linear-gradient(135deg,#7c3aed,#4f46e5)' : isDark ? 'rgba(255,255,255,0.04)' : 'rgba(139,92,246,0.08)',
                  color: mode === m ? '#ffffff' : isDark ? '#94a3b8' : '#6b7280',
                  boxShadow: mode === m ? '0 4px 12px rgba(124,58,237,0.35)' : undefined,
                  border: mode === m ? 'none' : `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(139,92,246,0.12)'}`,
                }}>
                {t.tabs[m]}
              </button>
            ))}
          </div>

          {/* Success state */}
          {success ? (
            <div className="text-center py-6 space-y-4">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-2">
                <CheckCircle className="w-7 h-7 text-emerald-400" />
              </div>
              <p className="font-semibold" style={{ color: textBase }}>{t.success}</p>
              <button onClick={() => switchMode('login')}
                className="text-sm text-violet-400 hover:text-violet-300 underline underline-offset-2 transition-colors">
                {t.loginLink} →
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name field (signup only) */}
              {mode === 'signup' && (
                <div>
                  <label className="block text-xs font-medium mb-2" style={{ color: labelColor }}>{t.name}</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: textMuted }} />
                    <input type="text" value={name} onChange={e => setName(e.target.value)} required
                      placeholder={t.namePh}
                      className={inputCls}
                      style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: textBase }}
                    />
                  </div>
                </div>
              )}

              {/* Email */}
              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: labelColor }}>{t.email}</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: textMuted }} />
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                    placeholder={t.emailPh}
                    className={inputCls}
                    style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: textBase }}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium" style={{ color: labelColor }}>{t.password}</label>
                  {mode === 'login' && (
                    <span className="text-xs text-violet-400 hover:text-violet-300 cursor-pointer transition-colors">{t.forgotPw}</span>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: textMuted }} />
                  <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required
                    minLength={6} placeholder="••••••••"
                    className={`${inputCls} pr-10`}
                    style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: textBase }}
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                    style={{ color: textMuted }}>
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {mode === 'signup' && (
                  <p className="text-xs mt-1.5" style={{ color: textMuted }}>Minimum 6 characters</p>
                )}
              </div>

              {/* Error */}
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">
                  {error}
                </div>
              )}

              {/* Submit */}
              <button type="submit" disabled={loading}
                className="w-full text-white font-bold rounded-xl py-3 text-sm transition-all flex items-center justify-center gap-2 mt-1 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', boxShadow: '0 8px 24px rgba(124,58,237,0.3)' }}>
                {loading
                  ? <><Loader2 className="w-4 h-4 animate-spin" />{mode === 'login' ? t.loggingIn : t.signingUp}</>
                  : mode === 'login' ? t.loginBtn : t.signupBtn
                }
              </button>

              {/* Switch mode link */}
              <p className="text-center text-xs pt-1" style={{ color: textMuted }}>
                {mode === 'login' ? t.noAccount : t.hasAccount}{' '}
                <button type="button" onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
                  className="text-violet-400 hover:text-violet-300 font-semibold transition-colors underline underline-offset-2">
                  {mode === 'login' ? t.signupLink : t.loginLink}
                </button>
              </p>
            </form>
          )}
        </div>

        {/* Supported marketplaces */}
        <div className="flex items-center justify-center gap-2 mt-5 flex-wrap">
          {['Uzum Market', 'Wildberries', 'Yandex Market'].map((mp) => (
            <span key={mp}
              className="px-2.5 py-1 rounded-lg text-[11px] font-medium border"
              style={{
                background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(139,92,246,0.06)',
                borderColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(139,92,246,0.14)',
                color: textMuted,
              }}>
              {mp}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
