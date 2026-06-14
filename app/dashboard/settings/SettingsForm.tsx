'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  RefreshCw, Save, Key, CheckCircle, XCircle, ExternalLink,
  Loader2, Hash, Sparkles, Trash2, Send, LinkIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Shop } from '@/lib/types'

// ─── Shared sub-components ────────────────────────────────────────────────────

function StatusMsg({ msg }: { msg: { ok: boolean; text: string } | null }) {
  if (!msg) return null
  return (
    <div className={`flex items-start gap-2 text-sm px-4 py-2.5 rounded-xl ${msg.ok ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
      {msg.ok ? <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" /> : <XCircle className="w-4 h-4 mt-0.5 shrink-0" />}
      {msg.text}
    </div>
  )
}

// ─── Uzum section ─────────────────────────────────────────────────────────────

function UzumCard({ shop, userId: _userId }: { shop: Shop | null; userId: string }) {
  const router = useRouter()

  const [apiKey,   setApiKey]   = useState('')
  const [saving,   setSaving]   = useState(false)
  const [syncing,  setSyncing]  = useState(false)
  const [testing,  setTesting]  = useState(false)
  const [syncStep, setSyncStep] = useState<string | null>(null)
  const [saveMsg,  setSaveMsg]  = useState<{ ok: boolean; text: string } | null>(null)
  const [syncMsg,  setSyncMsg]  = useState<{ ok: boolean; text: string } | null>(null)

  const hasKey  = !!shop?.api_key_encrypted
  const lastSync = shop?.last_synced_at
    ? new Date(shop.last_synced_at).toLocaleString('uz-UZ') : null

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!apiKey.trim()) return
    setSaving(true); setSaveMsg(null)
    try {
      const res  = await fetch('/api/shops/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketplace: 'uzum', token: apiKey.trim(), shopName: "Uzum do'konim" }),
      })
      const data = await res.json()
      setSaveMsg(data.ok ? { ok: true, text: 'Saqlandi!' } : { ok: false, text: data.error ?? 'Xato' })
      if (data.ok) { setApiKey(''); router.refresh() }
    } catch {
      setSaveMsg({ ok: false, text: "Server bilan bog'lanishda xato" })
    }
    setSaving(false)
  }

  async function handleTest() {
    setTesting(true); setSyncMsg(null)
    try {
      const res  = await fetch('/api/uzum/sync', { method: 'GET' })
      const data = await res.json()
      setSyncMsg({ ok: data.ok, text: data.message ?? data.error ?? 'Xato' })
    } catch {
      setSyncMsg({ ok: false, text: "Server bilan bog'lanishda xato" })
    }
    setTesting(false)
  }

  async function handleSync() {
    setSyncing(true); setSyncMsg(null)
    const steps = ['Mahsulotlar yuklanmoqda…', 'Buyurtmalar tekshirilmoqda…', 'Reklama kampaniyalari…', 'Saqlanyapti…']
    let stepIdx = 0
    setSyncStep(steps[0])
    const interval = setInterval(() => {
      stepIdx = Math.min(stepIdx + 1, steps.length - 1)
      setSyncStep(steps[stepIdx])
    }, 4000)
    try {
      const res  = await fetch('/api/uzum/sync', { method: 'POST' })
      const data = await res.json()
      setSyncMsg(data.ok
        ? { ok: true, text: `${data.productsUpserted ?? 0} mahsulot, ${data.ordersUpserted ?? 0} buyurtma${data.campaignsUpserted ? `, ${data.campaignsUpserted} kampaniya` : ''} yangilandi.` }
        : { ok: false, text: data.error ?? 'Xato' })
      if (data.ok) router.refresh()
    } catch {
      setSyncMsg({ ok: false, text: "Server bilan bog'lanishda xato" })
    }
    clearInterval(interval)
    setSyncStep(null)
    setSyncing(false)
  }

  return (
    <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[var(--border)] flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-violet-500/15 border border-violet-500/25 flex items-center justify-center">
          <span className="text-sm font-bold text-violet-400">U</span>
        </div>
        <div>
          <p className="text-[var(--text-base)] font-semibold text-sm">Uzum Market</p>
          <p className="text-[var(--text-muted)] text-xs">seller.uzum.uz</p>
        </div>
        <span className={`ml-auto text-[10px] font-semibold px-2 py-1 rounded-full border ${hasKey ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400' : 'bg-slate-500/10 border-[var(--border)] text-[var(--text-muted)]'}`}>
          {hasKey ? 'Ulangan' : 'Ulanmagan'}
        </span>
      </div>

      {/* API token form */}
      <form onSubmit={handleSave} className="p-6 space-y-4">
        <div>
          <label className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)] mb-2">
            <Key className="w-3.5 h-3.5" /> API Token
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder={hasKey ? '••••••••  (yangilash uchun kiriting)' : 'Token kiriting…'}
            className="w-full bg-[var(--bg-input)] border border-[var(--border2)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-base)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-violet-500/60 transition-all font-mono"
          />
          <p className="text-[var(--text-muted)] text-xs mt-1.5 flex items-center gap-1">
            <a href="https://seller.uzum.uz" target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300 flex items-center gap-0.5">
              seller.uzum.uz <ExternalLink className="w-3 h-3" />
            </a>
            → Mening profilim → API kalitlari → Maxfiy kalitni nusxalang
          </p>
        </div>
        <StatusMsg msg={saveMsg} />
        <button type="submit" disabled={saving}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-[var(--text-base)] text-sm font-medium px-4 py-2 rounded-xl transition-colors">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Saqlash
        </button>
      </form>

      {/* Sync */}
      {shop && (
        <div className="px-6 pb-6 space-y-3 border-t border-[var(--border)] pt-4">
          <div className="flex items-center justify-between">
            <p className="text-[var(--text-muted)] text-xs">
              {lastSync ? <>Oxirgi sinxr: <span className="text-[var(--text-dim)]">{lastSync}</span></> : 'Hali sinxronlanmagan'}
            </p>
          </div>
          {syncing && syncStep && (
            <div className="flex items-center gap-2 text-xs text-violet-400 bg-violet-500/5 border border-violet-500/15 rounded-xl px-3 py-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
              {syncStep}
            </div>
          )}
          <StatusMsg msg={syncMsg} />
          <div className="flex gap-2 flex-wrap">
          <button onClick={handleTest} disabled={testing || syncing || !hasKey}
            title={!hasKey ? 'Avval token saqlang' : ''}
            className="flex items-center gap-2 bg-[var(--bg-input)] hover:bg-[var(--bg-input)] border border-[var(--border2)] disabled:opacity-40 disabled:cursor-not-allowed text-[var(--text-dim)] text-sm font-medium px-4 py-2 rounded-xl transition-colors">
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4 text-emerald-400" />}
            Tekshirish
          </button>
          <button onClick={handleSync} disabled={syncing || !hasKey}
            title={!hasKey ? 'Avval token saqlang' : ''}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 border border-transparent disabled:opacity-40 disabled:cursor-not-allowed text-[var(--text-base)] text-sm font-medium px-4 py-2 rounded-xl transition-colors">
            {syncing ? <><Loader2 className="w-4 h-4 animate-spin" /> Sinxronlanmoqda…</> : <><RefreshCw className="w-4 h-4" /> Sinxronlash</>}
          </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Yandex section ───────────────────────────────────────────────────────────

function YandexCard({ shop, userId: _userId }: { shop: Shop | null; userId: string }) {
  const router = useRouter()

  const [apiKey,      setApiKey]      = useState('')
  const [campaignId,  setCampaignId]  = useState(shop?.shop_id_external ?? '')
  const [saving,      setSaving]      = useState(false)
  const [syncing,     setSyncing]     = useState(false)
  const [testing,     setTesting]     = useState(false)
  const [syncStep,    setSyncStep]    = useState<string | null>(null)
  const [saveMsg,     setSaveMsg]     = useState<{ ok: boolean; text: string } | null>(null)
  const [syncMsg,     setSyncMsg]     = useState<{ ok: boolean; text: string } | null>(null)

  const hasKey      = !!shop?.api_key_encrypted
  const hasCampaign = !!shop?.shop_id_external
  const lastSync    = shop?.last_synced_at
    ? new Date(shop.last_synced_at).toLocaleString('uz-UZ') : null

  async function handleTest() {
    setTesting(true); setSyncMsg(null)
    try {
      const res  = await fetch('/api/yandex/sync', { method: 'GET' })
      const data = await res.json()
      setSyncMsg({ ok: data.ok, text: data.message ?? data.error ?? 'Xato' })
    } catch {
      setSyncMsg({ ok: false, text: "Server bilan bog'lanishda xato" })
    }
    setTesting(false)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!apiKey.trim() && !campaignId.trim()) return
    setSaving(true); setSaveMsg(null)
    try {
      const res  = await fetch('/api/shops/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marketplace: 'yandex_market',
          token: apiKey.trim() || undefined,
          campaignId: campaignId.trim() || undefined,
          shopName: "Yandex Market do'konim",
        }),
      })
      const data = await res.json()
      setSaveMsg(data.ok ? { ok: true, text: 'Saqlandi!' } : { ok: false, text: data.error ?? 'Xato' })
      if (data.ok) { setApiKey(''); router.refresh() }
    } catch {
      setSaveMsg({ ok: false, text: "Server bilan bog'lanishda xato" })
    }
    setSaving(false)
  }

  async function handleSync() {
    setSyncing(true); setSyncMsg(null)
    const steps = ['Mahsulotlar yuklanmoqda…', 'Buyurtmalar tekshirilmoqda…', 'Reklama kampaniyalari…', 'Saqlanyapti…']
    let stepIdx = 0
    setSyncStep(steps[0])
    const interval = setInterval(() => {
      stepIdx = Math.min(stepIdx + 1, steps.length - 1)
      setSyncStep(steps[stepIdx])
    }, 4000)
    try {
      const res  = await fetch('/api/yandex/sync', { method: 'POST' })
      const data = await res.json()
      setSyncMsg(data.ok
        ? { ok: true, text: `${data.productsUpserted ?? 0} mahsulot, ${data.ordersUpserted ?? 0} buyurtma${data.campaignsUpserted ? `, ${data.campaignsUpserted} kampaniya` : ''} yangilandi.` }
        : { ok: false, text: data.error ?? 'Xato' })
      if (data.ok) router.refresh()
    } catch {
      setSyncMsg({ ok: false, text: "Server bilan bog'lanishda xato" })
    }
    clearInterval(interval)
    setSyncStep(null)
    setSyncing(false)
  }

  const connected = hasKey && hasCampaign

  return (
    <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[var(--border)] flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
          <span className="text-sm font-bold text-amber-400">Y</span>
        </div>
        <div>
          <p className="text-[var(--text-base)] font-semibold text-sm">Yandex Market</p>
          <p className="text-[var(--text-muted)] text-xs">partner.market.yandex.ru</p>
        </div>
        <span className={`ml-auto text-[10px] font-semibold px-2 py-1 rounded-full border ${connected ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400' : 'bg-slate-500/10 border-[var(--border)] text-[var(--text-muted)]'}`}>
          {connected ? 'Ulangan' : 'Ulanmagan'}
        </span>
      </div>

      {/* Form */}
      <form onSubmit={handleSave} className="p-6 space-y-4">
        <div>
          <label className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)] mb-2">
            <Key className="w-3.5 h-3.5" /> API Token
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder={hasKey ? '••••••••  (yangilash uchun kiriting)' : 'API token kiriting…'}
            className="w-full bg-[var(--bg-input)] border border-[var(--border2)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-base)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-amber-500/40 transition-all font-mono"
          />
        </div>

        <div>
          <label className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)] mb-2">
            <Hash className="w-3.5 h-3.5" /> Campaign ID
          </label>
          <input
            type="text"
            value={campaignId}
            onChange={e => setCampaignId(e.target.value)}
            placeholder={hasCampaign ? shop!.shop_id_external! : 'Campaign ID (masalan: 12345678)'}
            className="w-full bg-[var(--bg-input)] border border-[var(--border2)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-base)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-amber-500/40 transition-all font-mono"
          />
          <p className="text-[var(--text-muted)] text-xs mt-1.5 flex items-center gap-1">
            <a href="https://partner.market.yandex.ru" target="_blank" rel="noopener noreferrer"
              className="text-amber-400 hover:text-amber-300 flex items-center gap-0.5">
              partner.market.yandex.ru <ExternalLink className="w-3 h-3" />
            </a>
            → Nastroyki → API → Sozdat&apos; token
          </p>
        </div>

        <StatusMsg msg={saveMsg} />
        <button type="submit" disabled={saving}
          className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-[var(--text-base)] text-sm font-medium px-4 py-2 rounded-xl transition-colors">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Saqlash
        </button>
      </form>

      {/* Sync */}
      {shop && (
        <div className="px-6 pb-6 space-y-3 border-t border-[var(--border)] pt-4">
          <p className="text-[var(--text-muted)] text-xs">
            {lastSync ? <>Oxirgi sinxr: <span className="text-[var(--text-dim)]">{lastSync}</span></> : 'Hali sinxronlanmagan'}
          </p>
          {syncing && syncStep && (
            <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/5 border border-amber-500/15 rounded-xl px-3 py-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
              {syncStep}
            </div>
          )}
          <StatusMsg msg={syncMsg} />
          <div className="flex gap-2 flex-wrap">
            <button onClick={handleTest} disabled={testing || syncing || !connected}
              title={!connected ? 'Avval token va Campaign ID saqlang' : ''}
              className="flex items-center gap-2 bg-[var(--bg-input)] hover:bg-[var(--bg-input)] border border-[var(--border2)] disabled:opacity-40 disabled:cursor-not-allowed text-[var(--text-dim)] text-sm font-medium px-4 py-2 rounded-xl transition-colors">
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4 text-emerald-400" />}
              Tekshirish
            </button>
            <button onClick={handleSync} disabled={syncing || !connected}
              title={!connected ? 'Avval token va Campaign ID saqlang' : ''}
              className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 border border-transparent disabled:opacity-40 disabled:cursor-not-allowed text-[var(--text-base)] text-sm font-medium px-4 py-2 rounded-xl transition-colors">
              {syncing ? <><Loader2 className="w-4 h-4 animate-spin" /> Sinxronlanmoqda…</> : <><RefreshCw className="w-4 h-4" /> Sinxronlash</>}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Wildberries section ──────────────────────────────────────────────────────

function WildberriesCard({ shop, userId: _userId }: { shop: Shop | null; userId: string }) {
  const router = useRouter()

  const [apiKey,   setApiKey]   = useState('')
  const [saving,   setSaving]   = useState(false)
  const [syncing,  setSyncing]  = useState(false)
  const [testing,  setTesting]  = useState(false)
  const [syncStep, setSyncStep] = useState<string | null>(null)
  const [saveMsg,  setSaveMsg]  = useState<{ ok: boolean; text: string } | null>(null)
  const [syncMsg,  setSyncMsg]  = useState<{ ok: boolean; text: string } | null>(null)

  const hasKey  = !!shop?.api_key_encrypted
  const lastSync = shop?.last_synced_at
    ? new Date(shop.last_synced_at).toLocaleString('uz-UZ') : null

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!apiKey.trim()) return
    setSaving(true); setSaveMsg(null)
    try {
      const res  = await fetch('/api/shops/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketplace: 'wildberries', token: apiKey.trim(), shopName: 'Wildberries do\'konim' }),
      })
      const data = await res.json()
      setSaveMsg(data.ok ? { ok: true, text: 'Saqlandi!' } : { ok: false, text: data.error ?? 'Xato' })
      if (data.ok) { setApiKey(''); router.refresh() }
    } catch {
      setSaveMsg({ ok: false, text: "Server bilan bog'lanishda xato" })
    }
    setSaving(false)
  }

  async function handleTest() {
    setTesting(true); setSyncMsg(null)
    try {
      const res  = await fetch('/api/wildberries/sync', { method: 'GET' })
      const data = await res.json()
      setSyncMsg({ ok: data.ok, text: data.message ?? data.error ?? 'Xato' })
    } catch {
      setSyncMsg({ ok: false, text: "Server bilan bog'lanishda xato" })
    }
    setTesting(false)
  }

  async function handleSync() {
    setSyncing(true); setSyncMsg(null)
    const steps = ['Mahsulotlar yuklanmoqda…', 'Buyurtmalar tekshirilmoqda…', 'Saqlanyapti…']
    let stepIdx = 0
    setSyncStep(steps[0])
    const interval = setInterval(() => {
      stepIdx = Math.min(stepIdx + 1, steps.length - 1)
      setSyncStep(steps[stepIdx])
    }, 4000)
    try {
      const res  = await fetch('/api/wildberries/sync', { method: 'POST' })
      const data = await res.json()
      setSyncMsg(data.ok
        ? { ok: true, text: `${data.productsUpserted ?? 0} mahsulot, ${data.ordersUpserted ?? 0} buyurtma yangilandi.` }
        : { ok: false, text: data.error ?? (data.errors?.[0]) ?? 'Xato' })
      if (data.ok) router.refresh()
    } catch {
      setSyncMsg({ ok: false, text: "Server bilan bog'lanishda xato" })
    }
    clearInterval(interval)
    setSyncStep(null)
    setSyncing(false)
  }

  return (
    <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[var(--border)] flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-purple-500/15 border border-purple-500/25 flex items-center justify-center">
          <span className="text-sm font-bold text-purple-400">WB</span>
        </div>
        <div>
          <p className="text-[var(--text-base)] font-semibold text-sm">Wildberries</p>
          <p className="text-[var(--text-muted)] text-xs">seller.wildberries.ru</p>
        </div>
        <span className={`ml-auto text-[10px] font-semibold px-2 py-1 rounded-full border ${hasKey ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400' : 'bg-slate-500/10 border-[var(--border)] text-[var(--text-muted)]'}`}>
          {hasKey ? 'Ulangan' : 'Ulanmagan'}
        </span>
      </div>

      {/* API token form */}
      <form onSubmit={handleSave} className="p-6 space-y-4">
        <div>
          <label className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)] mb-2">
            <Key className="w-3.5 h-3.5" /> API Token
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder={hasKey ? '••••••••  (yangilash uchun kiriting)' : 'Token kiriting…'}
            className="w-full bg-[var(--bg-input)] border border-[var(--border2)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-base)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-purple-500/60 transition-all font-mono"
          />
          <p className="text-[var(--text-muted)] text-xs mt-1.5">
            <a href="https://seller.wildberries.ru/supplier-settings/access-to-api" target="_blank" rel="noopener noreferrer"
              className="text-purple-400 hover:text-purple-300 inline-flex items-center gap-0.5">
              seller.wildberries.ru <ExternalLink className="w-3 h-3" />
            </a>
            {' '}→ Nastroyki → Dostup k API → Sozdat' novy klyuch
          </p>
          <p className="text-amber-500/80 text-xs mt-1">
            ⚠️ Token yaratishda IP cheklovini olib tashlang, aks holda sinxronlash ishlamaydi.
          </p>
        </div>
        <StatusMsg msg={saveMsg} />
        <button type="submit" disabled={saving}
          className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-[var(--text-base)] text-sm font-medium px-4 py-2 rounded-xl transition-colors">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Saqlash
        </button>
      </form>

      {/* Sync */}
      {shop && (
        <div className="px-6 pb-6 space-y-3 border-t border-[var(--border)] pt-4">
          <p className="text-[var(--text-muted)] text-xs">
            {lastSync ? <>Oxirgi sinxr: <span className="text-[var(--text-dim)]">{lastSync}</span></> : 'Hali sinxronlanmagan'}
          </p>
          {syncing && syncStep && (
            <div className="flex items-center gap-2 text-xs text-purple-400 bg-purple-500/5 border border-purple-500/15 rounded-xl px-3 py-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
              {syncStep}
            </div>
          )}
          <StatusMsg msg={syncMsg} />
          <div className="flex gap-2 flex-wrap">
            <button onClick={handleTest} disabled={testing || syncing || !hasKey}
              title={!hasKey ? 'Avval token saqlang' : ''}
              className="flex items-center gap-2 bg-[var(--bg-input)] hover:bg-[var(--bg-input)] border border-[var(--border2)] disabled:opacity-40 disabled:cursor-not-allowed text-[var(--text-dim)] text-sm font-medium px-4 py-2 rounded-xl transition-colors">
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4 text-emerald-400" />}
              Tekshirish
            </button>
            <button onClick={handleSync} disabled={syncing || !hasKey}
              title={!hasKey ? 'Avval token saqlang' : ''}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 border border-transparent disabled:opacity-40 disabled:cursor-not-allowed text-[var(--text-base)] text-sm font-medium px-4 py-2 rounded-xl transition-colors">
              {syncing ? <><Loader2 className="w-4 h-4 animate-spin" /> Sinxronlanmoqda…</> : <><RefreshCw className="w-4 h-4" /> Sinxronlash</>}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

interface Props {
  uzumShop:          Shop | null
  yandexShop:        Shop | null
  wbShop:            Shop | null
  userId:            string
  telegramChatId?:   string | null
  telegramUsername?: string | null
}

export default function SettingsForm({ uzumShop, yandexShop, wbShop, userId, telegramChatId, telegramUsername }: Props) {
  return (
    <div className="space-y-4">
      <UzumCard        shop={uzumShop}   userId={userId} />
      <YandexCard      shop={yandexShop} userId={userId} />
      <WildberriesCard shop={wbShop}     userId={userId} />
      <TelegramCard    chatId={telegramChatId ?? null} username={telegramUsername ?? null} />
      <DemoCard />
    </div>
  )
}

// ─── Telegram link section ────────────────────────────────────────────────────

function TelegramCard({ chatId, username }: { chatId: string | null; username: string | null }) {
  const router  = useRouter()
  const [link,    setLink]    = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [msg,     setMsg]     = useState<{ ok: boolean; text: string } | null>(null)

  const connected = !!chatId

  async function handleConnect() {
    setLoading(true); setMsg(null)
    try {
      const res  = await fetch('/api/telegram/link', { method: 'POST' })
      const data = await res.json()
      if (data.url) setLink(data.url)
      else setMsg({ ok: false, text: data.error ?? 'Xato' })
    } catch {
      setMsg({ ok: false, text: "Tarmoq xatosi" })
    }
    setLoading(false)
  }

  async function handleDisconnect() {
    setLoading(true); setMsg(null)
    try {
      const res = await fetch('/api/telegram/disconnect', { method: 'POST' })
      if (res.ok) { setLink(null); router.refresh() }
      else setMsg({ ok: false, text: 'Xato' })
    } catch {
      setMsg({ ok: false, text: "Tarmoq xatosi" })
    }
    setLoading(false)
  }

  return (
    <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl overflow-hidden">
      <div className="p-5 flex items-center gap-3 border-b border-[var(--border)]">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(41,182,246,0.12)', border: '1px solid rgba(41,182,246,0.25)' }}>
          <Send className="w-4 h-4 text-sky-400" />
        </div>
        <div className="flex-1">
          <p className="text-[var(--text-base)] font-semibold text-sm">Telegram</p>
          <p className="text-[var(--text-muted)] text-xs">
            {connected
              ? `Ulangan${username ? ': @' + username : ''}`
              : "Ogohlantirishlar va kunlik hisobotlarni Telegram orqali oling"}
          </p>
        </div>
        {connected && (
          <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            Ulangan ✓
          </span>
        )}
      </div>
      <div className="p-5 space-y-3">
        {connected ? (
          <button
            onClick={handleDisconnect}
            disabled={loading}
            className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl border border-[var(--border2)] text-[var(--text-muted)] hover:text-red-400 hover:border-red-500/40 transition-all disabled:opacity-60"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
            Telegram uzish
          </button>
        ) : link ? (
          <div className="space-y-3">
            <p className="text-[var(--text-muted)] text-xs">
              Quyidagi tugmani bosing — bot ochiladi va hisob avtomatik ulanadi:
            </p>
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl text-white transition-all"
              style={{ background: 'linear-gradient(135deg, #29b6f6, #0288d1)' }}
            >
              <Send className="w-4 h-4" /> Telegram botini ochish →
            </a>
            <p className="text-[var(--text-muted)] text-xs">Havola 10 daqiqa amal qiladi. Bog&apos;langandan so&apos;ng sahifani yangilang.</p>
            <button onClick={() => router.refresh()} className="text-xs underline" style={{ color: 'var(--c1)' }}>
              Sahifani yangilash
            </button>
          </div>
        ) : (
          <button
            onClick={handleConnect}
            disabled={loading}
            className="inline-flex items-center gap-2 btn-primary text-sm font-semibold px-4 py-2.5 rounded-xl disabled:opacity-60"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LinkIcon className="w-4 h-4" />}
            Telegram ulash
          </button>
        )}
        <StatusMsg msg={msg} />
      </div>
    </div>
  )
}

// ─── Demo data section ────────────────────────────────────────────────────────

function DemoCard() {
  const router = useRouter()
  const [busy, setBusy] = useState<'load' | 'clear' | null>(null)
  const [msg, setMsg]   = useState<{ ok: boolean; text: string } | null>(null)

  async function load() {
    setBusy('load'); setMsg(null)
    try {
      const res  = await fetch('/api/demo', { method: 'POST' })
      const data = await res.json()
      setMsg(res.ok
        ? { ok: true, text: `Namuna ma'lumotlari yuklandi: ${data.products} mahsulot, ${data.orders} buyurtma, ${data.campaigns} reklama.` }
        : { ok: false, text: data.error ?? 'Xatolik' })
      if (res.ok) router.refresh()
    } catch {
      setMsg({ ok: false, text: 'Tarmoq xatosi' })
    } finally { setBusy(null) }
  }

  async function clear() {
    setBusy('clear'); setMsg(null)
    try {
      const res  = await fetch('/api/demo', { method: 'DELETE' })
      const data = await res.json()
      setMsg(res.ok ? { ok: true, text: 'Namuna ma\'lumotlari o\'chirildi.' } : { ok: false, text: data.error ?? 'Xatolik' })
      if (res.ok) router.refresh()
    } catch {
      setMsg({ ok: false, text: 'Tarmoq xatosi' })
    } finally { setBusy(null) }
  }

  return (
    <div className="bg-[var(--bg-card2)] border border-dashed border-amber-500/40 rounded-2xl overflow-hidden">
      <div className="p-5 flex items-center gap-3 border-b border-[var(--border)]">
        <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-amber-400" />
        </div>
        <div className="flex-1">
          <p className="text-[var(--text-base)] font-semibold text-sm">Namuna (DEMO) ma&apos;lumotlari</p>
          <p className="text-[var(--text-muted)] text-xs">Do&apos;koningizda hali tovar bo&apos;lmasa — ilovani sinab ko&apos;rish uchun</p>
        </div>
      </div>
      <div className="p-5 space-y-3">
        <p className="text-[var(--text-muted)] text-xs leading-relaxed">
          Bu tugma hisobingizga <b>namuna</b> mahsulotlar, buyurtmalar va reklama statistikasini yuklaydi —
          shunda barcha sahifalar (Dashboard, P&amp;L, ABC/XYZ, Reklama...) to&apos;ldirilgan holda ko&apos;rinadi.
          Bu <b>haqiqiy ma&apos;lumot emas</b> va istalgan vaqt bir tugma bilan o&apos;chiriladi.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={load}
            disabled={busy !== null}
            className="inline-flex items-center gap-2 btn-primary text-sm font-semibold px-4 py-2.5 rounded-xl disabled:opacity-60"
          >
            {busy === 'load' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Namuna ma&apos;lumotlarini yuklash
          </button>
          <button
            onClick={clear}
            disabled={busy !== null}
            className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl border border-[var(--border2)] text-[var(--text-muted)] hover:text-red-400 hover:border-red-500/40 transition-all disabled:opacity-60"
          >
            {busy === 'clear' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            O&apos;chirish
          </button>
        </div>
        <StatusMsg msg={msg} />
      </div>
    </div>
  )
}
