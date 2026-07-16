/* eslint-disable react/no-unescaped-entities */
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  RefreshCw, Save, Key, CheckCircle, XCircle, ExternalLink,
  Loader2, Hash, Sparkles, Trash2, Send, LinkIcon, Building2, Plus,
} from 'lucide-react'
// import { createClient } from '@/lib/supabase/client'
import type { Shop } from '@/lib/types'

// ─── Shared sub-components ────────────────────────────────────────────────────

function StatusMsg({ msg }: { msg: { ok: boolean; text: string } | null }) {
  if (!msg) return null
  const ok = msg.ok
  return (
    <div
      className="flex items-start gap-2 text-sm px-4 py-2.5 rounded-xl border"
      style={{
        background: ok ? 'var(--status-ok-bg)' : 'var(--status-err-bg)',
        color:      ok ? 'var(--status-ok-text)' : 'var(--status-err-text)',
        borderColor: ok ? 'var(--status-ok-bdr)' : 'var(--status-err-bdr)',
      }}
    >
      {ok ? <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" /> : <XCircle className="w-4 h-4 mt-0.5 shrink-0" />}
      {msg.text}
    </div>
  )
}

// ─── Uzum section ─────────────────────────────────────────────────────────────

function UzumCard({ shop }: { shop: Shop | null; userId: string }) {
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
      setSaveMsg(data.ok
        ? { ok: true, text: data.message ?? 'Saqlandi! Sinxronlash boshlanmoqda…' }
        : { ok: false, text: data.error ?? 'Xato' })
      if (data.ok) {
        setApiKey('')
        router.refresh()
        triggerSync()
      }
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

  function triggerSync() {
    setSyncing(true); setSyncMsg(null)
    const steps = ['Mahsulotlar yuklanmoqda…', 'Buyurtmalar tekshirilmoqda…', 'Reklama kampaniyalari…', 'Saqlanyapti…']
    let stepIdx = 0
    setSyncStep(steps[0])
    const interval = setInterval(() => {
      stepIdx = Math.min(stepIdx + 1, steps.length - 1)
      setSyncStep(steps[stepIdx])
    }, 4000)
    fetch('/api/uzum/sync', { method: 'POST' })
      .then(r => r.json())
      .then(data => {
        setSyncMsg(data.ok
          ? { ok: true, text: `${data.productsUpserted ?? 0} mahsulot, ${data.ordersUpserted ?? 0} buyurtma${data.campaignsUpserted ? `, ${data.campaignsUpserted} kampaniya` : ''} yangilandi.` }
          : { ok: false, text: data.error ?? 'Xato' })
        if (data.ok) router.refresh()
      })
      .catch(() => setSyncMsg({ ok: false, text: "Server bilan bog'lanishda xato" }))
      .finally(() => { clearInterval(interval); setSyncStep(null); setSyncing(false) })
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
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)' }}>
          <span className="text-sm font-bold" style={{ color: 'var(--c1)' }}>U</span>
        </div>
        <div>
          <p className="text-[var(--text-base)] font-semibold text-sm">Uzum Market</p>
          <p className="text-[var(--text-muted)] text-xs">seller.uzum.uz</p>
        </div>
        <span className={`ml-auto text-[10px] font-semibold px-2 py-1 rounded-full border ${hasKey ? 'bg-[var(--badge-ok-bg)] border-[var(--badge-ok-bdr)] text-[var(--badge-ok-text)]' : 'bg-slate-500/10 border-[var(--border)] text-[var(--text-muted)]'}`}>
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
            placeholder="Token kiriting..."
            className="w-full bg-[var(--bg-input)] border border-[var(--border2)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-base)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--border2)] transition-all font-mono"
          />
          <p className="text-[var(--text-muted)] text-xs mt-1.5 flex items-center gap-1">
            <a href="https://seller.uzum.uz" target="_blank" rel="noopener noreferrer" className="flex items-center gap-0.5" style={{ color: 'var(--c1)' }}>
              seller.uzum.uz <ExternalLink className="w-3 h-3" />
            </a>
            → Mening profilim → API kalitlari → Maxfiy kalitni nusxalang
          </p>
        </div>
        <StatusMsg msg={saveMsg} />
        <button type="submit" disabled={saving}
          className="flex items-center gap-2 btn-primary disabled:opacity-50 px-4 py-2 rounded-xl transition-colors">
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
            <div className="flex items-center gap-2 text-xs rounded-xl px-3 py-2" style={{ color: 'var(--c1)', background: 'var(--bg-card2)', border: '1px solid var(--border)' }}>
              <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
              {syncStep}
            </div>
          )}
          <StatusMsg msg={syncMsg} />
          <div className="flex gap-2 flex-wrap">
          <button onClick={handleTest} disabled={testing || syncing || !hasKey}
            title={!hasKey ? 'Avval token saqlang' : ''}
            className="flex items-center gap-2 bg-[var(--bg-input)] hover:bg-[var(--bg-input)] border border-[var(--border2)] disabled:opacity-40 disabled:cursor-not-allowed text-[var(--text-dim)] text-sm font-medium px-4 py-2 rounded-xl transition-colors">
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" style={{ color: 'var(--status-ok-text)' }} />}
            Tekshirish
          </button>
          <button onClick={handleSync} disabled={syncing || !hasKey}
            title={!hasKey ? 'Avval token saqlang' : ''}
            className="flex items-center gap-2 btn-primary border border-transparent disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 rounded-xl transition-colors">
            {syncing ? <><Loader2 className="w-4 h-4 animate-spin" /> Sinxronlanmoqda…</> : <><RefreshCw className="w-4 h-4" /> Sinxronlash</>}
          </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Yandex section ───────────────────────────────────────────────────────────

function YandexCard({ shop }: { shop: Shop | null; userId: string }) {
  const router = useRouter()

  const [apiKey,      setApiKey]      = useState('')
  const [campaignId,  setCampaignId]  = useState('')
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
      setSaveMsg(data.ok
        ? { ok: true, text: data.message ?? 'Saqlandi! Sinxronlash boshlanmoqda…' }
        : { ok: false, text: data.error ?? 'Xato' })
      if (data.ok) {
        setApiKey('')
        router.refresh()
        triggerYandexSync()
      }
    } catch {
      setSaveMsg({ ok: false, text: "Server bilan bog'lanishda xato" })
    }
    setSaving(false)
  }

  function triggerYandexSync() {
    setSyncing(true); setSyncMsg(null)
    const steps = ['Mahsulotlar yuklanmoqda…', 'Buyurtmalar tekshirilmoqda…', 'Reklama kampaniyalari…', 'Saqlanyapti…']
    let stepIdx = 0
    setSyncStep(steps[0])
    const interval = setInterval(() => {
      stepIdx = Math.min(stepIdx + 1, steps.length - 1)
      setSyncStep(steps[stepIdx])
    }, 4000)
    fetch('/api/yandex/sync', { method: 'POST' })
      .then(r => r.json())
      .then(data => {
        setSyncMsg(data.ok
          ? { ok: true, text: `${data.productsUpserted ?? 0} mahsulot, ${data.ordersUpserted ?? 0} buyurtma${data.campaignsUpserted ? `, ${data.campaignsUpserted} kampaniya` : ''} yangilandi.` }
          : { ok: false, text: data.error ?? 'Xato' })
        if (data.ok) router.refresh()
      })
      .catch(() => setSyncMsg({ ok: false, text: "Server bilan bog'lanishda xato" }))
      .finally(() => { clearInterval(interval); setSyncStep(null); setSyncing(false) })
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
        <span className={`ml-auto text-[10px] font-semibold px-2 py-1 rounded-full border ${connected ? 'bg-[var(--badge-ok-bg)] border-[var(--badge-ok-bdr)] text-[var(--badge-ok-text)]' : 'bg-slate-500/10 border-[var(--border)] text-[var(--text-muted)]'}`}>
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
            placeholder="Token kiriting..."
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
            placeholder="Campaign ID kiriting..."
            className="w-full bg-[var(--bg-input)] border border-[var(--border2)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-base)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-amber-500/40 transition-all font-mono"
          />
          <p className="text-[var(--text-muted)] text-xs mt-1.5 flex items-center gap-1">
            <a href="https://partner.market.yandex.ru" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-0.5" style={{ color: 'var(--c1)' }}>
              partner.market.yandex.ru <ExternalLink className="w-3 h-3" />
            </a>
            → Nastroyki → API → Sozdat&apos; token
          </p>
        </div>

        <StatusMsg msg={saveMsg} />
        <button type="submit" disabled={saving}
          className="flex items-center gap-2 btn-primary disabled:opacity-50 px-4 py-2 rounded-xl transition-colors">
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
            <div className="flex items-center gap-2 text-xs rounded-xl px-3 py-2" style={{ color: 'var(--c1)', background: 'var(--bg-card2)', border: '1px solid var(--border)' }}>
              <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
              {syncStep}
            </div>
          )}
          <StatusMsg msg={syncMsg} />
          <div className="flex gap-2 flex-wrap">
            <button onClick={handleTest} disabled={testing || syncing || !connected}
              title={!connected ? 'Avval token va Campaign ID saqlang' : ''}
              className="flex items-center gap-2 bg-[var(--bg-input)] hover:bg-[var(--bg-input)] border border-[var(--border2)] disabled:opacity-40 disabled:cursor-not-allowed text-[var(--text-dim)] text-sm font-medium px-4 py-2 rounded-xl transition-colors">
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" style={{ color: 'var(--status-ok-text)' }} />}
              Tekshirish
            </button>
            <button onClick={handleSync} disabled={syncing || !connected}
              title={!connected ? 'Avval token va Campaign ID saqlang' : ''}
              className="flex items-center gap-2 btn-primary border border-transparent disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 rounded-xl transition-colors">
              {syncing ? <><Loader2 className="w-4 h-4 animate-spin" /> Sinxronlanmoqda…</> : <><RefreshCw className="w-4 h-4" /> Sinxronlash</>}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Wildberries section ──────────────────────────────────────────────────────

function WildberriesCard({ shop }: { shop: Shop | null; userId: string }) {
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
      setSaveMsg(data.ok
        ? { ok: true, text: data.message ?? 'Saqlandi! Sinxronlash boshlanmoqda…' }
        : { ok: false, text: data.error ?? 'Xato' })
      if (data.ok) {
        setApiKey('')
        router.refresh()
        triggerWbSync()
      }
    } catch {
      setSaveMsg({ ok: false, text: "Server bilan bog'lanishda xato" })
    }
    setSaving(false)
  }

  function triggerWbSync() {
    setSyncing(true); setSyncMsg(null)
    const steps = ['Mahsulotlar yuklanmoqda…', 'Buyurtmalar tekshirilmoqda…', 'Saqlanyapti…']
    let stepIdx = 0
    setSyncStep(steps[0])
    const interval = setInterval(() => {
      stepIdx = Math.min(stepIdx + 1, steps.length - 1)
      setSyncStep(steps[stepIdx])
    }, 4000)
    fetch('/api/wildberries/sync', { method: 'POST' })
      .then(r => r.json())
      .then(data => {
        setSyncMsg(data.ok
          ? { ok: true, text: `${data.productsUpserted ?? 0} mahsulot, ${data.ordersUpserted ?? 0} buyurtma yangilandi.` }
          : { ok: false, text: data.error ?? (data.errors?.[0]) ?? 'Xato' })
        if (data.ok) router.refresh()
      })
      .catch(() => setSyncMsg({ ok: false, text: "Server bilan bog'lanishda xato" }))
      .finally(() => { clearInterval(interval); setSyncStep(null); setSyncing(false) })
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
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)' }}>
          <span className="text-sm font-bold" style={{ color: 'var(--c1)' }}>WB</span>
        </div>
        <div>
          <p className="text-[var(--text-base)] font-semibold text-sm">Wildberries</p>
          <p className="text-[var(--text-muted)] text-xs">seller.wildberries.ru</p>
        </div>
        <span className={`ml-auto text-[10px] font-semibold px-2 py-1 rounded-full border ${hasKey ? 'bg-[var(--badge-ok-bg)] border-[var(--badge-ok-bdr)] text-[var(--badge-ok-text)]' : 'bg-slate-500/10 border-[var(--border)] text-[var(--text-muted)]'}`}>
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
            placeholder="Token kiriting..."
            className="w-full bg-[var(--bg-input)] border border-[var(--border2)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-base)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--border2)] transition-all font-mono"
          />
          <p className="text-[var(--text-muted)] text-xs mt-1.5">
            <a href="https://seller.wildberries.ru/supplier-settings/access-to-api" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5" style={{ color: 'var(--c1)' }}>
              seller.wildberries.ru <ExternalLink className="w-3 h-3" />
            </a>
            {' '}→ Nastroyki → Dostup k API → Sozdat' novy klyuch
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>
            ⚠️ Token yaratishda IP cheklovini olib tashlang, aks holda sinxronlash ishlamaydi.
          </p>
        </div>
        <StatusMsg msg={saveMsg} />
        <button type="submit" disabled={saving}
          className="flex items-center gap-2 btn-primary disabled:opacity-50 px-4 py-2 rounded-xl transition-colors">
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
            <div className="flex items-center gap-2 text-xs rounded-xl px-3 py-2" style={{ color: 'var(--c1)', background: 'var(--bg-card2)', border: '1px solid var(--border)' }}>
              <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
              {syncStep}
            </div>
          )}
          <StatusMsg msg={syncMsg} />
          <div className="flex gap-2 flex-wrap">
            <button onClick={handleTest} disabled={testing || syncing || !hasKey}
              title={!hasKey ? 'Avval token saqlang' : ''}
              className="flex items-center gap-2 bg-[var(--bg-input)] hover:bg-[var(--bg-input)] border border-[var(--border2)] disabled:opacity-40 disabled:cursor-not-allowed text-[var(--text-dim)] text-sm font-medium px-4 py-2 rounded-xl transition-colors">
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" style={{ color: 'var(--status-ok-text)' }} />}
              Tekshirish
            </button>
            <button onClick={handleSync} disabled={syncing || !hasKey}
              title={!hasKey ? 'Avval token saqlang' : ''}
              className="flex items-center gap-2 btn-primary border border-transparent disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 rounded-xl transition-colors">
              {syncing ? <><Loader2 className="w-4 h-4 animate-spin" /> Sinxronlanmoqda…</> : <><RefreshCw className="w-4 h-4" /> Sinxronlash</>}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Warehouses section ───────────────────────────────────────────────────────

interface WarehouseRow { id: string; name: string; created_at: string }
interface ShopLite { id: string; name: string; marketplace: string; warehouse_id: string | null }

const MP_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  uzum:          { label: 'UZ', color: '#494fdf', bg: 'rgba(73,79,223,0.15)'   },
  yandex_market: { label: 'YM', color: '#E8A000', bg: 'rgba(232,160,0,0.15)'  },
  wildberries:   { label: 'WB', color: '#CB11AB', bg: 'rgba(203,17,171,0.15)' },
}

function WarehousesCard() {
  const [warehouses, setWarehouses] = useState<WarehouseRow[]>([])
  const [shops,      setShops]      = useState<ShopLite[]>([])
  const [loading,    setLoading]    = useState(true)
  const [showAdd,    setShowAdd]    = useState(false)
  const [newName,    setNewName]    = useState('')
  const [adding,     setAdding]     = useState(false)
  const [msg,        setMsg]        = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    fetch('/api/warehouses')
      .then(r => r.json())
      .then(d => { setWarehouses(d.warehouses ?? []); setShops(d.shops ?? []) })
      .finally(() => setLoading(false))
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setAdding(true); setMsg(null)
    try {
      const res  = await fetch('/api/warehouses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      })
      const data = await res.json()
      if (data.warehouse) { setWarehouses(prev => [...prev, data.warehouse]); setNewName(''); setShowAdd(false) }
      else setMsg({ ok: false, text: data.error ?? 'Xato' })
    } catch { setMsg({ ok: false, text: 'Tarmoq xatosi' }) }
    setAdding(false)
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/warehouses?id=${id}`, { method: 'DELETE' })
    if (res.ok) setWarehouses(prev => prev.filter(w => w.id !== id))
  }

  async function handleAssign(shopId: string, warehouseId: string | null) {
    await fetch('/api/warehouses/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shopId, warehouseId }),
    })
    setShops(prev => prev.map(s => s.id === shopId ? { ...s, warehouse_id: warehouseId } : s))
  }

  return (
    <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[var(--border)] flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(99,179,237,0.12)', border: '1px solid rgba(99,179,237,0.25)' }}>
          <Building2 className="w-4 h-4" style={{ color: '#63b3ed' }} />
        </div>
        <div className="flex-1">
          <p className="text-[var(--text-base)] font-semibold text-sm">Omborlar</p>
          <p className="text-[var(--text-muted)] text-xs">Bir xil tovarlarni sotuvchi do&apos;konlarni birlashtiring</p>
        </div>
        <button
          onClick={() => setShowAdd(v => !v)}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
          style={{ background: 'rgba(99,179,237,0.12)', color: '#63b3ed', border: '1px solid rgba(99,179,237,0.2)' }}
        >
          <Plus className="w-3.5 h-3.5" /> Yangi ombor
        </button>
      </div>

      <div className="p-6 space-y-5">
        {/* Add form */}
        {showAdd && (
          <form onSubmit={handleCreate} className="flex gap-2">
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Ombor nomi (masalan: Toshkent ombori)"
              className="flex-1 bg-[var(--bg-input)] border border-[var(--border2)] rounded-xl px-4 py-2 text-sm text-[var(--text-base)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[rgba(99,179,237,0.5)] transition-all"
            />
            <button type="submit" disabled={adding}
              className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-xl disabled:opacity-50 transition-colors"
              style={{ background: '#63b3ed', color: '#131321' }}>
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Saqlash
            </button>
            <button type="button" onClick={() => setShowAdd(false)}
              className="px-3 py-2 rounded-xl text-sm text-[var(--text-muted)] border border-[var(--border2)] hover:text-red-400 transition-colors">
              <XCircle className="w-4 h-4" />
            </button>
          </form>
        )}
        <StatusMsg msg={msg} />

        {/* Warehouse list */}
        {loading ? (
          <div className="flex items-center gap-2 text-[var(--text-muted)] text-sm py-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Yuklanmoqda…
          </div>
        ) : warehouses.length === 0 ? (
          <p className="text-[var(--text-muted)] text-sm">Hali ombor yo&apos;q. Yuqoridagi tugma bilan yarating.</p>
        ) : (
          <div className="space-y-2">
            {warehouses.map(w => {
              const assigned = shops.filter(s => s.warehouse_id === w.id)
              return (
                <div key={w.id} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border2)]">
                  <Building2 className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
                  <span className="text-sm font-medium text-[var(--text-base)] flex-1">{w.name}</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {assigned.length === 0
                      ? <span className="text-[var(--text-muted)] text-xs">Do&apos;kon biriktirilmagan</span>
                      : assigned.map(s => {
                          const b = MP_BADGE[s.marketplace]
                          return b ? (
                            <span key={s.id} className="text-[10px] font-bold px-2 py-0.5 rounded-md" style={{ background: b.bg, color: b.color, border: `1px solid ${b.color}30` }}>
                              {b.label}
                            </span>
                          ) : null
                        })
                    }
                  </div>
                  <button
                    onClick={() => handleDelete(w.id)}
                    title="O'chirish"
                    className="text-[var(--text-muted)] hover:text-red-400 transition-colors ml-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* Shop assignments */}
        {!loading && shops.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-[var(--border)]">
            <p className="text-xs font-medium text-[var(--text-muted)] pb-1">Do&apos;konni omborga biriktirish</p>
            {shops.map(s => {
              const b = MP_BADGE[s.marketplace]
              return (
                <div key={s.id} className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-[var(--bg-input)] border border-[var(--border2)]">
                  {b && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0" style={{ background: b.bg, color: b.color, border: `1px solid ${b.color}30` }}>
                      {b.label}
                    </span>
                  )}
                  <span className="text-sm text-[var(--text-base)] flex-1 truncate">{s.name}</span>
                  <select
                    value={s.warehouse_id ?? ''}
                    onChange={e => handleAssign(s.id, e.target.value || null)}
                    className="bg-[var(--bg-card2)] border border-[var(--border2)] rounded-lg px-2 py-1 text-xs text-[var(--text-base)] focus:outline-none focus:border-[rgba(99,179,237,0.5)] transition-all cursor-pointer"
                  >
                    <option value="">— Biriktirilmagan —</option>
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

interface Props {
  uzumShop:          Shop | null
  yandexShop:        Shop | null
  wbShop:            Shop | null
  shopCounts:        Record<string, { products: number; orders: number }>
  userId:            string
  telegramChatId?:   string | null
  telegramUsername?: string | null
}

export default function SettingsForm({ uzumShop, yandexShop, wbShop, shopCounts, userId, telegramChatId, telegramUsername }: Props) {
  const mpCards = [
    { shop: uzumShop, mp: 'uzum', Component: UzumCard },
    { shop: yandexShop, mp: 'yandex_market', Component: YandexCard },
    { shop: wbShop, mp: 'wildberries', Component: WildberriesCard },
  ]
  const connected = mpCards.filter(c => c.shop?.api_key_encrypted)
  const notConnected = mpCards.filter(c => !c.shop?.api_key_encrypted)

  return (
    <div className="space-y-6">
      {connected.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {connected.map(({ mp }) => {
            const c = shopCounts[mp]
            const labels: Record<string, string> = { uzum: 'Uzum', yandex_market: 'Yandex', wildberries: 'WB' }
            return (
              <div key={mp} className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-xl px-4 py-3">
                <p className="text-xs font-semibold mb-1" style={{ color: 'var(--c1)' }}>{labels[mp]}</p>
                <p className="text-lg font-bold text-[var(--text-base)]">{c?.products ?? 0} <span className="text-xs font-normal text-[var(--text-muted)]">mahsulot</span></p>
                <p className="text-xs text-[var(--text-muted)]">{c?.orders ?? 0} buyurtma</p>
              </div>
            )
          })}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {mpCards.map(({ shop, Component }) => (
          <Component key={shop?.id ?? Component.name} shop={shop} userId={userId} />
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TelegramCard chatId={telegramChatId ?? null} username={telegramUsername ?? null} />
        <DemoCard />
      </div>
      <WarehousesCard />
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

  useEffect(() => {
    if (!link || connected) return
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/telegram/status')
        const data = await res.json()
        if (data.linked) {
          clearInterval(interval)
          router.refresh()
        }
      } catch {}
    }, 3000)
    return () => clearInterval(interval)
  }, [link, connected, router])

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
          <span className="text-[10px] font-semibold px-2 py-1 rounded-full border" style={{ background: 'var(--badge-ok-bg)', borderColor: 'var(--badge-ok-bdr)', color: 'var(--badge-ok-text)' }}>
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
