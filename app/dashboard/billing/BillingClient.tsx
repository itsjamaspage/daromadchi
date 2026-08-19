'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  CreditCard, CheckCircle, X, Star, Zap, Package, Receipt, FileText, Lock, Loader2, ArrowLeft, AlertCircle,
} from 'lucide-react'
import { useLang } from '@/app/providers'
import { translations } from '@/lib/i18n'
import type { BillingInfo, PlanType, PaymentRecord } from '@/lib/db/billing'
import { PLAN_PRICES_TIYIN, formatSomFromTiyin, annualMonthlySom, planAmountTiyin } from '@/lib/billing/plans'
import type { Interval, PlanKey } from '@/lib/billing/plans'
import { planFeatureList } from '@/lib/billing/plan-features'
import TierTabs from '@/components/pricing/TierTabs'
import { tiersT } from '@/lib/tiersT'
import type { Tier } from '@/lib/billing/tiers'

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
    monthly: 'Oylik', yearly: 'Yillik', perMonthShort: '/oy',
    billedYearly: "yiliga bir marta to'lov", saveYear: 'Tejang',
    confirmTitle: "To'lovni tasdiqlash",
    chargeOnceYear: "12 oy uchun bir martalik to'lov:",
    chargeMonthly: 'Har oy avtomatik to‘lov:',
    perMonthEq: 'oyiga', continue: 'Davom etish',
    cancelPlan: 'Tarifni bekor qilish',
    cancelTitle: 'Tarifni bekor qilasizmi?',
    cancelBody: "Keyingi to'lov olinmaydi. To'langan davr oxirigacha barcha imkoniyatlar ochiq qoladi, keyin Bepul tarifga o'tasiz.",
    cancelBodyNoPeriod: "Keyingi to'lov olinmaydi. Hozircha to'langan davr yo'q, shuning uchun Bepul tarifga darhol o'tasiz.",
    cancelConfirm: 'Ha, bekor qilaman',
    cancelKeep: 'Yo\u2018q, qoldiraman',
    cancelledBadge: 'Bekor qilingan',
    cancelledUntil: 'Faol:',
    cancelledThenFree: 'gacha, keyin Bepul',
    cancelledOver: "To'langan davr tugadi.",
    resumePlan: 'Tarifni qayta tiklash',
    resumeErrOver: "To'langan davr tugagan — yangi tarifni tanlang.",
    priceNoticeTitle: "Tarif narxi o'zgaradi",
    priceNoticeFrom: 'dan boshlab:',
    priceNoticeBody: "Bu sanagacha yangi narx yechilmaydi. Agar sizga to'g'ri kelmasa, quyida tarifni bekor qilishingiz mumkin — to'lovlar to'xtaydi, kirish esa to'langan davr oxirigacha saqlanadi.",
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
    monthly: 'Monthly', yearly: 'Yearly', perMonthShort: '/mo',
    billedYearly: 'billed once per year', saveYear: 'Save',
    confirmTitle: 'Confirm payment',
    chargeOnceYear: 'One-time charge for 12 months:',
    chargeMonthly: 'Charged automatically each month:',
    perMonthEq: 'per month', continue: 'Continue',
    cancelPlan: 'Cancel plan',
    cancelTitle: 'Cancel your plan?',
    cancelBody: 'You will not be charged again. Everything stays unlocked until the period you have paid for ends, then you move to Free.',
    cancelBodyNoPeriod: 'You will not be charged again. There is no paid period running, so you move to Free right away.',
    cancelConfirm: 'Yes, cancel',
    cancelKeep: 'No, keep it',
    cancelledBadge: 'Cancelled',
    cancelledUntil: 'Active until',
    cancelledThenFree: ', then Free',
    cancelledOver: 'Your paid period has ended.',
    resumePlan: 'Resume plan',
    resumeErrOver: 'The paid period is over — choose a plan instead.',
    priceNoticeTitle: 'Your plan price is changing',
    priceNoticeFrom: 'From',
    priceNoticeBody: 'Nothing is charged at the new price before that date. If it does not suit you, cancel below — charging stops and your access runs to the end of the period you have paid for.',
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
    monthly: 'Помесячно', yearly: 'Ежегодно', perMonthShort: '/мес',
    billedYearly: 'списание раз в год', saveYear: 'Экономия',
    confirmTitle: 'Подтверждение оплаты',
    chargeOnceYear: 'Единоразовое списание за 12 месяцев:',
    chargeMonthly: 'Автосписание каждый месяц:',
    perMonthEq: 'в месяц', continue: 'Продолжить',
    cancelPlan: 'Отменить тариф',
    cancelTitle: 'Отменить тариф?',
    cancelBody: 'Списаний больше не будет. Все возможности останутся открытыми до конца оплаченного периода, затем вы перейдёте на Бесплатный.',
    cancelBodyNoPeriod: 'Списаний больше не будет. Оплаченного периода нет, поэтому вы перейдёте на Бесплатный сразу.',
    cancelConfirm: 'Да, отменить',
    cancelKeep: 'Нет, оставить',
    cancelledBadge: 'Отменён',
    cancelledUntil: 'Активен до',
    cancelledThenFree: ', затем Бесплатный',
    cancelledOver: 'Оплаченный период закончился.',
    resumePlan: 'Возобновить тариф',
    resumeErrOver: 'Оплаченный период закончился — выберите тариф заново.',
    priceNoticeTitle: 'Изменение цены тарифа',
    priceNoticeFrom: 'С',
    priceNoticeBody: 'До этой даты списаний по новой цене не будет. Если она вам не подходит, отмените тариф ниже — списания прекратятся, а доступ сохранится до конца оплаченного периода.',
  },
}

const PLAN_PRICES: Record<PlanType, string> = {
  free:     'Bepul',
  pro:      `${formatSomFromTiyin(PLAN_PRICES_TIYIN.pro.monthly)} so'm`,
  pro_plus: `${formatSomFromTiyin(PLAN_PRICES_TIYIN.pro_plus.monthly)} so'm`,
  biznes:   `${formatSomFromTiyin(PLAN_PRICES_TIYIN.biznes.monthly)} so'm`,
}

function planLabel(plan: PlanType, d: T): string {
  if (plan === 'pro') return d.billingPro
  if (plan === 'pro_plus') return d.billingProPlus
  // Biznes has no entry in the shared dashboard dictionary; the tier vocabulary
  // lives in tiersT, which is where the ladder and cards read their names from.
  if (plan === 'biznes') return tiersT.biznes.uz
  return d.billingFree
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

// Interval-aware price display for a paid plan. Monthly shows the flat monthly
// figure; yearly shows the discounted per-month rate + the once-a-year total.

// Monthly / Yearly switch (shared by the choose + confirm steps).
function IntervalTabs({ value, onChange, b }: {
  value: Interval; onChange: (v: Interval) => void; b: Record<string, string>
}) {
  return (
    <div className="inline-flex items-center gap-1 p-1 rounded-full border border-[var(--border2)] bg-[var(--bg-input)]">
      {(['monthly', 'annual'] as const).map(v => (
        <button key={v} type="button" onClick={() => onChange(v)} aria-pressed={value === v}
          className="text-xs font-semibold px-3.5 py-1.5 rounded-full transition-colors"
          style={value === v ? { background: '#2F6DF6', color: '#fff' } : { color: 'var(--text-muted)' }}>
          {v === 'monthly' ? b.monthly : b.yearly}
        </button>
      ))}
    </div>
  )
}

// ── Upgrade Modal — steps: choose → confirm → card → OTP → success ───────────────

function UpgradeModal({ current, highlight, initialInterval, lang, d, derivedTier, derivedTurnoverSom, onClose }: {
  current: PlanType; highlight?: PlanKey; initialInterval?: Interval; lang: Lang; d: T
  /** Turnover-derived tier. null until the daily cron has computed one. */
  derivedTier: Tier | null
  derivedTurnoverSom: number | null
  onClose: () => void
}) {
  const router = useRouter()
  const b = BT[lang]

  // Opened straight on a plan (via ?plan=) still lands on the confirm step first,
  // so the user always sees the exact amount (and, for yearly, the once-a-year
  // total) before any card details or charge.
  const [step, setStep] = useState<'choose' | 'confirm' | 'card' | 'otp' | 'success'>(highlight ? 'confirm' : 'choose')
  const [plan, setPlan] = useState<PlanType | null>(highlight ?? null)
  const [billingInterval, setBillingInterval] = useState<Interval>(initialInterval ?? 'monthly')
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
    setPlan(p); setErr(null); setStep('confirm')
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
        body: JSON.stringify({ plan, interval: billingInterval, card_number: pan, expiry: exp }),
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

  const title = step === 'confirm' ? b.confirmTitle : step === 'card' ? b.cardStep : step === 'otp' ? b.otpStep : step === 'success' ? b.successStep : d.billingChangePlanTitle

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-[var(--bg-card2)] border border-[var(--border2)] rounded-2xl shadow-2xl shadow-black/60 overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            {step === 'confirm' && (
              <button onClick={() => { setStep('choose'); setErr(null) }} className="text-[var(--text-muted)] hover:text-[var(--text-base)] p-0.5" aria-label={b.back}>
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            {step === 'card' && (
              <button onClick={() => { setStep('confirm'); setErr(null) }} className="text-[var(--text-muted)] hover:text-[var(--text-base)] p-0.5" aria-label={b.back}>
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
          <div className="p-6 space-y-4">
            {/* The plans are ALWAYS shown and always selectable.
                Turnover decides which tier we RECOMMEND, not which one a seller
                is allowed to buy — and every new account starts at zero measured
                sales, so gating the list behind a computed tier left brand-new
                sellers with no way to subscribe at all. */}
            <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--bg-card2)' }}>
              {derivedTurnoverSom !== null && derivedTurnoverSom > 0 ? (
                <>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{tiersT.yourTurnover[lang]}</p>
                  <p className="text-2xl font-bold tabular-nums mt-0.5" style={{ color: 'var(--text-base)' }}>
                    {fmtSom(derivedTurnoverSom)}{' '}
                    <span className="text-sm font-normal" style={{ color: 'var(--text-muted)' }}>{tiersT.som[lang]}</span>
                  </p>
                </>
              ) : (
                <p className="text-sm" style={{ color: 'var(--text-base)' }}>{tiersT.noSalesYet[lang]}</p>
              )}
              <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>{tiersT.autoAdjust[lang]}</p>
            </div>

            <div className="flex justify-center">
              <IntervalTabs value={billingInterval} onChange={setBillingInterval} b={b} />
            </div>

            <TierTabs
              lang={lang}
              interval={billingInterval}
              highlight={derivedTier}
              showInput={false}
              currentTier={current as Tier}
              onSelect={tier => choose(tier as PlanKey)}
            />
          </div>
        )}

        {/* Step: confirm — always shown before card entry / charge, so the exact
            amount (and the once-a-year total for yearly) is explicit. */}
        {step === 'confirm' && plan && plan !== 'free' && (() => {
          const p = plan as PlanKey
          const chargeTiyin = planAmountTiyin(p, billingInterval)
          return (
            <div className="p-6 space-y-5">
              <div className="flex justify-center">
                <IntervalTabs value={billingInterval} onChange={setBillingInterval} b={b} />
              </div>
              <div className="rounded-xl border border-[var(--border2)] bg-[var(--bg-input)] p-5 text-center">
                <p className="text-sm text-[var(--text-muted)]">{planLabel(p, d)} · {billingInterval === 'annual' ? b.yearly : b.monthly}</p>
                <p className="text-xs text-[var(--text-muted)] mt-3">{billingInterval === 'annual' ? b.chargeOnceYear : b.chargeMonthly}</p>
                <p className="text-3xl font-black text-[var(--text-base)] mt-1 tabular-nums">{formatSomFromTiyin(chargeTiyin)} <span className="text-base font-bold">so&rsquo;m</span></p>
                {billingInterval === 'annual' && (
                  <p className="text-xs text-[var(--text-muted)] mt-1.5">
                    ≈ {new Intl.NumberFormat('uz-UZ').format(annualMonthlySom(p))} so&rsquo;m {b.perMonthEq} · {b.billedYearly}
                  </p>
                )}
              </div>
              <button type="button" onClick={() => { setErr(null); setStep('card') }}
                className="w-full btn-primary text-sm font-semibold py-2.5 rounded-xl">
                {b.continue}
              </button>
            </div>
          )
        })()}

        {/* Step: card details */}
        {step === 'card' && plan && (
          <form onSubmit={e => { e.preventDefault(); submitCard() }} className="p-6 space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--text-muted)]">{planLabel(plan, d)} · {billingInterval === 'annual' ? b.yearly : b.monthly}</span>
              <span className="font-bold text-[var(--text-base)] text-right">
                {formatSomFromTiyin(planAmountTiyin(plan as PlanKey, billingInterval))} so&rsquo;m
                <span className="text-[var(--text-muted)] font-normal text-xs">{billingInterval === 'annual' ? ` · ${b.billedYearly}` : d.billingPerMonth}</span>
              </span>
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

export default function BillingClient({ billing, initialPlan, initialInterval }: { billing: BillingInfo; initialPlan?: PlanKey; initialInterval?: Interval }) {
  const { lang } = useLang()
  const l = (lang in BT ? lang : 'uz') as Lang
  const b = BT[l]
  const d = translations[lang].dashboard
  const PLAN_FEATURES = planFeatureList(l)
  const [showPlanModal, setShowPlanModal]       = useState(!!initialPlan)
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  // Which plan the modal opens straight onto. Only the ?plan= auto-open uses a
  // highlight; the "change plan" / "add payment" buttons clear it so the modal
  // opens on the plan chooser (all tariffs visible), not a single locked plan.
  const [modalHighlight, setModalHighlight]     = useState<PlanKey | undefined>(initialPlan)

  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [cancelBusy, setCancelBusy] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)

  function openPlanChooser() {
    setModalHighlight(undefined)
    setShowPlanModal(true)
  }

  const plan = billing.plan
  const isFree = plan === 'free'

  // A cancellation the seller is still living inside: no further charge, but the
  // period they paid for is running. `accessUntil` null means there was nothing
  // paid for to honour, so there is no "active until" date to show.
  const accessUntil = billing.accessUntil ? new Date(billing.accessUntil) : null
  const isCancelled = billing.cancelledAt !== null
  const cancelledStillActive = isCancelled && accessUntil !== null && accessUntil > new Date()

  async function post(action: 'cancel' | 'resume') {
    setCancelBusy(true)
    setCancelError(null)
    try {
      const res = await fetch('/api/billing/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        setCancelError(data?.error === 'period_over' ? b.resumeErrOver : b.errGeneric)
        return
      }
      // Reload rather than patch local state: the plan card, the card panel and
      // the auto-renew toggle all read from the server's billing snapshot, and
      // a hand-maintained copy of that is how they drift apart.
      window.location.reload()
    } catch {
      setCancelError(b.errGeneric)
    } finally {
      setCancelBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-base)]">{d.billingTitle}</h1>
        <p className="text-[var(--text-muted)] text-sm mt-1">{d.billingSubtitle}</p>
      </div>

      {/* Advance notice of a price change.
          Shown from the moment the change is staged, next to the Cancel button
          it tells the seller about — a notice that does not put the way out in
          reach is not much of a notice. It never claims the amount has changed:
          nothing is charged at the new price until the date named here. */}
      {billing.pendingPrice && (
        <div className="rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4"
          style={{ background: 'color-mix(in srgb, var(--c1) 8%, var(--bg-card2))', border: '1px solid color-mix(in srgb, var(--c1) 35%, transparent)' }}>
          <AlertCircle className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--c1)' }} />
          <div className="flex-1 space-y-1">
            <p className="font-semibold text-sm" style={{ color: 'var(--text-base)' }}>{b.priceNoticeTitle}</p>
            <p className="text-sm" style={{ color: 'var(--text-base)' }}>
              {l === 'uz'
                ? <><span className="font-semibold">{fmtDate(billing.pendingPrice.effectiveDate)}</span> {b.priceNoticeFrom} <span className="font-bold">{formatSomFromTiyin(billing.pendingPrice.newAmountTiyin)} so&rsquo;m</span></>
                : <>{b.priceNoticeFrom} <span className="font-semibold">{fmtDate(billing.pendingPrice.effectiveDate)}</span> — <span className="font-bold">{formatSomFromTiyin(billing.pendingPrice.newAmountTiyin)} so&rsquo;m</span></>}
            </p>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>{b.priceNoticeBody}</p>
          </div>
        </div>
      )}

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
              {billing.planExpiresAt && !isCancelled && (
                <span className="text-xs text-[var(--text-muted)]">
                  {d.billingExpiry} <span className="text-[var(--text-dim)]">{fmtDate(billing.planExpiresAt)}</span>
                </span>
              )}
              {/* Cancelled: say what they still have and when it ends, in one
                  line, instead of an expiry date that reads like a renewal. */}
              {isCancelled && (
                <span className="text-xs px-2 py-0.5 rounded-full"
                  style={{ background: 'color-mix(in srgb, var(--text-muted) 12%, transparent)', color: 'var(--text-muted)' }}>
                  {b.cancelledBadge}
                </span>
              )}
              {cancelledStillActive && (
                <span className="text-xs text-[var(--text-muted)]">
                  {b.cancelledUntil} <span className="text-[var(--text-dim)]">{fmtDate(billing.accessUntil!)}</span>{b.cancelledThenFree}
                </span>
              )}
              {isCancelled && !cancelledStillActive && (
                <span className="text-xs text-[var(--text-muted)]">{b.cancelledOver}</span>
              )}
            </div>
            {!isFree && (
              <p className="text-[var(--text-base)] font-bold text-xl">{PLAN_PRICES[plan]}<span className="text-[var(--text-muted)] font-normal text-sm">{d.billingPerMonth}</span></p>
            )}
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* Every paid tier carries the same features, so Biznes reuses the
                  Pro+ bullet list rather than needing its own copy. */}
              {(PLAN_FEATURES[plan === 'biznes' ? 'pro_plus' : plan] ?? []).map((f: string) => (
                <li key={f} className="flex items-center gap-2 text-sm text-[var(--text-dim)]">
                  <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--c1)' }} />
                  {f}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex-shrink-0 flex flex-col items-stretch gap-2">
            <button
              onClick={openPlanChooser}
              className="flex items-center justify-center gap-2 btn-primary text-sm font-semibold px-5 py-2.5 rounded-xl shadow-lg"
            >
              <Package className="w-4 h-4" />
              {isFree ? d.billingUpgrade : d.billingChangePlan}
            </button>

            {/* Cancel is available while a paid plan is live and not already
                cancelled. It is a quiet, bordered button, not a red one: ending a
                subscription is a normal thing a seller is entitled to do, and
                dressing it as a danger action reads as a dark pattern. */}
            {!isFree && !isCancelled && (
              <button
                onClick={() => { setCancelError(null); setShowCancelConfirm(true) }}
                className="text-xs font-semibold px-5 py-2 rounded-xl border transition-colors"
                style={{ borderColor: 'var(--border2)', color: 'var(--text-muted)' }}
              >
                {b.cancelPlan}
              </button>
            )}

            {cancelledStillActive && (
              <button
                onClick={() => post('resume')}
                disabled={cancelBusy}
                className="text-xs font-semibold px-5 py-2 rounded-xl border transition-colors disabled:opacity-60"
                style={{ borderColor: 'var(--c1)', color: 'var(--c1)' }}
              >
                {cancelBusy ? b.processing : b.resumePlan}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Payment Methods */}
      <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-[var(--c1)]" />
          <h2 className="text-[var(--text-base)] font-semibold text-sm">{d.billingPaymentMethods}</h2>
        </div>
        <div className="p-5">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={openPlanChooser}
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

      {/* Your card + auto-renew — shown BELOW "add payment" once a card is bound. */}
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

      {showPlanModal    && <UpgradeModal current={plan} highlight={modalHighlight} initialInterval={initialInterval} lang={l} d={d}
        derivedTier={billing.derivedTier as Tier | null} derivedTurnoverSom={billing.derivedTurnoverSom}
        onClose={() => setShowPlanModal(false)} />}
      {showInvoiceModal && <InvoiceModal onClose={() => setShowInvoiceModal(false)} d={d} />}

      {/* Cancel confirmation. It states the consequence in full — no further
          charge, access until the paid period ends, then Free — because that is
          the whole of what a seller needs to decide, and a vague "are you sure?"
          is how people cancel expecting a refund. */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          role="dialog" aria-modal="true" aria-labelledby="cancel-title">
          <div className="w-full max-w-sm rounded-2xl overflow-hidden"
            style={{ background: 'var(--bg-card2)', border: '1px solid var(--border2)' }}>
            <div className="p-6 space-y-3">
              <h3 id="cancel-title" className="font-bold text-base" style={{ color: 'var(--text-base)' }}>
                {b.cancelTitle}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                {billing.planExpiresAt ? b.cancelBody : b.cancelBodyNoPeriod}
              </p>
              {billing.planExpiresAt && (
                <p className="text-sm font-semibold" style={{ color: 'var(--text-base)' }}>
                  {b.cancelledUntil} {fmtDate(billing.planExpiresAt)}{b.cancelledThenFree}
                </p>
              )}
              {cancelError && <p className="text-sm text-red-400">{cancelError}</p>}
            </div>
            <div className="flex gap-2 p-4 pt-0">
              {/* "Keep it" is the primary button: the destructive option should
                  not be the one a stray Enter press lands on. */}
              <button onClick={() => setShowCancelConfirm(false)} disabled={cancelBusy}
                className="flex-1 btn-primary rounded-xl py-2.5 text-sm font-semibold disabled:opacity-60">
                {b.cancelKeep}
              </button>
              <button onClick={() => post('cancel')} disabled={cancelBusy}
                className="flex-1 rounded-xl border py-2.5 text-sm font-semibold disabled:opacity-60"
                style={{ borderColor: 'var(--border2)', color: 'var(--text-muted)' }}>
                {cancelBusy ? b.processing : b.cancelConfirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
