'use client'

import { useState, useRef, useEffect, useCallback, Suspense } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Mail, Lock, Loader2, Eye, EyeOff, User, CheckCircle, ArrowLeft, ShieldCheck } from 'lucide-react'
import { useTheme, useLang } from '@/app/providers'
import { isPlanKey } from '@/lib/billing/plans'

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
    verifyTitle: 'Emailni tasdiqlash',
    verifyDesc: 'Tasdiqlash kodi emailingizga yuborildi:',
    verifyBtn: 'Tasdiqlash',
    verifying: 'Tekshirilmoqda...',
    resendCode: 'Kodni qayta yuborish',
    resending: 'Yuborilmoqda...',
    codeSent: 'Yangi kod yuborildi!',
    verifySuccess: 'Email tasdiqlandi! Endi tizimga kirishingiz mumkin.',
    emailNotVerified: 'Emailingiz tasdiqlanmagan. Tasdiqlash kodini tekshiring.',
    orDivider: 'yoki',
    googleBtn: 'Google bilan davom etish',
    consent: {
      pre: 'Men ',
      privacy: 'Maxfiylik siyosati',
      sep1: ', ',
      terms: 'Foydalanish shartlari',
      sep2: ' va ',
      cookies: 'Cookie siyosati',
      post: ' bilan tanishdim va roziligimni bildiraman.',
      errorNeeded: 'Davom etish uchun shartlarga rozilik bildiring.',
    },
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
    verifyTitle: 'Verify your email',
    verifyDesc: 'A verification code was sent to:',
    verifyBtn: 'Verify',
    verifying: 'Verifying...',
    resendCode: 'Resend code',
    resending: 'Sending...',
    codeSent: 'New code sent!',
    verifySuccess: 'Email verified! You can now sign in.',
    emailNotVerified: 'Your email is not verified. Please check your verification code.',
    orDivider: 'or',
    googleBtn: 'Continue with Google',
    consent: {
      pre: 'I have read and agree to the ',
      privacy: 'Privacy Policy',
      sep1: ', ',
      terms: 'Terms of Use',
      sep2: ' and ',
      cookies: 'Cookie Policy',
      post: '.',
      errorNeeded: 'Please agree to the terms to continue.',
    },
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
    verifyTitle: 'Подтвердите email',
    verifyDesc: 'Код подтверждения отправлен на:',
    verifyBtn: 'Подтвердить',
    verifying: 'Проверка...',
    resendCode: 'Отправить код снова',
    resending: 'Отправка...',
    codeSent: 'Новый код отправлен!',
    verifySuccess: 'Email подтверждён! Теперь вы можете войти.',
    emailNotVerified: 'Ваш email не подтверждён. Проверьте код подтверждения.',
    orDivider: 'или',
    googleBtn: 'Продолжить через Google',
    consent: {
      pre: 'Я ознакомился(лась) и соглашаюсь с ',
      privacy: 'Политикой конфиденциальности',
      sep1: ', ',
      terms: 'Условиями использования',
      sep2: ' и ',
      cookies: 'Политикой использования cookie',
      post: '.',
      errorNeeded: 'Пожалуйста, примите условия, чтобы продолжить.',
    },
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

function CodeInputBoxes({ value, onChange, inputBg, inputBorder, textBase }: {
  value: string; onChange: (v: string) => void
  inputBg: string; inputBorder: string; textBase: string
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([])

  const handleInput = useCallback((idx: number, char: string) => {
    if (!/^\d?$/.test(char)) return
    const arr = value.split('')
    while (arr.length < 6) arr.push('')
    arr[idx] = char
    const next = arr.join('').slice(0, 6)
    onChange(next)
    if (char && idx < 5) refs.current[idx + 1]?.focus()
  }, [value, onChange])

  const handleKeyDown = useCallback((idx: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !value[idx] && idx > 0) {
      refs.current[idx - 1]?.focus()
    }
  }, [value])

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    onChange(pasted)
    refs.current[Math.min(pasted.length, 5)]?.focus()
  }, [onChange])

  return (
    <div className="flex gap-2 justify-center" onPaste={handlePaste}>
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={el => { refs.current[i] = el }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[i] ?? ''}
          onChange={e => handleInput(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
          className="w-11 h-13 rounded-xl text-center text-xl font-bold outline-none transition-all border-2"
          style={{
            background: inputBg,
            borderColor: value[i] ? '#0369a1' : inputBorder,
            color: textBase,
          }}
        />
      ))}
    </div>
  )
}

function LoginForm() {
  const { theme, toggle } = useTheme()
  const { lang, setLang } = useLang()
  const t = ui[lang in ui ? lang as keyof typeof ui : 'uz']

  const searchParams = useSearchParams()
  const refCode = searchParams.get('ref') ?? ''
  // A new Google user bounced back by the server-side consent gate arrives with
  // ?consent=required — open the signup tab and seed the notice. Derived at
  // first render (no effect / synchronous setState).
  const consentRequired = searchParams.get('consent') === 'required'
  // A plan chosen on /pricing (?plan=…) carries through login so the user lands
  // on Billing with that plan's checkout ready — not the generic dashboard.
  // Validated against the price table rather than a hand-written pair: naming
  // two keys here silently dropped the Biznes link /pricing was handing out.
  const planParam = searchParams.get('plan')
  const postLoginDest = isPlanKey(planParam)
    ? `/dashboard/billing?plan=${planParam}`
    : '/dashboard'

  const [mode, setMode] = useState<'login' | 'signup' | 'forgot' | 'verify'>(consentRequired ? 'signup' : 'login')
  const [consent, setConsent] = useState(false)
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [name,     setName]     = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(consentRequired ? t.consent.errorNeeded : '')
  const [success,  setSuccess]  = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [showSignupHint, setShowSignupHint] = useState(false)
  const [verifyCode, setVerifyCode] = useState('')
  const [resending, setResending] = useState(false)
  const [resendMsg, setResendMsg] = useState('')
  const [googleEnabled, setGoogleEnabled] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Already signed in? Don't show a login form — honor the intent that brought
    // them here. A ?plan=… (from a /pricing or landing tariff click) sends them
    // straight to Billing with that plan; otherwise to the dashboard. Uses the
    // NextAuth session endpoint (no SessionProvider needed).
    let alive = true
    fetch('/api/auth/session', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(s => { if (alive && s?.user) router.replace(postLoginDest) })
      .catch(() => {})
    return () => { alive = false }
  // postLoginDest is derived from stable searchParams; run once on mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // NextAuth publishes registered providers here — if 'google' is present
    // the OAuth env vars are set on the server. Hide the button otherwise so
    // clicks can't hit a provider that isn't configured.
    fetch('/api/auth/providers')
      .then(r => r.ok ? r.json() : null)
      .then((data: Record<string, unknown> | null) => {
        if (data && 'google' in data) setGoogleEnabled(true)
      })
      .catch(() => {})
  }, [])

  const isDark = theme === 'dark'
  const bg     = isDark ? '#161616'  : '#e8f4fe'
  const card   = isDark ? '#1e1e1e'  : '#ffffff'
  const border = isDark ? 'rgba(131,192,249,0.12)' : 'rgba(131,192,249,0.35)'
  const inputBg = isDark ? '#252525' : '#ffffff'
  const inputBorder = isDark ? 'rgba(131,192,249,0.15)' : 'rgba(131,192,249,0.45)'
  const textBase  = isDark ? '#e2e8f0' : '#0e2233'
  const textMuted = isDark ? '#64748b' : '#2c5f82'
  const labelColor = isDark ? '#94a3b8' : '#1a4a6b'

  function switchMode(m: 'login' | 'signup' | 'forgot' | 'verify') {
    setMode(m); setError(''); setSuccess(false); setResetSent(false); setShowSignupHint(false); setVerifyCode(''); setResendMsg('')
    setConsent(false)
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

  async function handleResendCode() {
    setResending(true); setResendMsg(''); setError('')
    try {
      const res = await fetch('/api/auth/resend-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (res.ok) {
        setResendMsg(t.codeSent)
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Error')
      }
    } catch {
      setError('Network error')
    } finally {
      setResending(false)
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    if (verifyCode.length !== 6) return
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: verifyCode }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Error')
        setLoading(false)
      } else {
        setSuccess(true)
        setLoading(false)
      }
    } catch {
      setError('Network error')
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
          if (result?.error?.includes('EMAIL_NOT_VERIFIED')) {
            switchMode('verify')
            handleResendCode()
          } else {
            setError(t.invalidCreds)
            setShowSignupHint(true)
          }
          setLoading(false)
        } else {
          router.push(postLoginDest)
          router.refresh()
        }
      } else {
        const signupRes = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, name, consent }),
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
          if (signupData.needsVerification) {
            switchMode('verify')
          } else {
            setSuccess(true)
          }
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

          {mode === 'verify' ? (
            success ? (
              <div className="text-center py-6 space-y-4">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-2">
                  <CheckCircle className="w-7 h-7 text-emerald-400" />
                </div>
                <p className="font-semibold" style={{ color: textBase }}>{t.verifySuccess}</p>
                <button onClick={() => switchMode('login')}
                  className="text-sm underline underline-offset-2 transition-colors" style={{ color: '#0369a1' }}>
                  {t.loginLink} →
                </button>
              </div>
            ) : (
              <form onSubmit={handleVerify} className="space-y-5">
                <div className="text-center mb-2">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/20 mb-3">
                    <ShieldCheck className="w-6 h-6 text-blue-400" />
                  </div>
                  <h2 className="text-base font-bold mb-1" style={{ color: textBase }}>{t.verifyTitle}</h2>
                  <p className="text-xs" style={{ color: textMuted }}>{t.verifyDesc}</p>
                  <p className="text-sm font-semibold mt-1" style={{ color: textBase }}>{email}</p>
                </div>

                <CodeInputBoxes
                  value={verifyCode}
                  onChange={setVerifyCode}
                  inputBg={inputBg}
                  inputBorder={inputBorder}
                  textBase={textBase}
                />

                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">
                    {error}
                  </div>
                )}

                {resendMsg && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 text-sm text-emerald-400 text-center">
                    {resendMsg}
                  </div>
                )}

                <button type="submit" disabled={loading || verifyCode.length !== 6}
                  className="w-full font-bold rounded-xl py-3 text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: '#ffffff', color: '#0e2233', border: '2px solid rgba(255,255,255,0.6)', boxShadow: '0 4px 16px rgba(255,255,255,0.15)' }}>
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" />{t.verifying}</> : t.verifyBtn}
                </button>

                <div className="flex items-center justify-between text-xs pt-1">
                  <button type="button" onClick={handleResendCode} disabled={resending}
                    className="font-semibold transition-colors underline underline-offset-2" style={{ color: '#0369a1' }}>
                    {resending ? t.resending : t.resendCode}
                  </button>
                  <button type="button" onClick={() => switchMode('login')}
                    className="font-semibold transition-colors underline underline-offset-2" style={{ color: '#0369a1' }}>
                    {t.backToLogin}
                  </button>
                </div>
              </form>
            )
          ) : mode === 'forgot' ? (
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
                  style={{ background: '#ffffff', color: '#0e2233', boxShadow: '0 8px 24px rgba(255,255,255,0.2)' }}>
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
            <>
              <div className="flex rounded-xl p-1 mb-6 gap-1" style={{ background: isDark ? '#252525' : '#c8e4f8' }}>
                {(['login','signup'] as const).map(m => (
                  <button key={m} onClick={() => switchMode(m)}
                    className="flex-1 py-2.5 rounded-lg text-sm font-bold transition-all"
                    style={{
                      background: mode === m ? '#ffffff' : isDark ? 'rgba(255,255,255,0.04)' : 'rgba(131,192,249,0.2)',
                      color: mode === m ? '#0e2233' : isDark ? '#94a3b8' : '#2c5f82',
                      boxShadow: mode === m ? '0 4px 12px rgba(255,255,255,0.25)' : undefined,
                      border: mode === m ? 'none' : `1px solid ${isDark ? 'rgba(131,192,249,0.08)' : 'rgba(131,192,249,0.2)'}`,
                    }}>
                    {t.tabs[m]}
                  </button>
                ))}
              </div>

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

                {mode === 'signup' && (
                  <label className="flex items-start gap-2.5 cursor-pointer select-none pt-1">
                    <input
                      type="checkbox"
                      checked={consent}
                      onChange={e => { setConsent(e.target.checked); if (e.target.checked) setError('') }}
                      className="mt-0.5 w-4 h-4 flex-shrink-0 cursor-pointer"
                      style={{ accentColor: '#0369a1' }}
                    />
                    <span className="text-xs leading-relaxed" style={{ color: textMuted }}>
                      {t.consent.pre}
                      <a href="/privacy" target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-2" style={{ color: '#0369a1' }}>{t.consent.privacy}</a>
                      {t.consent.sep1}
                      <a href="/terms" target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-2" style={{ color: '#0369a1' }}>{t.consent.terms}</a>
                      {t.consent.sep2}
                      <a href="/cookies" target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-2" style={{ color: '#0369a1' }}>{t.consent.cookies}</a>
                      {t.consent.post}
                    </span>
                  </label>
                )}

                <button type="submit" disabled={loading || (mode === 'signup' && !consent)}
                  className="w-full font-bold rounded-xl py-3 text-sm transition-all flex items-center justify-center gap-2 mt-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: '#ffffff', color: '#0e2233', border: '2px solid rgba(255,255,255,0.6)', boxShadow: '0 4px 16px rgba(255,255,255,0.15)' }}>
                  {loading
                    ? <><Loader2 className="w-4 h-4 animate-spin" />{mode === 'login' ? t.loggingIn : t.signingUp}</>
                    : mode === 'login' ? t.loginBtn : t.signupBtn
                  }
                </button>

                {googleEnabled && (
                  <>
                    <div className="flex items-center gap-3 my-2">
                      <div className="flex-1 h-px" style={{ background: inputBorder }} />
                      <span className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: textMuted }}>
                        {t.orDivider}
                      </span>
                      <div className="flex-1 h-px" style={{ background: inputBorder }} />
                    </div>

                    <button type="button" disabled={loading || (mode === 'signup' && !consent)}
                      onClick={() => {
                        // In signup mode the consent box gates this button, and
                        // we drop a short-lived first-party cookie the server
                        // reads when creating the new Google user (see the
                        // signIn callback in lib/auth/config.ts). Existing users
                        // signing in are unaffected — the server only requires
                        // it when a NEW account would be created.
                        if (mode === 'signup') {
                          const secure = typeof location !== 'undefined' && location.protocol === 'https:' ? '; secure' : ''
                          document.cookie = `signup_consent=1; path=/; max-age=600; samesite=lax${secure}`
                        }
                        signIn('google', { callbackUrl: postLoginDest })
                      }}
                      className="w-full font-semibold rounded-xl py-3 text-sm transition-all flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
                      style={{
                        background: isDark ? '#252525' : '#ffffff',
                        color: textBase,
                        border: `1.5px solid ${inputBorder}`,
                      }}>
                      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                      </svg>
                      {t.googleBtn}
                    </button>
                  </>
                )}

                <p className="text-center text-xs pt-1" style={{ color: textMuted }}>
                  {mode === 'login' ? t.noAccount : t.hasAccount}{' '}
                  <button type="button" onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
                    className="font-semibold transition-colors underline underline-offset-2" style={{ color: '#0369a1' }}>
                    {mode === 'login' ? t.signupLink : t.loginLink}
                  </button>
                </p>
              </form>
            </>
          )}
        </div>

        <div className="flex items-center justify-center gap-2 mt-5 flex-wrap">
          {['Uzum Market', 'Yandex Market'].map((mp) => (
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
