'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  CreditCard, CheckCircle, X, Star, Zap, Package, Receipt, FileText, Lock, Loader2, ArrowLeft,
} from 'lucide-react'
import { useLang } from '@/app/providers'
import { translations } from '@/lib/i18n'
import type { BillingInfo, PlanType, PaymentRecord } from '@/lib/db/billing'
import { PLAN_PRICES_TIYIN, formatSomFromTiyin } from '@/lib/billing/plans'

type T = typeof translations['uz']['dashboard']
type Lang = 'uz' | 'en' | 'ru'

// New card/OTP/renewal strings kept local (colocated with the flow that uses them)
// rather than threaded through the large shared i18n file.
const BT: Record<Lang, Record<string, string>> = {
  uz: {
    cardStep: "Karta ma'lumotlari", cardNumber: 'Karta raqami', expiry: 'Muddati (OO/YY)',
    pay: "Obuna bo'lish", processing: 'Bajarilmoqda…',
    secureNote: "Karta raqami saqlanmaydi — faqat xavfsiz to'lov uchun.",
    otpStep: 'SMS kodni kiriting', otpDesc: "Kartaga bog'langan telefonga kod yuborildi",
    confirm: 'Tasdiqlash', resend: 'Kodni qayta yuborish', resendIn: 'Qayta yuborish',
    successStep: "To'lov muvaffaqiyatli!", successDesc: 'Tarifingiz faollashtirildi.', done: 'Yopish',
    yourCard: 'Sizning kartangiz', autorenew: 'Avtomatik yangilash',
    autorenewDesc: 'Muddat tugashidan oldin kartadan avtomatik yechiladi', back: 'Orqaga',
    errCard: "Karta raqami noto'g'ri", errExpiry: "Muddat noto'g'ri",
    errOtp: "Kod noto'g'ri yoki eskirgan. Qaytadan kiriting.",
    errCharge: "To'lov amalga oshmadi. Qaytadan urinib ko'ring.",
    errUnavailable: "To'lov vaqtincha mavjud emas.", errGeneric: "Xatolik. Qaytadan urinib ko'ring.",
    statusFailed: 'Xatolik',
  },
  en: {
    cardStep: 'Card details', cardNumber: 'Card number', expiry: 'Expiry (MM/YY)',
    pay: 'Subscribe', processing: 'Processing…',
    secureNote: 'Your card number is never stored — used only for secure payment.',
    otpStep: 'Enter the SMS code', otpDesc: 'A code was sent to the phone linked to the card',
    confirm: 'Confirm', resend: 'Resend code', resendIn: 'Resend',
    successStep: 'Payment successful!', successDesc: 'Your plan is now active.', done: 'Done',
    yourCard: 'Your card', autorenew: 'Auto-renew',
    autorenewDesc: 'We charge your card automatically before the period ends', back: 'Back',
    errCard: 'Invalid card number', errExpiry: 'Invalid expiry',
    errOtp: 'Wrong or expired code. Please try again.',
    errCharge: 'Payment failed. Please try again.',
    errUnavailable: 'Payments are temporarily unavailable.', errGeneric: 'Something went wrong. Try again.',
    statusFailed: 'Failed',
  },
  ru: {
    cardStep: 'Данные карты', cardNumber: 'Номер карты', expiry: 'Срок (ММ/ГГ)',
    pay: 'Оформить подписку', processing: 'Обработка…',
    secureNote: 'Номер карты не сохраняется — используется только для безопасной оплаты.',
    otpStep: 'Введите код из SMS', otpDesc: 'Код отправлен на телефон, привязанный к карте',
    confirm: 'Подтвердить', resend: 'Отправить код повторно', resendIn: 'Отправить снова',
    successStep: 'Оплата прошла успешно!', successDesc: 'Ваш тариф активирован.', done: 'Готово',
    yourCard: 'Ваша карта', autorenew: 'Автопродление',
    autorenewDesc: 'Списываем с карты автоматически перед окончанием периода', back: 'Назад',
    errCard: 'Неверный номер карты', errExpiry: 'Неверный срок действия',
    errOtp: 'Неверный или устаревший код. Введите ещё раз.',
    errCharge: 'Оплата не прошла. Попробуйте снова.',
    errUnavailable: 'Оплата временно недоступна.', errGeneric: 'Произошла ошибка. Попробуйте снова.',
    statusFailed: 'Ошибка',
  },
}

const PLAN_PRICES: Record<PlanType, string> = {
  free:     'Bepul',
  pro:      `${formatSomFromTiyin(PLAN_PRICES_TIYIN.pro.monthly)} so'm`,
  pro_plus: `${formatSomFromTiyin(PLAN_PRICES_TIYIN.pro_plus.monthly)} so'm`,
}

function planFeatures(d: T): Record<PlanType, string[]> {
  return {
    free:     [`1 ${d.billingFeat1Store}`, d.billingFeatHistory7, d.billingFeatBasicStats],
    pro:      [`3 ${d.billingFeatStores}`, d.billingFeatHistory90, d.billingFeatPnl, d.billingFeatAds, d.billingFeatTelegram, d.billingFeatExtension],
    pro_plus: [`3 ${d.billingFeatStores}`, d.billingFeatHistory90, d.billingFeatPnl, d.billingFeatAds, d.billingFeatTelegram, d.billingFeatExtension],
  }
}

function planLabel(plan: PlanType, d: T): string {
  return plan === 'pro' ? d.billingPro : plan === 'pro_plus' ? d.billingProPlus : d.billingFree
}

function fmtSom(n: number) {
  return new Intl.NumberFormat('uz-UZ').format(Math.round(n)) + " so'm"
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('uz-UZ')
}

// Format helpers for the card inputs (display only — stripped before sending).
function formatCard(v: string) {
  return v.replace(/\D/g, '').slice(0, 19).replace(/(.{4})/g, '$1 ').trim()
}
function formatExpiry(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 4)
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d
}

// Map a backend error code + stage to a friendly localized message. Raw ATMOS
// codes (STPIMS-ERR-…) are NEVER shown to the user.
function friendlyError(code: string | undefined, stage: string | undefined, b: Record<string, string>): string {
  if (code === 'invalid_card') return b.errCard
  if (code === 'invalid_expiry') return b.errExpiry
  if (code === 'atmos_not_configured') return b.errUnavailable
  if (stage === 'bind_confirm') return b.errOtp        // wrong/expired OTP — retry the code
  if (stage === 'charge') return b.errCharge
  return b.errGeneric
}

// ── Upgrade Modal — 3 steps: choose → card → OTP → success ──────────────────────

function UpgradeModal({ current, highlight, lang, d, onClose }: {
  current: PlanType; highlight?: 'pro' | 'pro_plus'; lang: Lang; d: T; onClose: () => void
}) {
  const router = useRouter()
  const b = BT[lang]
  const PLAN_FEATURES = planFeatures(d)
  const plans: PlanType[] = ['free', 'pro', 'pro_plus']

  const [step, setStep] = useState<'choose' | 'card' | 'otp' | 'success'>(highlight ? 'card' : 'choose')
  const [plan, setPlan] = useState<PlanType | null>(highlight ?? null)
  const [cardNumber, setCardNumber] = useState('')
  const [expiry, setExpiry] = useState('')
  const [otp, setOtp] = useState('')
  const [ctx, setCtx] = useState<{ paymentId: string; bindTxnId: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [resendLeft, setResendLeft] = useState(0)

  // Resend countdown on the OTP step.
  useEffect(() => {
    if (step !== 'otp' || resendLeft <= 0) return
    const id = setTimeout(() => setResendLeft(n => n - 1), 1000)
    return () => clearTimeout(id)
  }, [step, resendLeft])

  function choose(p: PlanType) {
    if (p === 'free') return
    setPlan(p); setErr(null); setStep('card')
  }

  async function submitCard(resending = false) {
    if (!plan) return
    const pan = cardNumber.replace(/\s/g, '')
    const exp = expiry.trim()
    if (!/^\d{16,19}$/.test(pan)) { setErr(b.errCard); return }
    if (!/^\d{2}\/?\d{2}$/.test(exp)) { setErr(b.errExpiry); return }
    setBusy(true); setErr(null)
    try {
      const res = await fetch('/api/billing/atmos/bind-init', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, interval: 'monthly', card_number: pan, expiry: exp }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data?.ok) {
        setCtx({ paymentId: data.paymentId, bindTxnId: data.bindTxnId })
        setOtp(''); setResendLeft(45)
        if (!resending) setStep('otp')
      } else {
        setErr(friendlyError(data?.error, undefined, b))
      }
    } catch {
      setErr(b.errGeneric)
    }
    setBusy(false)
  }

  async function submitOtp() {
    if (!ctx || otp.length < 4) return
    setBusy(true); setErr(null)
    try {
      const res = await fetch('/api/billing/atmos/bind-confirm', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId: ctx.paymentId, bindTxnId: ctx.bindTxnId, otp }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data?.ok) {
        setStep('success')
      } else {
        // Wrong OTP → stay on this screen, clear the field, let them retry the CODE
        // (no need to re-enter the card). Charge failure → offer restart.
        setErr(friendlyError(data?.error, data?.stage, b))
        if (data?.stage === 'bind_confirm') setOtp('')
      }
    } catch {
      setErr(b.errGeneric)
    }
    setBusy(false)
  }

  const title = step === 'card' ? b.cardStep : step === 'otp' ? b.otpStep : step === 'success' ? b.successStep : d.billingChangePlanTitle

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-[var(--bg-card2)] border border-[var(--border2)] rounded-2xl shadow-2xl shadow-black/60 overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            {step === 'card' && !highlight && (
              <button onClick={() => { setStep('choose'); setErr(null) }} className="text-[var(--text-muted)] hover:text-[var(--text-base)] p-0.5" aria-label={b.back}>
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            {step === 'success' ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Star className="w-4 h-4" style={{ color: 'var(--c1)' }} />}
            <h2 className="text-[var(--text-base)] font-semibold text-sm">{title}</h2>
          </div>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-base)] transition-colors p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step: choose plan */}
        {step === 'choose' && (
          <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {plans.map(p => {
              const isCurrent = p === current
              return (
                <div key={p} className="rounded-xl border p-4 flex flex-col gap-3 transition-all"
                  style={isCurrent
                    ? { borderColor: 'color-mix(in srgb, var(--c1) 50%, transparent)', background: 'color-mix(in srgb, var(--c1) 6%, transparent)' }
                    : { borderColor: 'var(--border)', background: 'var(--bg-card2)' }}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                      style={isCurrent
                        ? { background: 'color-mix(in srgb, var(--c1) 18%, transparent)', border: '1px solid color-mix(in srgb, var(--c1) 30%, transparent)', color: 'var(--c1)' }
                        : { background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                      {planLabel(p, d)}
                    </span>
                    {isCurrent && <CheckCircle className="w-4 h-4" style={{ color: 'var(--c1)' }} />}
                  </div>
                  <p className="font-bold text-base" style={{ color: isCurrent ? 'var(--c1)' : 'var(--text-base)' }}>
                    {PLAN_PRICES[p]}{p !== 'free' && <span className="text-[var(--text-muted)] font-normal text-xs">{d.billingPerMonth}</span>}
                  </p>
                  <ul className="space-y-1.5 flex-1">
                    {PLAN_FEATURES[p].map(f => (
                      <li key={f} className="flex items-start gap-1.5 text-xs text-[var(--text-muted)]">
                        <CheckCircle className="w-3 h-3 text-emerald-400 flex-shrink-0 mt-0.5" />{f}
                      </li>
                    ))}
                  </ul>
                  {isCurrent ? (
                    <div className="mt-2 w-full text-center text-xs font-medium py-2" style={{ color: 'color-mix(in srgb, var(--c1) 75%, transparent)' }}>
                      {d.billingCurrentPlanLabel}
                    </div>
                  ) : p === 'free' ? (
                    <a href="/pricing" className="mt-2 w-full btn-primary text-xs font-semibold py-2 rounded-lg text-center">{d.billingSelectPlan}</a>
                  ) : (
                    <button type="button" onClick={() => choose(p)} className="mt-2 w-full btn-primary text-xs font-semibold py-2 rounded-lg text-center">
                      {d.billingSelectPlan}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Step: card details */}
        {step === 'card' && plan && (
          <form onSubmit={e => { e.preventDefault(); submitCard() }} className="p-6 space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--text-muted)]">{planLabel(plan, d)}</span>
              <span className="font-bold text-[var(--text-base)]">{PLAN_PRICES[plan]}<span className="text-[var(--text-muted)] font-normal text-xs">{d.billingPerMonth}</span></span>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-2">{b.cardNumber}</label>
              <div className="relative">
                <CreditCard className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input inputMode="numeric" autoComplete="cc-number" value={cardNumber}
                  onChange={e => setCardNumber(formatCard(e.target.value))}
                  placeholder="0000 0000 0000 0000"
                  className="w-full bg-[var(--bg-input)] border border-[var(--border2)] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[var(--text-base)] font-mono tracking-wider placeholder:text-[var(--text-muted)] focus:outline-none" />
              </div>
            </div>
            <div className="w-1/2">
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-2">{b.expiry}</label>
              <input inputMode="numeric" autoComplete="cc-exp" value={expiry}
                onChange={e => setExpiry(formatExpiry(e.target.value))}
                placeholder="MM/YY"
                className="w-full bg-[var(--bg-input)] border border-[var(--border2)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-base)] font-mono tracking-wider placeholder:text-[var(--text-muted)] focus:outline-none" />
            </div>
            {err && <p className="text-xs text-red-400">{err}</p>}
            <button type="submit" disabled={busy} className="w-full btn-primary text-sm font-semibold py-2.5 rounded-xl disabled:opacity-60 flex items-center justify-center gap-2">
              {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> {b.processing}</> : b.pay}
            </button>
            <p className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
              <Lock className="w-3 h-3 flex-shrink-0" /> {b.secureNote}
            </p>
          </form>
        )}

        {/* Step: OTP */}
        {step === 'otp' && (
          <form onSubmit={e => { e.preventDefault(); submitOtp() }} className="p-6 space-y-4">
            <p className="text-sm text-[var(--text-muted)]">{b.otpDesc}</p>
            <input inputMode="numeric" autoComplete="one-time-code" value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="••••••" autoFocus
              className="w-full text-center bg-[var(--bg-input)] border border-[var(--border2)] rounded-xl px-4 py-3 text-lg text-[var(--text-base)] font-mono tracking-[0.5em] placeholder:text-[var(--text-muted)] focus:outline-none" />
            {err && <p className="text-xs text-red-400">{err}</p>}
            <button type="submit" disabled={busy || otp.length < 4} className="w-full btn-primary text-sm font-semibold py-2.5 rounded-xl disabled:opacity-60 flex items-center justify-center gap-2">
              {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> {b.processing}</> : b.confirm}
            </button>
            <div className="text-center">
              {resendLeft > 0 ? (
                <span className="text-xs text-[var(--text-muted)]">{b.resendIn} ({resendLeft}s)</span>
              ) : (
                <button type="button" onClick={() => submitCard(true)} disabled={busy} className="text-xs font-medium hover:underline" style={{ color: 'var(--c1)' }}>
                  {b.resend}
                </button>
              )}
            </div>
          </form>
        )}

        {/* Step: success */}
        {step === 'success' && (
          <div className="p-8 text-center space-y-4">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 mx-auto">
              <CheckCircle className="w-7 h-7 text-emerald-400" />
            </div>
            <p className="font-semibold text-[var(--text-base)]">{b.successStep}</p>
            <p className="text-sm text-[var(--text-muted)]">{b.successDesc}</p>
            <button onClick={() => { router.refresh(); onClose() }} className="btn-primary text-sm font-semibold px-6 py-2.5 rounded-xl">
              {b.done}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Auto-renew toggle ───────────────────────────────────────────────────────────

function AutoRenewToggle({ initial, lang }: { initial: boolean; lang: Lang }) {
  const router = useRouter()
  const b = BT[lang]
  const [on, setOn] = useState(initial)
  const [busy, setBusy] = useState(false)

  async function toggle() {
    const next = !on
    setBusy(true); setOn(next)
    try {
      const res = await fetch('/api/billing/autorenew', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: next }),
      })
      if (!res.ok) setOn(!next)
      else router.refresh()
    } catch { setOn(!next) }
    setBusy(false)
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-[var(--text-base)]">{b.autorenew}</p>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">{b.autorenewDesc}</p>
      </div>
      <button type="button" onClick={toggle} disabled={busy} aria-pressed={on}
        className="relative w-11 h-6 rounded-full transition-colors flex-shrink-0 disabled:opacity-60"
        style={{ background: on ? 'var(--c1)' : 'var(--border2)' }}>
        <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all" style={{ left: on ? '22px' : '2px' }} />
      </button>
    </div>
  )
}

// ── Invoice Modal ──────────────────────────────────────────────────────────────

function InvoiceModal({ onClose, d }: { onClose: () => void; d: T }) {
  const [company, setCompany] = useState('')
  const [inn, setInn]         = useState('')
  const [sent, setSent]       = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSent(true)
    setTimeout(onClose, 1200)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-[var(--bg-card2)] border border-[var(--border2)] rounded-2xl shadow-2xl shadow-black/60 overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[var(--c1)]" />
            <h2 className="text-[var(--text-base)] font-semibold text-sm">{d.billingInvoiceTitle}</h2>
          </div>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-base)] transition-colors p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-2">{d.billingCompanyName}</label>
            <input type="text" value={company} onChange={e => setCompany(e.target.value)} required
              className="w-full bg-[var(--bg-input)] border border-[var(--border2)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-base)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--border2)] transition-all" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-2">{d.billingInn}</label>
            <input type="text" value={inn} onChange={e => setInn(e.target.value)} required
              className="w-full bg-[var(--bg-input)] border border-[var(--border2)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-base)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--border2)] transition-all" />
          </div>
          {sent ? (
            <div className="flex items-center gap-2 text-sm px-4 py-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
              <CheckCircle className="w-4 h-4" /> {d.billingInvoiceSent}
            </div>
          ) : (
            <button type="submit" className="w-full btn-primary text-sm font-semibold py-2.5 rounded-xl transition-colors">
              {d.billingSend}
            </button>
          )}
        </form>
      </div>
    </div>
  )
}

function statusBadge(status: PaymentRecord['status'], d: T, failedLabel: string) {
  if (status === 'paid') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
        <CheckCircle className="w-3 h-3" /> {d.billingSuccess}
      </span>
    )
  }
  // failed / cancelled must NOT read as "pending" — a broken/abandoned attempt is
  // not an in-progress one. Show it distinctly (red) so real state is legible.
  if (status === 'failed' || status === 'cancelled') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400">
        <X className="w-3 h-3" /> {failedLabel}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400">
      {d.billingPending}
    </span>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function BillingClient({ billing, initialPlan }: { billing: BillingInfo; initialPlan?: 'pro' | 'pro_plus' }) {
  const { lang } = useLang()
  const l = (lang in BT ? lang : 'uz') as Lang
  const b = BT[l]
  const d = translations[lang].dashboard
  const PLAN_FEATURES = planFeatures(d)
  const [showPlanModal, setShowPlanModal]       = useState(!!initialPlan)
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)

  const plan = billing.plan
  const isFree = plan === 'free'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-base)]">{d.billingTitle}</h1>
        <p className="text-[var(--text-muted)] text-sm mt-1">{d.billingSubtitle}</p>
      </div>

      {/* Current Plan Card */}
      <div className="bg-[var(--bg-card2)] rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border2)' }}>
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-2">
          <Zap className="w-4 h-4" style={{ color: 'var(--c1)' }} />
          <h2 className="text-[var(--text-base)] font-semibold text-sm">{d.billingCurrentPlan}</h2>
        </div>
        <div className="p-6 flex flex-col sm:flex-row sm:items-start gap-6">
          <div className="flex-1 space-y-4">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold"
                style={{ background: 'color-mix(in srgb, var(--c1) 14%, transparent)', border: '1px solid color-mix(in srgb, var(--c1) 35%, transparent)', color: 'var(--c1)' }}>
                <Star className="w-3.5 h-3.5" />
                {planLabel(plan, d)}
              </span>
              {billing.isOnTrial && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400">Trial</span>
              )}
              {billing.planExpiresAt && (
                <span className="text-xs text-[var(--text-muted)]">
                  {d.billingExpiry} <span className="text-[var(--text-dim)]">{fmtDate(billing.planExpiresAt)}</span>
                </span>
              )}
            </div>
            {!isFree && (
              <p className="text-[var(--text-base)] font-bold text-xl">{PLAN_PRICES[plan]}<span className="text-[var(--text-muted)] font-normal text-sm">{d.billingPerMonth}</span></p>
            )}
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PLAN_FEATURES[plan].map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-[var(--text-dim)]">
                  <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--c1)' }} />
                  {f}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex-shrink-0">
            <button
              onClick={() => setShowPlanModal(true)}
              className="flex items-center gap-2 btn-primary text-sm font-semibold px-5 py-2.5 rounded-xl shadow-lg"
            >
              <Package className="w-4 h-4" />
              {isFree ? d.billingUpgrade : d.billingChangePlan}
            </button>
          </div>
        </div>
      </div>

      {/* Your card + auto-renew (only when a card is bound) */}
      {billing.card && (
        <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-[var(--c1)]" />
            <h2 className="text-[var(--text-base)] font-semibold text-sm">{b.yourCard}</h2>
          </div>
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-7 rounded-md flex items-center justify-center" style={{ background: 'var(--bg-input)', border: '1px solid var(--border2)' }}>
                <CreditCard className="w-4 h-4 text-[var(--text-muted)]" />
              </div>
              <div>
                <p className="text-sm font-mono text-[var(--text-base)]">
                  •••• •••• •••• {billing.card.last4 ?? '••••'}
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  {billing.card.expiry ?? ''}{billing.card.holder ? ` · ${billing.card.holder}` : ''}
                </p>
              </div>
            </div>
            <div className="pt-3 border-t border-[var(--border)]">
              <AutoRenewToggle initial={billing.autorenew} lang={l} />
            </div>
          </div>
        </div>
      )}

      {/* Payment Methods */}
      <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-[var(--c1)]" />
          <h2 className="text-[var(--text-base)] font-semibold text-sm">{d.billingPaymentMethods}</h2>
        </div>
        <div className="p-5">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowPlanModal(true)}
              className="flex items-center gap-2 text-sm font-medium text-[var(--text-dim)] hover:text-[var(--text-base)] border border-[var(--border2)] px-4 py-2 rounded-xl transition-all bg-[var(--bg-card2)]"
            >
              <span className="text-[var(--c1)] font-bold text-base leading-none">+</span>
              {d.billingAddPayment}
            </button>
            <button
              onClick={() => setShowInvoiceModal(true)}
              className="flex items-center gap-2 text-sm font-medium text-[var(--text-dim)] hover:text-[var(--text-base)] border border-[var(--border2)] px-4 py-2 rounded-xl transition-all bg-[var(--bg-card2)]"
            >
              <Receipt className="w-4 h-4 text-[var(--text-muted)]" />
              {d.billingRequestInvoice}
            </button>
          </div>
        </div>
      </div>

      {/* Payment History */}
      <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-2">
          <FileText className="w-4 h-4 text-[var(--c1)]" />
          <h2 className="text-[var(--text-base)] font-semibold text-sm">{d.billingPaymentHistory}</h2>
        </div>
        {billing.payments.length === 0 ? (
          <div className="py-12 text-center text-[var(--text-muted)] text-sm">{d.billingNoHistory}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[var(--text-muted)] text-xs border-b border-[var(--border)] bg-[var(--bg-card2)]">
                  <th className="text-left font-medium px-5 py-3">{d.billingColDate}</th>
                  <th className="text-left font-medium px-4 py-3">{d.billingColPlan}</th>
                  <th className="text-right font-medium px-4 py-3">{d.billingColAmount}</th>
                  <th className="text-center font-medium px-4 py-3">{d.billingColStatus}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {billing.payments.map(row => (
                  <tr key={row.id} className="hover:bg-[var(--bg-card2)] transition-colors">
                    <td className="px-5 py-3.5 text-[var(--text-muted)] text-xs">{fmtDate(row.date)}</td>
                    <td className="px-4 py-3.5 text-[var(--text-base)] text-xs font-medium">{row.plan}</td>
                    <td className="px-4 py-3.5 text-right text-emerald-400 text-xs font-semibold">{fmtSom(row.amount)}</td>
                    <td className="px-4 py-3.5 text-center">{statusBadge(row.status, d, b.statusFailed)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showPlanModal    && <UpgradeModal current={plan} highlight={initialPlan} lang={l} d={d} onClose={() => setShowPlanModal(false)} />}
      {showInvoiceModal && <InvoiceModal onClose={() => setShowInvoiceModal(false)} d={d} />}
    </div>
  )
}
