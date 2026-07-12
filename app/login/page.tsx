'use client'

import { useState, useRef, useEffect, Suspense } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Mail, Lock, Loader2, Eye, EyeOff, User, CheckCircle, ArrowLeft } from 'lucide-react'
import { useTheme, useLang } from '@/app/providers'

const ui = {
  uz: {
    tagline: 'Savdo tahlil platformasi',
    tabs: { login: 'Kirish', signup: "Ro'yxatdan o'tish" },
    email: 'Email', password: 'Parol', name: 'To\'liq ism',
    namePh: "To'liq ismingiz",
    emailPh: 'email@example.com',
    loginBtn: 'Kirish', signupBtn: 'Hisob yaratish',
    loggingIn: 'Kirish...', signingUp: 'Hisob yaratilmoqda...',
    noAccount: "Hisobingiz yo'qmi?", hasAccount: 'Hisobingiz bormi?',
    signupLink: "Ro'yxatdan o'tish", loginLink: 'Kirish',
    success: "Hisob yaratildi! Endi tizimga kirishingiz mumkin.",
    back: 'Bosh sahifaga',
    forgotPw: 'Parolni unutdingizmi?',
    resetTitle: 'Parolni tiklash',
    resetDesc: 'Emailingizni kiriting — tiklash havolasini yuboramiz.',
    resetBtn: 'Havola yuborish',
    resetSending: 'Yuborilmoqda...',
    resetSuccess: 'Parolni tiklash havolasi emailingizga yuborildi.',
    backToLogin: 'Kirishga qaytish',
    invalidCreds: 'Email yoki parol notoʻgʻri.',
    goSignup: 'Roʻyxatdan oʻtish',
  },
  en: {
    tagline: 'Sales analytics platform',
    tabs: { login: 'Sign in', signup: 'Sign up' },
    email: 'Email', password: 'Password', name: 'Full name',
    namePh: 'Your full name',
    emailPh: 'email@example.com',
    loginBtn: 'Sign in', signupBtn: 'Create account',
    loggingIn: 'Signing in...', signingUp: 'Creating account...',
    noAccount: "Don't have an account?", hasAccount: 'Already have an account?',
    signupLink: 'Sign up', loginLink: 'Sign in',
    success: 'Account created! You can now sign in.',
    back: 'Back to home',
    forgotPw: 'Forgot password?',
    resetTitle: 'Reset password',
    resetDesc: 'Enter your email — we\'ll send you a reset link.',
    resetBtn: 'Send link',
    resetSending: 'Sending...',
    resetSuccess: 'A password reset link has been sent to your email.',
    backToLogin: 'Back to sign in',
    invalidCreds: 'Incorrect email or password.',
    goSignup: 'Sign up',
  },
  ru: {
    tagline: 'Платформа аналитики продаж',
    tabs: { login: 'Войти', signup: 'Регистрация' },
    email: 'Email', password: 'Пароль', name: 'Полное имя',
    namePh: 'Ваше полное имя',
    emailPh: 'email@example.com',
    loginBtn: 'Войти', signupBtn: 'Создать аккаунт',
    loggingIn: 'Вход...', signingUp: 'Создание аккаунта...',
    noAccount: 'Нет аккаунта?', hasAccount: 'Уже есть аккаунт?',
    signupLink: 'Зарегистрироваться', loginLink: 'Войти',
    success: 'Аккаунт создан! Теперь вы можете войти.',
    back: 'На главную',
    forgotPw: 'Забыли пароль?',
    resetTitle: 'Сброс пароля',
    resetDesc: 'Введите email — мы отправим ссылку для сброса.',
    resetBtn: 'Отправить ссылку',
    resetSending: 'Отправка...',
    resetSuccess: 'Ссылка для сброса пароля отправлена на ваш email.',
    backToLogin: 'Вернуться ко входу',
    invalidCreds: 'Неверный email или пароль.',
    goSignup: 'Зарегистрироваться',
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
        style={{ background: inputBg, borderColor: inputBorder, color: '#0369a1' }}>
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
                background: lang === l ? 'rgba(131,192,249,0.2)' : 'transparent',
                color: lang === l ? '#0369a1' : textMuted,
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

  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [name,     setName]     = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [success,  setSuccess]  = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [showSignupHint, setShowSignupHint] = useState(false)
  const router = useRouter()

  const isDark = theme === 'dark'
  const bg     = isDark ? '#161616'  : '#e8f4fe'
  const card   = isDark ? '#1e1e1e'  : '#ffffff'
  const border = isDark ? 'rgba(131,192,249,0.12)' : 'rgba(131,192,249,0.35)'
  const inputBg = isDark ? '#252525' : '#ffffff'
  const inputBorder = isDark ? 'rgba(131,192,249,0.15)' : 'rgba(131,192,249,0.45)'
  const textBase  = isDark ? '#e2e8f0' : '#0e2233'
  const textMuted = isDark ? '#64748b' : '#2c5f82'
  const labelColor = isDark ? '#94a3b8' : '#1a4a6b'

  function switchMode(m: 'login' | 'signup' | 'forgot') {
    setMode(m); setError(''); setSuccess(false); setResetSent(false); setShowSignupHint(false)
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Error')
      } else {
        setResetSent(true)
      }
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')

    try {
      if (mode === 'login') {
        const result = await signIn('credentials', {
          email,
          password,
          redirect: false,
        })

        if (!result?.ok) {
          setError(t.invalidCreds)
          setShowSignupHint(true)
          setLoading(false)
        } else {
          router.push('/dashboard')
          router.refresh()
        }
      } else {
        const signupRes = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, name }),
        })
        const signupData = await signupRes.json()
        if (!signupRes.ok) {
          setError(signupData.error ?? 'Xato yuz berdi')
          setLoading(false)
        } else {
          if (refCode && signupData.userId) {
            await fetch('/api/referral/track', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ refCode, newUserId: signupData.userId }),
            }).catch(() => {})
          }
          setSuccess(true)
          setLoading(false)
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

      <div className="absolute top-1/4 left-1/4 w-80 h-80 rounded-full bg-blue-400/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full bg-blue-300/8 blur-3xl pointer-events-none" />

      <div className="fixed top-0 left-0 right-0 flex items-center justify-between px-5 py-4 z-10">
        <Link href="/" className="flex items-center gap-1.5 text-sm transition-colors"
          style={{ color: textMuted }}>
          <ArrowLeft className="w-4 h-4" /> {t.back}
        </Link>
        <div className="flex items-center gap-2">
          <LangDropdown lang={lang} setLang={setLang} inputBg={inputBg} inputBorder={inputBorder} textMuted={textMuted} card={card} />
          <button onClick={toggle}
            className="w-8 h-8 rounded-xl flex items-center justify-center border transition-all text-sm"
            style={{ background: inputBg, borderColor: inputBorder }}>
            {isDark ? '☀️' : '🌙'}
          </button>
        </div>
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-7">
          <Link href="/">
            <img src="/icon.svg" alt="Daromadchi" className="w-14 h-14 rounded-2xl mb-4 shadow-xl hover:scale-105 transition-transform cursor-pointer" />
          </Link>
          <h1 className="text-3xl font-black tracking-tight" style={{ color: textBase }}>Daromadchi</h1>
          <p className="mt-1 text-sm" style={{ color: textMuted }}>{t.tagline}</p>
        </div>

        <div className="rounded-2xl p-8 shadow-2xl border" style={{ background: card, borderColor: border }}>
          <div className="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-blue-400 to-transparent rounded-full" />

          {mode !== 'forgot' && (
          <div className="flex rounded-xl p-1 mb-6 gap-1" style={{ background: isDark ? '#252525' : '#c8e4f8' }}>
            {(['login','signup'] as const).map(m => (
              <button key={m} onClick={() => switchMode(m)}
                className="flex-1 py-2.5 rounded-lg text-sm font-bold transition-all"
                style={{
                  background: mode === m ? '#83c0f9' : isDark ? 'rgba(255,255,255,0.04)' : 'rgba(131,192,249,0.2)',
                  color: mode === m ? '#0e2233' : isDark ? '#94a3b8' : '#2c5f82',
                  boxShadow: mode === m ? '0 4px 12px rgba(131,192,249,0.4)' : undefined,
                  border: mode === m ? 'none' : `1px solid ${isDark ? 'rgba(131,192,249,0.08)' : 'rgba(131,192,249,0.2)'}`,
                }}>
                {t.tabs[m]}
              </button>
            ))}
          </div>
          )}

          {mode === 'forgot' ? (
            resetSent ? (
              <div className="text-center py-6 space-y-4">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-2">
                  <CheckCircle className="w-7 h-7 text-emerald-400" />
                </div>
                <p className="font-semibold" style={{ color: textBase }}>{t.resetSuccess}</p>
                <button onClick={() => switchMode('login')}
                  className="text-sm underline underline-offset-2 transition-colors" style={{ color: '#0369a1' }}>
                  {t.backToLogin} →
                </button>
              </div>
            ) : (
              <form onSubmit={handleReset} className="space-y-4">
                <div className="mb-2">
                  <h2 className="text-base font-bold mb-1" style={{ color: textBase }}>{t.resetTitle}</h2>
                  <p className="text-xs" style={{ color: textMuted }}>{t.resetDesc}</p>
                </div>
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
                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">
                    {error}
                  </div>
                )}
                <button type="submit" disabled={loading}
                  className="w-full font-bold rounded-xl py-3 text-sm transition-all flex items-center justify-center gap-2 mt-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: '#83c0f9', color: '#0e2233', boxShadow: '0 8px 24px rgba(131,192,249,0.35)' }}>
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" />{t.resetSending}</> : t.resetBtn}
                </button>
                <p className="text-center text-xs pt-1">
                  <button type="button" onClick={() => switchMode('login')}
                    className="font-semibold transition-colors underline underline-offset-2" style={{ color: '#0369a1' }}>
                    {t.backToLogin}
                  </button>
                </p>
              </form>
            )
          ) : success ? (
            <div className="text-center py-6 space-y-4">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-2">
                <CheckCircle className="w-7 h-7 text-emerald-400" />
              </div>
              <p className="font-semibold" style={{ color: textBase }}>{t.success}</p>
              <button onClick={() => switchMode('login')}
                className="text-sm underline underline-offset-2 transition-colors" style={{ color: '#0369a1' }}>
                {t.loginLink} →
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
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

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium" style={{ color: labelColor }}>{t.password}</label>
                  {mode === 'login' && (
                    <button type="button" onClick={() => switchMode('forgot')}
                      className="text-xs cursor-pointer transition-colors" style={{ color: '#0369a1' }}>{t.forgotPw}</button>
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

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">
                  {error}
                  {showSignupHint && (
                    <button type="button" onClick={() => switchMode('signup')}
                      className="block mt-2 text-violet-400 hover:text-violet-300 font-semibold underline underline-offset-2 transition-colors">
                      {t.goSignup} →
                    </button>
                  )}
                </div>
              )}

              <button type="submit" disabled={loading}
                className="w-full font-bold rounded-xl py-3 text-sm transition-all flex items-center justify-center gap-2 mt-1 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: '#83c0f9', color: '#0e2233', border: '2px solid rgba(131,192,249,0.6)', boxShadow: '0 4px 16px rgba(131,192,249,0.25)' }}>
                {loading
                  ? <><Loader2 className="w-4 h-4 animate-spin" />{mode === 'login' ? t.loggingIn : t.signingUp}</>
                  : mode === 'login' ? t.loginBtn : t.signupBtn
                }
              </button>

              <p className="text-center text-xs pt-1" style={{ color: textMuted }}>
                {mode === 'login' ? t.noAccount : t.hasAccount}{' '}
                <button type="button" onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
                  className="font-semibold transition-colors underline underline-offset-2" style={{ color: '#0369a1' }}>
                  {mode === 'login' ? t.signupLink : t.loginLink}
                </button>
              </p>
            </form>
          )}
        </div>

        <div className="flex items-center justify-center gap-2 mt-5 flex-wrap">
          {['Uzum Market', 'Wildberries', 'Yandex Market'].map((mp) => (
            <span key={mp}
              className="px-2.5 py-1 rounded-lg text-[11px] font-medium border"
              style={{
                background: isDark ? 'rgba(131,192,249,0.06)' : 'rgba(131,192,249,0.15)',
                borderColor: isDark ? 'rgba(131,192,249,0.12)' : 'rgba(131,192,249,0.4)',
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
