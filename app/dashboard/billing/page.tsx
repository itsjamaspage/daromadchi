'use client'

import { useState } from 'react'
import {
  CreditCard, CheckCircle, X, Star, Zap, Package, Receipt, FileText,
} from 'lucide-react'
import { useLang } from '@/app/providers'
import { translations } from '@/lib/i18n'

type T = typeof translations['uz']['dashboard']

// ── Types & mock data ──────────────────────────────────────────────────────────

type Plan = 'bepul' | 'standard' | 'pro'

type PaymentRow = {
  id: number
  date: string
  description: string
  amount: string
  status: 'success'
}

const MOCK_PAYMENTS: PaymentRow[] = [
  { id: 1, date: '2026-05-01', description: "Pro tarif — may 2026",    amount: "249,000 so'm", status: 'success' },
  { id: 2, date: '2026-04-01', description: "Pro tarif — aprel 2026",  amount: "249,000 so'm", status: 'success' },
  { id: 3, date: '2026-03-01', description: "Pro tarif — mart 2026",   amount: "249,000 so'm", status: 'success' },
  { id: 4, date: '2026-02-01', description: "Pro tarif — fevral 2026", amount: "249,000 so'm", status: 'success' },
  { id: 5, date: '2026-01-01', description: "Pro tarif — yanvar 2026", amount: "249,000 so'm", status: 'success' },
]

function planFeatures(d: T): Record<Plan, string[]> {
  return {
    bepul:    [`1 ${d.billingFeat1Store}`, d.billingFeatHistory7, d.billingFeatBasicStats],
    standard: [`2 ${d.billingFeatStores}`, d.billingFeatHistory30, d.billingFeatPnl, d.billingFeatTelegram],
    pro:      [`3 ${d.billingFeatStores}`, d.billingFeatHistory90, d.billingFeatPnl, d.billingFeatAds, d.billingFeatTelegram, d.billingFeatExtension],
  }
}

const PLAN_PRICES: Record<Plan, string> = {
  bepul:    "Bepul",
  standard: "99,000 so'm/oy",
  pro:      "249,000 so'm/oy",
}

function planLabels(d: T): Record<Plan, string> {
  return {
    bepul:    d.billingFree,
    standard: 'Standard',
    pro:      d.billingPro,
  }
}

// ── Plan Modal ─────────────────────────────────────────────────────────────────

function PlanModal({ current, onClose, d }: { current: Plan; onClose: () => void; d: T }) {
  const plans: Plan[] = ['bepul', 'standard', 'pro']
  const PLAN_LABELS = planLabels(d)
  const PLAN_FEATURES = planFeatures(d)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-[var(--bg-card2)] border border-[var(--border2)] rounded-2xl shadow-2xl shadow-black/60 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-cyan-400" />
            <h2 className="text-[var(--text-base)] font-semibold text-sm">{d.billingChangePlanTitle}</h2>
          </div>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-base)] transition-colors p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Plans grid */}
        <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {plans.map(plan => {
            const isCurrent = plan === current
            return (
              <div
                key={plan}
                className={`rounded-xl border p-4 flex flex-col gap-3 transition-all ${
                  isCurrent
                    ? 'border-cyan-500/50 bg-cyan-500/[0.06]'
                    : 'border-[var(--border)] bg-[var(--bg-card2)] hover:border-[var(--border2)]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    isCurrent
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                      : 'bg-[var(--bg-input)] text-[var(--text-muted)] border border-[var(--border)]'
                  }`}>
                    {PLAN_LABELS[plan]}
                  </span>
                  {isCurrent && (
                    <CheckCircle className="w-4 h-4 text-cyan-400" />
                  )}
                </div>
                <p className={`font-bold text-base ${isCurrent ? 'text-cyan-300' : 'text-[var(--text-base)]'}`}>
                  {PLAN_PRICES[plan]}
                </p>
                <ul className="space-y-1.5 flex-1">
                  {PLAN_FEATURES[plan].map(f => (
                    <li key={f} className="flex items-start gap-1.5 text-xs text-[var(--text-muted)]">
                      <CheckCircle className="w-3 h-3 text-emerald-400 flex-shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
                {!isCurrent && (
                  <button className="mt-2 w-full bg-violet-600 hover:bg-violet-500 text-[var(--text-base)] text-xs font-semibold py-2 rounded-lg transition-colors">
                    {d.billingSelectPlan}
                  </button>
                )}
                {isCurrent && (
                  <div className="mt-2 w-full text-center text-xs text-cyan-400/70 font-medium py-2">
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
              placeholder="Mas: Texno Savdo LLC"
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
              placeholder="123456789"
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
              className="w-full bg-violet-600 hover:bg-violet-500 text-[var(--text-base)] text-sm font-semibold py-2.5 rounded-xl transition-colors"
            >
              {d.billingSend}
            </button>
          )}
        </form>
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function BillingPage() {
  const { lang } = useLang()
  const d = translations[lang].dashboard
  const currentPlan: Plan = 'pro'
  const PLAN_FEATURES = planFeatures(d)
  const [showPlanModal, setShowPlanModal]       = useState(false)
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-base)]">{d.billingTitle}</h1>
        <p className="text-[var(--text-muted)] text-sm mt-1">
          {d.billingSubtitle}
        </p>
      </div>

      {/* ── Current Plan Card ──────────────────────────────────────────────────── */}
      <div className="bg-[var(--bg-card2)] border border-cyan-500/30 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-2">
          <Zap className="w-4 h-4 text-cyan-400" />
          <h2 className="text-[var(--text-base)] font-semibold text-sm">{d.billingCurrentPlan}</h2>
        </div>
        <div className="p-6 flex flex-col sm:flex-row sm:items-start gap-6">
          {/* Plan badge + info */}
          <div className="flex-1 space-y-4">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold bg-gradient-to-r from-cyan-500/20 to-violet-500/20 border border-cyan-500/40 text-cyan-300">
                <Star className="w-3.5 h-3.5" />
                Pro
              </span>
              <span className="text-xs text-[var(--text-muted)]">
                {d.billingExpiry} <span className="text-[var(--text-dim)]">2026-07-01</span>
              </span>
            </div>
            <p className="text-[var(--text-base)] font-bold text-xl">249,000 so&apos;m<span className="text-[var(--text-muted)] font-normal text-sm">{d.billingPerMonth}</span></p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PLAN_FEATURES.pro.map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-[var(--text-dim)]">
                  <CheckCircle className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
          {/* Action button */}
          <div className="flex-shrink-0">
            <button
              onClick={() => setShowPlanModal(true)}
              className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-[var(--text-base)] text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors shadow-lg shadow-violet-500/20"
            >
              <Package className="w-4 h-4" />
              {d.billingChangePlan}
            </button>
          </div>
        </div>
      </div>

      {/* ── Payment Methods ────────────────────────────────────────────────────── */}
      <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-violet-400" />
          <h2 className="text-[var(--text-base)] font-semibold text-sm">{d.billingPaymentMethods}</h2>
        </div>
        <div className="p-5 space-y-3">
          {/* Saved card */}
          <div className="flex items-center gap-4 bg-[var(--bg-card2)] border border-[var(--border)] rounded-xl px-4 py-3">
            <div className="w-10 h-7 rounded-md bg-gradient-to-r from-violet-600 to-indigo-600 flex items-center justify-center flex-shrink-0">
              <CreditCard className="w-4 h-4 text-[var(--text-base)]" />
            </div>
            <div className="flex-1">
              <p className="text-[var(--text-base)] text-sm font-semibold">Uzcard **** 4242</p>
              <p className="text-[var(--text-muted)] text-xs mt-0.5">{d.billingCardExpiry}</p>
            </div>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              {d.billingPrimary}
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 pt-1">
            <button className="flex items-center gap-2 text-sm font-medium text-[var(--text-dim)] hover:text-[var(--text-base)] border border-[var(--border2)] hover:border-[var(--border2)] px-4 py-2 rounded-xl transition-all bg-[var(--bg-card2)] hover:bg-[var(--bg-card2)]">
              <span className="text-violet-400 font-bold text-base leading-none">+</span>
              {d.billingAddPayment}
            </button>
            <button
              onClick={() => setShowInvoiceModal(true)}
              className="flex items-center gap-2 text-sm font-medium text-[var(--text-dim)] hover:text-[var(--text-base)] border border-[var(--border2)] hover:border-[var(--border2)] px-4 py-2 rounded-xl transition-all bg-[var(--bg-card2)] hover:bg-[var(--bg-card2)]"
            >
              <Receipt className="w-4 h-4 text-[var(--text-muted)]" />
              {d.billingRequestInvoice}
            </button>
          </div>
        </div>
      </div>

      {/* ── Payment History Table ──────────────────────────────────────────────── */}
      <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-2">
          <FileText className="w-4 h-4 text-violet-400" />
          <h2 className="text-[var(--text-base)] font-semibold text-sm">{d.billingPaymentHistory}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[var(--text-muted)] text-xs border-b border-[var(--border)] bg-[var(--bg-card2)]">
                <th className="text-left font-medium px-5 py-3">{d.billingColDate}</th>
                <th className="text-left font-medium px-4 py-3">{d.billingColDesc}</th>
                <th className="text-right font-medium px-4 py-3">{d.billingColAmount}</th>
                <th className="text-center font-medium px-4 py-3">{d.billingColStatus}</th>
                <th className="text-center font-medium px-4 py-3">{d.billingColReceipt}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {MOCK_PAYMENTS.map(row => (
                <tr key={row.id} className="hover:bg-[var(--bg-card2)] transition-colors">
                  <td className="px-5 py-3.5 text-[var(--text-muted)] text-xs">
                    {new Date(row.date).toLocaleDateString('uz-UZ')}
                  </td>
                  <td className="px-4 py-3.5 text-[var(--text-base)] text-xs font-medium">{row.description}</td>
                  <td className="px-4 py-3.5 text-right text-emerald-400 text-xs font-semibold">{row.amount}</td>
                  <td className="px-4 py-3.5 text-center">
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                      <CheckCircle className="w-3 h-3" />
                      {d.billingSuccess}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <button className="text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-base)] border border-[var(--border2)] hover:border-[var(--border2)] px-3 py-1 rounded-lg transition-all">
                      {d.billingReceipt}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {showPlanModal    && <PlanModal    current={currentPlan} onClose={() => setShowPlanModal(false)} d={d} />}
      {showInvoiceModal && <InvoiceModal onClose={() => setShowInvoiceModal(false)} d={d} />}
    </div>
  )
}
