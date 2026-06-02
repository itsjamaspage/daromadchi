'use client'

import { useState } from 'react'
import {
  CreditCard, CheckCircle, X, Star, Zap, Package, Receipt, FileText,
} from 'lucide-react'

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

const PLAN_FEATURES: Record<Plan, string[]> = {
  bepul:    ["1 do'kon", "7 kun tarixi", "Asosiy statistika"],
  standard: ["2 do'kon", "30 kun tarixi", "P&L hisobot", "Telegram"],
  pro:      ["3 do'kon", "90 kun tarixi", "P&L hisobot", "Reklama tahlili", "Telegram", "Chrome kengaytma"],
}

const PLAN_PRICES: Record<Plan, string> = {
  bepul:    "Bepul",
  standard: "99,000 so'm/oy",
  pro:      "249,000 so'm/oy",
}

const PLAN_LABELS: Record<Plan, string> = {
  bepul:    "Bepul",
  standard: "Standard",
  pro:      "Pro",
}

// ── Plan Modal ─────────────────────────────────────────────────────────────────

function PlanModal({ current, onClose }: { current: Plan; onClose: () => void }) {
  const plans: Plan[] = ['bepul', 'standard', 'pro']

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-[var(--bg-card2)] border border-[var(--border2)] rounded-2xl shadow-2xl shadow-black/60 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/[0.05] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-cyan-400" />
            <h2 className="text-[var(--text-base)] font-semibold text-sm">Tarifni o&apos;zgartirish</h2>
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
                    : 'border-white/[0.07] bg-white/[0.02] hover:border-white/[0.14]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    isCurrent
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                      : 'bg-white/[0.06] text-[var(--text-muted)] border border-[var(--border)]'
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
                    Tanlash
                  </button>
                )}
                {isCurrent && (
                  <div className="mt-2 w-full text-center text-xs text-cyan-400/70 font-medium py-2">
                    Joriy tarif
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

function InvoiceModal({ onClose }: { onClose: () => void }) {
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
        <div className="px-6 py-4 border-b border-white/[0.05] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-violet-400" />
            <h2 className="text-[var(--text-base)] font-semibold text-sm">Hisob-faktura so&apos;rash</h2>
          </div>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-base)] transition-colors p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-2">Kompaniya nomi</label>
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
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-2">INN raqami</label>
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
              <CheckCircle className="w-4 h-4" /> Hisob-faktura yuborildi!
            </div>
          ) : (
            <button
              type="submit"
              className="w-full bg-violet-600 hover:bg-violet-500 text-[var(--text-base)] text-sm font-semibold py-2.5 rounded-xl transition-colors"
            >
              Yuborish
            </button>
          )}
        </form>
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function BillingPage() {
  const currentPlan: Plan = 'pro'
  const [showPlanModal, setShowPlanModal]       = useState(false)
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-base)]">Tarif va to&apos;lov</h1>
        <p className="text-[var(--text-muted)] text-sm mt-1">
          Obuna, to&apos;lov usullari va tarix
        </p>
      </div>

      {/* ── Current Plan Card ──────────────────────────────────────────────────── */}
      <div className="bg-[var(--bg-card2)] border border-cyan-500/30 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.05] flex items-center gap-2">
          <Zap className="w-4 h-4 text-cyan-400" />
          <h2 className="text-[var(--text-base)] font-semibold text-sm">Joriy tarif</h2>
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
                Muddati: <span className="text-[var(--text-dim)]">2026-07-01</span>
              </span>
            </div>
            <p className="text-[var(--text-base)] font-bold text-xl">249,000 so&apos;m<span className="text-[var(--text-muted)] font-normal text-sm">/oy</span></p>
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
              Tarifni o&apos;zgartirish
            </button>
          </div>
        </div>
      </div>

      {/* ── Payment Methods ────────────────────────────────────────────────────── */}
      <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.05] flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-violet-400" />
          <h2 className="text-[var(--text-base)] font-semibold text-sm">To&apos;lov usullari</h2>
        </div>
        <div className="p-5 space-y-3">
          {/* Saved card */}
          <div className="flex items-center gap-4 bg-white/[0.03] border border-[var(--border)] rounded-xl px-4 py-3">
            <div className="w-10 h-7 rounded-md bg-gradient-to-r from-violet-600 to-indigo-600 flex items-center justify-center flex-shrink-0">
              <CreditCard className="w-4 h-4 text-[var(--text-base)]" />
            </div>
            <div className="flex-1">
              <p className="text-[var(--text-base)] text-sm font-semibold">Uzcard **** 4242</p>
              <p className="text-[var(--text-muted)] text-xs mt-0.5">Muddati: 12/27</p>
            </div>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              Asosiy
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 pt-1">
            <button className="flex items-center gap-2 text-sm font-medium text-[var(--text-dim)] hover:text-[var(--text-base)] border border-[var(--border2)] hover:border-white/[0.18] px-4 py-2 rounded-xl transition-all bg-white/[0.02] hover:bg-[var(--bg-card2)]">
              <span className="text-violet-400 font-bold text-base leading-none">+</span>
              To&apos;lov usuli qo&apos;shish
            </button>
            <button
              onClick={() => setShowInvoiceModal(true)}
              className="flex items-center gap-2 text-sm font-medium text-[var(--text-dim)] hover:text-[var(--text-base)] border border-[var(--border2)] hover:border-white/[0.18] px-4 py-2 rounded-xl transition-all bg-white/[0.02] hover:bg-[var(--bg-card2)]"
            >
              <Receipt className="w-4 h-4 text-[var(--text-muted)]" />
              Hisob-faktura so&apos;rash
            </button>
          </div>
        </div>
      </div>

      {/* ── Payment History Table ──────────────────────────────────────────────── */}
      <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.05] flex items-center gap-2">
          <FileText className="w-4 h-4 text-violet-400" />
          <h2 className="text-[var(--text-base)] font-semibold text-sm">To&apos;lov tarixi</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[var(--text-muted)] text-xs border-b border-white/[0.05] bg-white/[0.01]">
                <th className="text-left font-medium px-5 py-3">Sana</th>
                <th className="text-left font-medium px-4 py-3">Tavsif</th>
                <th className="text-right font-medium px-4 py-3">Summa</th>
                <th className="text-center font-medium px-4 py-3">Holat</th>
                <th className="text-center font-medium px-4 py-3">Chek</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {MOCK_PAYMENTS.map(row => (
                <tr key={row.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-3.5 text-[var(--text-muted)] text-xs">
                    {new Date(row.date).toLocaleDateString('uz-UZ')}
                  </td>
                  <td className="px-4 py-3.5 text-[var(--text-base)] text-xs font-medium">{row.description}</td>
                  <td className="px-4 py-3.5 text-right text-emerald-400 text-xs font-semibold">{row.amount}</td>
                  <td className="px-4 py-3.5 text-center">
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                      <CheckCircle className="w-3 h-3" />
                      Muvaffaqiyatli
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <button className="text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-base)] border border-[var(--border2)] hover:border-white/[0.18] px-3 py-1 rounded-lg transition-all">
                      Chek
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {showPlanModal    && <PlanModal    current={currentPlan} onClose={() => setShowPlanModal(false)} />}
      {showInvoiceModal && <InvoiceModal onClose={() => setShowInvoiceModal(false)} />}
    </div>
  )
}
