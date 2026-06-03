'use client'

import { useState } from 'react'
import {
  CreditCard, CheckCircle, X, Star, Zap, Package, Receipt, FileText,
} from 'lucide-react'
import { useLang } from '@/app/providers'
import { translations } from '@/lib/i18n'
import type { BillingInfo, PlanType, PaymentRecord } from '@/lib/db/billing'

type T = typeof translations['uz']['dashboard']

const PLAN_PRICES: Record<PlanType, string> = {
  free:     'Bepul',
  pro:      "300,000 so'm",
  pro_plus: "600,000 so'm",
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

// ── Plan Modal ─────────────────────────────────────────────────────────────────

function PlanModal({ current, onClose, d }: { current: PlanType; onClose: () => void; d: T }) {
  const plans: PlanType[] = ['free', 'pro', 'pro_plus']
  const PLAN_FEATURES = planFeatures(d)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-[var(--bg-card2)] border border-[var(--border2)] rounded-2xl shadow-2xl shadow-black/60 overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4" style={{ color: 'var(--c1)' }} />
            <h2 className="text-[var(--text-base)] font-semibold text-sm">{d.billingChangePlanTitle}</h2>
          </div>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-base)] transition-colors p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {plans.map(plan => {
            const isCurrent = plan === current
            return (
              <div
                key={plan}
                className="rounded-xl border p-4 flex flex-col gap-3 transition-all"
                style={isCurrent
                  ? { borderColor: 'color-mix(in srgb, var(--c1) 50%, transparent)', background: 'color-mix(in srgb, var(--c1) 6%, transparent)' }
                  : { borderColor: 'var(--border)', background: 'var(--bg-card2)' }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                    style={isCurrent
                      ? { background: 'color-mix(in srgb, var(--c1) 18%, transparent)', border: '1px solid color-mix(in srgb, var(--c1) 30%, transparent)', color: 'var(--c1)' }
                      : { background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                    {planLabel(plan, d)}
                  </span>
                  {isCurrent && <CheckCircle className="w-4 h-4" style={{ color: 'var(--c1)' }} />}
                </div>
                <p className="font-bold text-base" style={{ color: isCurrent ? 'var(--c1)' : 'var(--text-base)' }}>
                  {PLAN_PRICES[plan]}{plan !== 'free' && <span className="text-[var(--text-muted)] font-normal text-xs">{d.billingPerMonth}</span>}
                </p>
                <ul className="space-y-1.5 flex-1">
                  {PLAN_FEATURES[plan].map(f => (
                    <li key={f} className="flex items-start gap-1.5 text-xs text-[var(--text-muted)]">
                      <CheckCircle className="w-3 h-3 text-emerald-400 flex-shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
                {!isCurrent ? (
                  <a href="/pricing" className="mt-2 w-full btn-primary text-xs font-semibold py-2 rounded-lg transition-colors text-center">
                    {d.billingSelectPlan}
                  </a>
                ) : (
                  <div className="mt-2 w-full text-center text-xs font-medium py-2" style={{ color: 'color-mix(in srgb, var(--c1) 75%, transparent)' }}>
                    {d.billingCurrentPlanLabel}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
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
            <FileText className="w-4 h-4 text-violet-400" />
            <h2 className="text-[var(--text-base)] font-semibold text-sm">{d.billingInvoiceTitle}</h2>
          </div>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-base)] transition-colors p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-2">{d.billingCompanyName}</label>
            <input
              type="text"
              value={company}
              onChange={e => setCompany(e.target.value)}
              required
              className="w-full bg-[var(--bg-input)] border border-[var(--border2)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-base)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-violet-500/60 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-2">{d.billingInn}</label>
            <input
              type="text"
              value={inn}
              onChange={e => setInn(e.target.value)}
              required
              className="w-full bg-[var(--bg-input)] border border-[var(--border2)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-base)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-violet-500/60 transition-all"
            />
          </div>
          {sent ? (
            <div className="flex items-center gap-2 text-sm px-4 py-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
              <CheckCircle className="w-4 h-4" /> {d.billingInvoiceSent}
            </div>
          ) : (
            <button
              type="submit"
              className="w-full btn-primary text-sm font-semibold py-2.5 rounded-xl transition-colors"
            >
              {d.billingSend}
            </button>
          )}
        </form>
      </div>
    </div>
  )
}

function statusBadge(status: PaymentRecord['status'], d: T) {
  if (status === 'paid') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
        <CheckCircle className="w-3 h-3" /> {d.billingSuccess}
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

export default function BillingClient({ billing }: { billing: BillingInfo }) {
  const { lang } = useLang()
  const d = translations[lang].dashboard
  const PLAN_FEATURES = planFeatures(d)
  const [showPlanModal, setShowPlanModal]       = useState(false)
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

      {/* Payment Methods (request invoice only — no card storage) */}
      <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-violet-400" />
          <h2 className="text-[var(--text-base)] font-semibold text-sm">{d.billingPaymentMethods}</h2>
        </div>
        <div className="p-5">
          <div className="flex flex-wrap gap-2">
            <a
              href="/pricing"
              className="flex items-center gap-2 text-sm font-medium text-[var(--text-dim)] hover:text-[var(--text-base)] border border-[var(--border2)] px-4 py-2 rounded-xl transition-all bg-[var(--bg-card2)]"
            >
              <span className="text-violet-400 font-bold text-base leading-none">+</span>
              {d.billingAddPayment}
            </a>
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
          <FileText className="w-4 h-4 text-violet-400" />
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
                    <td className="px-4 py-3.5 text-center">{statusBadge(row.status, d)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showPlanModal    && <PlanModal    current={plan} onClose={() => setShowPlanModal(false)} d={d} />}
      {showInvoiceModal && <InvoiceModal onClose={() => setShowInvoiceModal(false)} d={d} />}
    </div>
  )
}
