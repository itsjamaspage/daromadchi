/* eslint-disable react/no-unescaped-entities */
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  RefreshCw, Save, Key, CheckCircle, XCircle, ExternalLink,
  Loader2, Hash, Trash2, Send, LinkIcon, Building2, Plus, AlertTriangle,
} from 'lucide-react'
import type { Shop } from '@/lib/types'
import { useLang } from '@/app/providers'
import { translations } from '@/lib/i18n'
import { WB_ENABLED } from '@/lib/feature-flags'

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
      <span className="whitespace-pre-wrap break-words min-w-0">{msg.text}</span>
    </div>
  )
}

// ─── Stock-sync (edit) mode panel ─────────────────────────────────────────────
// Opt-in, off by default. Lets a connected Uzum / Yandex Market shop switch from
// read-only into the audited stock-quantity-only writer. This panel only writes
// to Daromadchi's own shop row (/api/shops/stock-sync); the marketplace write
// itself lives exclusively in lib/marketplace/stock-writer.ts (Phase 2).
function StockSyncPanel({ shop, marketplace }: { shop: Shop | null; marketplace: 'uzum' | 'yandex_market' }) {
  const router = useRouter()
  const { lang } = useLang()
  const t = translations[lang].dashboard.settingsPage

  const alreadyConsented = !!shop?.stock_sync_consent_at
  const [mode,     setMode]     = useState<'read_only' | 'stock_sync'>(shop?.api_mode ?? 'read_only')
  const [dryRun,   setDryRun]   = useState<boolean>(shop?.stock_sync_dry_run ?? true)
  const [oversell, setOversell] = useState<'lock_last_unit' | 'partition' | 'off'>(shop?.oversell_mode ?? 'lock_last_unit')
  const [consentChecked, setConsentChecked] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg,    setMsg]    = useState<{ ok: boolean; text: string } | null>(null)

  const hasKey = !!shop?.api_key_encrypted
  // Only offer edit mode to a connected shop.
  if (!shop || !hasKey) return null

  const needsConsent = mode === 'stock_sync' && !alreadyConsented && !consentChecked
  const savedMode = shop.api_mode ?? 'read_only'
  const savedDry  = shop.stock_sync_dry_run ?? true
  const badge = savedMode === 'read_only' ? t.ssBadgeReadOnly : savedDry ? t.ssBadgeTest : t.ssBadgeLive
  const badgeCls = savedMode === 'read_only'
    ? 'bg-slate-500/10 border-[var(--border)] text-[var(--text-muted)]'
    : savedDry
      ? 'bg-[var(--badge-ok-bg)] border-[var(--badge-ok-bdr)] text-[var(--badge-ok-text)]'
      : 'bg-[var(--status-err-bg)] border-[var(--status-err-bdr)] text-[var(--status-err-text)]'

  const cardCls = (active: boolean) =>
    `text-left flex flex-col gap-1 p-3 rounded-xl border transition-colors ${
      active
        ? 'border-[var(--c1)] bg-[var(--bg-card2)]'
        : 'border-[var(--border2)] bg-[var(--bg-input)] hover:border-[var(--border)]'
    }`

  async function handleSave() {
    setSaving(true); setMsg(null)
    try {
      const res = await fetch('/api/shops/stock-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marketplace,
          api_mode: mode,
          dry_run: dryRun,
          oversell_mode: oversell,
          consent: consentChecked || alreadyConsented,
        }),
      })
      const data = await res.json()
      if (data.ok) {
        setMsg({ ok: true, text: t.ssModeSaved })
        setConsentChecked(false)
        router.refresh()
      } else {
        setMsg({ ok: false, text: data.error === 'consent_required' ? t.ssConsentRequiredMsg : (data.error ?? t.error) })
      }
    } catch {
      setMsg({ ok: false, text: t.networkErr })
    }
    setSaving(false)
  }

  return (
    <div className="px-6 pb-6 border-t border-[var(--border)] pt-4 space-y-4">
      <div className="flex items-center gap-2">
        <p className="text-[var(--text-base)] font-semibold text-sm">{t.ssTitle}</p>
        <span className={`ml-auto text-[10px] font-semibold px-2 py-1 rounded-full border ${badgeCls}`}>{badge}</span>
      </div>
      <p className="text-[var(--text-muted)] text-xs">{t.ssSubtitle}</p>

      <div className="grid gap-2 sm:grid-cols-2">
        <button type="button" onClick={() => setMode('read_only')} className={cardCls(mode === 'read_only')}>
          <span className="text-sm font-semibold text-[var(--text-base)]">{t.ssReadOnlyLabel}</span>
          <span className="text-xs text-[var(--text-muted)]">{t.ssReadOnlyDesc}</span>
        </button>
        <button type="button" onClick={() => setMode('stock_sync')} className={cardCls(mode === 'stock_sync')}>
          <span className="text-sm font-semibold text-[var(--text-base)]">{t.ssEditLabel}</span>
          <span className="text-xs text-[var(--text-muted)]">{t.ssEditDesc}</span>
        </button>
      </div>

      {mode === 'stock_sync' && (
        <div className="space-y-4">
          {marketplace === 'uzum' && (
            <div className="flex items-start gap-2 text-xs px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg-card2)] text-[var(--text-muted)]">
              <Key className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: 'var(--c1)' }} />
              <span>{t.ssTokenScopeNote}</span>
            </div>
          )}

          {!alreadyConsented && (
            <div className="space-y-2 px-3 py-3 rounded-xl border border-[var(--border2)] bg-[var(--bg-input)]">
              <p className="text-sm font-semibold text-[var(--text-base)] flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" style={{ color: 'var(--c1)' }} /> {t.ssConsentHeading}
              </p>
              <p className="text-xs text-[var(--text-muted)] whitespace-pre-line">{t.ssConsentBody}</p>
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" checked={consentChecked} onChange={e => setConsentChecked(e.target.checked)} className="mt-0.5" />
                <span className="text-xs text-[var(--text-dim)]">{t.ssConsentAgree}</span>
              </label>
            </div>
          )}

          <label className="flex items-start gap-2 cursor-pointer">
            <input type="checkbox" checked={dryRun} onChange={e => setDryRun(e.target.checked)} className="mt-0.5" />
            <span>
              <span className="text-sm font-medium text-[var(--text-base)]">{t.ssTestModeLabel}</span>
              <span className="block text-xs text-[var(--text-muted)]">{dryRun ? t.ssTestModeDesc : t.ssLiveDesc}</span>
            </span>
          </label>

          <div>
            <p className="text-xs font-medium text-[var(--text-muted)] mb-1.5">{t.ssOversellLabel}</p>
            <select
              value={oversell}
              onChange={e => setOversell(e.target.value as 'lock_last_unit' | 'partition' | 'off')}
              className="w-full bg-[var(--bg-input)] border border-[var(--border2)] rounded-xl px-3 py-2 text-sm text-[var(--text-base)] focus:outline-none"
            >
              <option value="lock_last_unit">{t.ssOversellLockLast}</option>
              <option value="partition">{t.ssOversellPartition}</option>
              <option value="off">{t.ssOversellOff}</option>
            </select>
          </div>
        </div>
      )}

      <StatusMsg msg={msg} />
      <button onClick={handleSave} disabled={saving || needsConsent}
        className="flex items-center gap-2 btn-primary disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-xl transition-colors">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        {t.ssSaveMode}
      </button>
    </div>
  )
}

// ─── Uzum section ─────────────────────────────────────────────────────────────

type SettingsT = { products: string; orders: string; elements: string; campaigns: string; updated: string; error: string }

// Sync result → user-facing status text. Diagnostic debug/details are kept
// server-side (still returned in the JSON for the /uzum/diagnose button) but
// never rendered in the sync card — the raw dumps were unreadable noise.
function uzumSyncText(data: {
  ok?: boolean; error?: string; productsUpserted?: number; ordersUpserted?: number
  campaignsUpserted?: number; itemsUpserted?: number
}, t: SettingsT): { ok: boolean; text: string } {
  const text = data.ok
    ? `${data.productsUpserted ?? 0} ${t.products}, ${data.ordersUpserted ?? 0} ${t.orders} (${data.itemsUpserted ?? 0} ${t.elements})${data.campaignsUpserted ? `, ${data.campaignsUpserted} ${t.campaigns}` : ''} ${t.updated}.`
    : (data.error ?? t.error)
  return { ok: !!data.ok, text }
}

function yandexSyncText(data: {
  ok?: boolean; error?: string; productsUpserted?: number; ordersUpserted?: number
  campaignsUpserted?: number
}, t: SettingsT): { ok: boolean; text: string } {
  const text = data.ok
    ? `${data.productsUpserted ?? 0} ${t.products}, ${data.ordersUpserted ?? 0} ${t.orders}${data.campaignsUpserted ? `, ${data.campaignsUpserted} ${t.campaigns}` : ''} ${t.updated}.`
    : (data.error ?? t.error)
  return { ok: !!data.ok, text }
}

function UzumCard({ shop }: { shop: Shop | null; userId: string }) {
  const router = useRouter()
  const { lang } = useLang()
  const t = translations[lang].dashboard.settingsPage

  const [apiKey,   setApiKey]   = useState('')
  const [saving,   setSaving]   = useState(false)
  const [syncing,  setSyncing]  = useState(false)
  const [testing,  setTesting]  = useState(false)
  const [syncStep, setSyncStep] = useState<string | null>(null)
  const [saveMsg,  setSaveMsg]  = useState<{ ok: boolean; text: string } | null>(null)
  const [syncMsg,  setSyncMsg]  = useState<{ ok: boolean; text: string } | null>(null)
  const [diagnosing, setDiagnosing] = useState(false)

  const hasKey  = !!shop?.api_key_encrypted
  const lastSync = shop?.last_synced_at
    ? new Date(shop.last_synced_at).toLocaleString(lang === 'ru' ? 'ru-RU' : lang === 'en' ? 'en-US' : 'uz-UZ') : null

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!apiKey.trim()) return
    setSaving(true); setSaveMsg(null)
    try {
      const res  = await fetch('/api/shops/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketplace: 'uzum', token: apiKey.trim(), shopName: t.uzumShopName }),
      })
      const data = await res.json()
      setSaveMsg(data.ok
        ? { ok: true, text: data.message ?? t.saved }
        : { ok: false, text: data.error ?? t.error })
      if (data.ok) {
        setApiKey('')
        router.refresh()
        triggerSync()
      }
    } catch {
      setSaveMsg({ ok: false, text: t.networkErr })
    }
    setSaving(false)
  }

  async function handleTest() {
    setTesting(true); setSyncMsg(null)
    try {
      const res  = await fetch('/api/uzum/sync', { method: 'GET' })
      const data = await res.json()
      setSyncMsg({ ok: data.ok, text: data.message ?? data.error ?? t.error })
    } catch {
      setSyncMsg({ ok: false, text: t.networkErr })
    }
    setTesting(false)
  }

  // Read-only diagnostic: shows exactly what Uzum's order API returns so we can
  // see why orders aren't landing (HTTP status + count per FBS/FBO endpoint).
  async function handleDiagnose() {
    setDiagnosing(true); setSyncMsg(null)
    try {
      const res  = await fetch('/api/uzum/diagnose')
      const data = await res.json()
      if (!data.ok) {
        setSyncMsg({ ok: false, text: `${t.diagnose}: ${data.error ?? t.error}` })
      } else {
        const probes = (data.orderProbes ?? []) as { label: string; status: number; count: number | null; sample?: unknown; bodySnippet?: string }[]
        const summary = probes.length === 0
          ? `do'kon topilmadi (shops HTTP ${data.shopsProbe?.status})`
          : probes.map(p => {
              const base = `${p.label}: HTTP ${p.status}${p.count !== null ? ` (${p.count})` : ''}`
              if (p.status >= 400 && p.bodySnippet) return `${base} → ${p.bodySnippet}`
              // Show the first record / raw body of every 200 that carried
              // data — the field names ARE the diagnosis (e.g. what an
              // /v1/invoice record actually looks like).
              if (p.status === 200 && p.sample) {
                return `${base} → ${typeof p.sample === 'string' ? p.sample.slice(0, 250) : JSON.stringify(p.sample).slice(0, 250)}`
              }
              return base
            }).join('\n')
        const spec = `OpenAPI: ${data.specPath ?? 'topilmadi'}${(data.discoveredStatuses?.length ? ` → [${data.discoveredStatuses.join(', ')}]` : '')}`
        const valid = `valid(200): [${(data.validStatuses ?? []).join(', ')}]`
        setSyncMsg({ ok: true, text: `shopIds [${(data.uzumShopIds ?? []).join(', ')}]\n${spec}\n${valid}\n${summary}` })
        console.log('[uzum diagnose]', data)
      }
    } catch {
      setSyncMsg({ ok: false, text: `${t.diagnose}: ${t.networkErr}` })
    }
    setDiagnosing(false)
  }

  function triggerSync() {
    setSyncing(true); setSyncMsg(null)
    const steps = [t.syncStepProducts, t.syncStepOrders, t.syncStepAds, t.syncStepSaving]
    let stepIdx = 0
    setSyncStep(steps[0])
    const interval = setInterval(() => {
      stepIdx = Math.min(stepIdx + 1, steps.length - 1)
      setSyncStep(steps[stepIdx])
    }, 4000)
    fetch('/api/uzum/sync', { method: 'POST' })
      .then(r => r.json())
      .then(data => {
        setSyncMsg(uzumSyncText(data, t))
        if (data.ok) router.refresh()
      })
      .catch(() => setSyncMsg({ ok: false, text: t.networkErr }))
      .finally(() => { clearInterval(interval); setSyncStep(null); setSyncing(false) })
  }

  async function handleSync() {
    setSyncing(true); setSyncMsg(null)
    const steps = [t.syncStepProducts, t.syncStepOrders, t.syncStepAds, t.syncStepSaving]
    let stepIdx = 0
    setSyncStep(steps[0])
    const interval = setInterval(() => {
      stepIdx = Math.min(stepIdx + 1, steps.length - 1)
      setSyncStep(steps[stepIdx])
    }, 4000)
    try {
      const res  = await fetch('/api/uzum/sync', { method: 'POST' })
      const data = await res.json()
      setSyncMsg(uzumSyncText(data, t))
      if (data.ok) router.refresh()
    } catch {
      setSyncMsg({ ok: false, text: t.networkErr })
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
          {hasKey ? t.connected : t.notConnected}
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
            placeholder={t.tokenPlaceholder}
            className="w-full bg-[var(--bg-input)] border border-[var(--border2)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-base)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--border2)] transition-all font-mono"
          />
          <p className="text-[var(--text-muted)] text-xs mt-1.5 flex items-center gap-1">
            <a href="https://seller.uzum.uz" target="_blank" rel="noopener noreferrer" className="flex items-center gap-0.5" style={{ color: 'var(--c1)' }}>
              seller.uzum.uz <ExternalLink className="w-3 h-3" />
            </a>
            {lang === 'ru' ? '→ Мой профиль → API-ключи → Скопировать секретный ключ'
              : lang === 'en' ? '→ My profile → API keys → Copy secret key'
              : '→ Mening profilim → API kalitlari → Maxfiy kalitni nusxalang'}
          </p>
        </div>
        <StatusMsg msg={saveMsg} />
        <button type="submit" disabled={saving}
          className="flex items-center gap-2 btn-primary disabled:opacity-50 px-4 py-2 rounded-xl transition-colors">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {t.save}
        </button>
      </form>

      {/* Sync */}
      {shop && (
        <div className="px-6 pb-6 space-y-3 border-t border-[var(--border)] pt-4">
          <div className="flex items-center justify-between">
            <p className="text-[var(--text-muted)] text-xs">
              {lastSync ? <>{t.lastSync}: <span className="text-[var(--text-dim)]">{lastSync}</span></> : t.neverSynced}
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
            {t.check}
          </button>
          <button onClick={handleSync} disabled={syncing || !hasKey}
            title={!hasKey ? 'Avval token saqlang' : ''}
            className="flex items-center gap-2 btn-primary border border-transparent disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 rounded-xl transition-colors">
            {syncing ? <><Loader2 className="w-4 h-4 animate-spin" /> {t.syncing}</> : <><RefreshCw className="w-4 h-4" /> {t.sync}</>}
          </button>
          <button onClick={handleDiagnose} disabled={diagnosing || syncing || !hasKey}
            title="Buyurtmalar API javobini tekshirish (read-only)"
            className="flex items-center gap-2 bg-[var(--bg-input)] hover:bg-[var(--bg-input)] border border-[var(--border2)] disabled:opacity-40 disabled:cursor-not-allowed text-[var(--text-muted)] text-sm font-medium px-4 py-2 rounded-xl transition-colors">
            {diagnosing ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
            {t.diagnose}
          </button>
          </div>
        </div>
      )}

      <StockSyncPanel shop={shop} marketplace="uzum" />
    </div>
  )
}

// ─── Yandex section ───────────────────────────────────────────────────────────

function YandexCard({ shop }: { shop: Shop | null; userId: string }) {
  const router = useRouter()
  const { lang } = useLang()
  const t = translations[lang].dashboard.settingsPage

  const [apiKey,      setApiKey]      = useState('')
  const [campaignId,  setCampaignId]  = useState('')
  const [businessId,  setBusinessId]  = useState('')
  const [saving,      setSaving]      = useState(false)
  const [syncing,     setSyncing]     = useState(false)
  const [testing,     setTesting]     = useState(false)
  const [syncStep,    setSyncStep]    = useState<string | null>(null)
  const [saveMsg,     setSaveMsg]     = useState<{ ok: boolean; text: string } | null>(null)
  const [syncMsg,     setSyncMsg]     = useState<{ ok: boolean; text: string } | null>(null)

  const hasKey      = !!shop?.api_key_encrypted
  const hasCampaign = !!shop?.shop_id_external
  const storedBusinessId = shop?.business_id ?? null
  const lastSync    = shop?.last_synced_at
    ? new Date(shop.last_synced_at).toLocaleString(lang === 'ru' ? 'ru-RU' : lang === 'en' ? 'en-US' : 'uz-UZ') : null

  async function handleTest() {
    setTesting(true); setSyncMsg(null)
    try {
      const res  = await fetch('/api/yandex/sync', { method: 'GET' })
      const data = await res.json()
      setSyncMsg({ ok: data.ok, text: data.message ?? data.error ?? t.error })
    } catch {
      setSyncMsg({ ok: false, text: t.networkErr })
    }
    setTesting(false)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const trimmedCampaign = campaignId.trim()
    const trimmedBusiness = businessId.trim()
    if (!apiKey.trim() && !trimmedCampaign && !trimmedBusiness) return
    // Yandex Campaign ID must be numeric — reject emails / URLs / anything else
    // early so the sync doesn't fail with a "400 Incorrect campaignId" later.
    if (trimmedCampaign && !/^\d+$/.test(trimmedCampaign)) {
      setSaveMsg({ ok: false, text: t.campaignIdInvalid })
      return
    }
    if (trimmedBusiness && !/^\d+$/.test(trimmedBusiness)) {
      setSaveMsg({ ok: false, text: t.businessIdInvalid })
      return
    }
    setSaving(true); setSaveMsg(null)
    try {
      const res  = await fetch('/api/shops/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marketplace: 'yandex_market',
          token: apiKey.trim() || undefined,
          campaignId: trimmedCampaign || undefined,
          businessId: trimmedBusiness || undefined,
          shopName: t.yandexShopName,
        }),
      })
      const data = await res.json()
      setSaveMsg(data.ok
        ? { ok: true, text: data.message ?? t.saved }
        : { ok: false, text: data.error ?? t.error })
      if (data.ok) {
        setApiKey('')
        setBusinessId('')
        router.refresh()
        triggerYandexSync()
      }
    } catch {
      setSaveMsg({ ok: false, text: t.networkErr })
    }
    setSaving(false)
  }

  function triggerYandexSync() {
    setSyncing(true); setSyncMsg(null)
    const steps = [t.syncStepProducts, t.syncStepOrders, t.syncStepAds, t.syncStepSaving]
    let stepIdx = 0
    setSyncStep(steps[0])
    const interval = setInterval(() => {
      stepIdx = Math.min(stepIdx + 1, steps.length - 1)
      setSyncStep(steps[stepIdx])
    }, 4000)
    fetch('/api/yandex/sync', { method: 'POST' })
      .then(r => r.json())
      .then(data => {
        setSyncMsg(yandexSyncText(data, t))
        if (data.ok) router.refresh()
      })
      .catch(() => setSyncMsg({ ok: false, text: t.networkErr }))
      .finally(() => { clearInterval(interval); setSyncStep(null); setSyncing(false) })
  }

  async function handleSync() {
    setSyncing(true); setSyncMsg(null)
    const steps = [t.syncStepProducts, t.syncStepOrders, t.syncStepAds, t.syncStepSaving]
    let stepIdx = 0
    setSyncStep(steps[0])
    const interval = setInterval(() => {
      stepIdx = Math.min(stepIdx + 1, steps.length - 1)
      setSyncStep(steps[stepIdx])
    }, 4000)
    try {
      const res  = await fetch('/api/yandex/sync', { method: 'POST' })
      const data = await res.json()
      setSyncMsg(yandexSyncText(data, t))
      if (data.ok) router.refresh()
    } catch {
      setSyncMsg({ ok: false, text: t.networkErr })
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
          {connected ? t.connected : t.notConnected}
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
            placeholder={t.tokenPlaceholder}
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
            placeholder={t.campaignPlaceholder}
            inputMode="numeric"
            pattern="[0-9]*"
            className="w-full bg-[var(--bg-input)] border border-[var(--border2)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-base)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-amber-500/40 transition-all font-mono"
          />
          <p className="text-[var(--text-muted)] text-xs mt-1.5">{t.campaignIdHint}</p>
        </div>

        <div>
          <label className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)] mb-2">
            <Building2 className="w-3.5 h-3.5" /> Business ID
          </label>
          <input
            type="text"
            value={businessId}
            onChange={e => setBusinessId(e.target.value)}
            placeholder={storedBusinessId ?? t.businessIdPlaceholder}
            inputMode="numeric"
            pattern="[0-9]*"
            className="w-full bg-[var(--bg-input)] border border-[var(--border2)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-base)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-amber-500/40 transition-all font-mono"
          />
          <p className="text-[var(--text-muted)] text-xs mt-1.5">{t.businessIdHint}</p>
        </div>

        <StatusMsg msg={saveMsg} />
        <button type="submit" disabled={saving}
          className="flex items-center gap-2 btn-primary disabled:opacity-50 px-4 py-2 rounded-xl transition-colors">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {t.save}
        </button>
      </form>

      {/* Sync */}
      {shop && (
        <div className="px-6 pb-6 space-y-3 border-t border-[var(--border)] pt-4">
          <p className="text-[var(--text-muted)] text-xs">
            {lastSync ? <>{t.lastSync}: <span className="text-[var(--text-dim)]">{lastSync}</span></> : t.neverSynced}
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
              {t.check}
            </button>
            <button onClick={handleSync} disabled={syncing || !connected}
              title={!connected ? 'Avval token va Campaign ID saqlang' : ''}
              className="flex items-center gap-2 btn-primary border border-transparent disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 rounded-xl transition-colors">
              {syncing ? <><Loader2 className="w-4 h-4 animate-spin" /> {t.syncing}</> : <><RefreshCw className="w-4 h-4" /> {t.sync}</>}
            </button>
          </div>
        </div>
      )}

      <StockSyncPanel shop={shop} marketplace="yandex_market" />
    </div>
  )
}

// ─── Wildberries section ──────────────────────────────────────────────────────

function WildberriesCard({ shop }: { shop: Shop | null; userId: string }) {
  const router = useRouter()
  const { lang } = useLang()
  const t = translations[lang].dashboard.settingsPage

  const [apiKey,   setApiKey]   = useState('')
  const [saving,   setSaving]   = useState(false)
  const [syncing,  setSyncing]  = useState(false)
  const [testing,  setTesting]  = useState(false)
  const [resetting, setResetting] = useState(false)
  const [syncStep, setSyncStep] = useState<string | null>(null)
  const [saveMsg,  setSaveMsg]  = useState<{ ok: boolean; text: string } | null>(null)
  const [syncMsg,  setSyncMsg]  = useState<{ ok: boolean; text: string } | null>(null)

  const hasKey  = !!shop?.api_key_encrypted
  const lastSync = shop?.last_synced_at
    ? new Date(shop.last_synced_at).toLocaleString(lang === 'ru' ? 'ru-RU' : lang === 'en' ? 'en-US' : 'uz-UZ') : null
  // Server writes throttled_until on the shop row when WB returns 429/461.
  // Comparing `throttled_until > Date.now()` inside render is impure
  // (different values SSR vs client → hydration mismatch), so:
  //   - Initial render: assume active if throttled_until is set at all.
  //   - After mount: an interval ticks every 30s and stores a client-side
  //     snapshot; once the snapshot passes the cooldown, the chip auto-
  //     hides. No page reload needed, no setState in the effect body.
  const throttledUntilMs = shop?.throttled_until ? new Date(shop.throttled_until).getTime() : 0
  const [nowSnapshot, setNowSnapshot] = useState<number | null>(null)
  useEffect(() => {
    if (!throttledUntilMs) return
    const id = window.setInterval(() => { setNowSnapshot(Date.now()) }, 30_000)
    return () => window.clearInterval(id)
  }, [throttledUntilMs])
  const throttled = throttledUntilMs > 0 && (nowSnapshot == null || throttledUntilMs > nowSnapshot)
  const throttledUntilLabel = throttled
    ? new Date(throttledUntilMs).toLocaleString(lang === 'ru' ? 'ru-RU' : lang === 'en' ? 'en-US' : 'uz-UZ')
    : null

  async function handleResetThrottle() {
    setResetting(true); setSyncMsg(null)
    try {
      const res = await fetch('/api/wildberries/reset-throttle', { method: 'POST' })
      const data = await res.json()
      if (data.ok) {
        setSyncMsg({ ok: true, text: lang === 'ru' ? 'Лимит WB сброшен. Можно синхронизировать.' : lang === 'en' ? 'WB throttle reset. You can sync now.' : 'WB limiti tozalandi. Endi sinxronlash mumkin.' })
        router.refresh()
      } else {
        setSyncMsg({ ok: false, text: data.error ?? t.error })
      }
    } catch {
      setSyncMsg({ ok: false, text: t.networkErr })
    }
    setResetting(false)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!apiKey.trim()) return
    setSaving(true); setSaveMsg(null)
    try {
      const res  = await fetch('/api/shops/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketplace: 'wildberries', token: apiKey.trim(), shopName: t.wbShopName }),
      })
      const data = await res.json()
      setSaveMsg(data.ok
        ? { ok: true, text: data.message ?? t.saved }
        : { ok: false, text: data.error ?? t.error })
      if (data.ok) {
        setApiKey('')
        router.refresh()
        triggerWbSync()
      }
    } catch {
      setSaveMsg({ ok: false, text: t.networkErr })
    }
    setSaving(false)
  }

  function triggerWbSync() {
    setSyncing(true); setSyncMsg(null)
    const steps = [t.syncStepProducts, t.syncStepOrders, t.syncStepSaving]
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
          ? { ok: true, text: `${data.productsUpserted ?? 0} ${t.products}, ${data.ordersUpserted ?? 0} ${t.orders} ${t.updated}.` }
          : { ok: false, text: data.error ?? (data.errors?.[0]) ?? t.error })
        if (data.ok) router.refresh()
      })
      .catch(() => setSyncMsg({ ok: false, text: t.networkErr }))
      .finally(() => { clearInterval(interval); setSyncStep(null); setSyncing(false) })
  }

  async function handleTest() {
    setTesting(true); setSyncMsg(null)
    try {
      const res  = await fetch('/api/wildberries/sync', { method: 'GET' })
      const data = await res.json()
      setSyncMsg({ ok: data.ok, text: data.message ?? data.error ?? t.error })
    } catch {
      setSyncMsg({ ok: false, text: t.networkErr })
    }
    setTesting(false)
  }

  async function handleSync() {
    setSyncing(true); setSyncMsg(null)
    const steps = [t.syncStepProducts, t.syncStepOrders, t.syncStepSaving]
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
        ? { ok: true, text: `${data.productsUpserted ?? 0} ${t.products}, ${data.ordersUpserted ?? 0} ${t.orders} ${t.updated}.` }
        : { ok: false, text: data.error ?? (data.errors?.[0]) ?? t.error })
      if (data.ok) router.refresh()
    } catch {
      setSyncMsg({ ok: false, text: t.networkErr })
    }
    clearInterval(interval)
    setSyncStep(null)
    setSyncing(false)
  }

  // Wildberries integration is sunset for now — WB's rate limiter kept locking
  // the app into a permanent throttled state. While sunset, render nothing at
  // all (the "Coming soon" card was removed per request). All the WB code below
  // is kept intact so flipping WB_ENABLED back on restores the full card.
  if (!WB_ENABLED) {
    return null
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
          {hasKey ? t.connected : t.notConnected}
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
            placeholder={t.tokenPlaceholder}
            className="w-full bg-[var(--bg-input)] border border-[var(--border2)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-base)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--border2)] transition-all font-mono"
          />
          <p className="text-[var(--text-muted)] text-xs mt-1.5">
            <a href="https://seller.wildberries.ru/supplier-settings/access-to-api" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5" style={{ color: 'var(--c1)' }}>
              seller.wildberries.ru <ExternalLink className="w-3 h-3" />
            </a>
            {lang === 'ru' ? ' → Настройки → Доступ к API → Создать новый ключ'
              : lang === 'en' ? ' → Settings → API access → Create new key'
              : " → Nastroyki → Dostup k API → Sozdat' novy klyuch"}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>
            {lang === 'ru' ? '⚠️ При создании токена снимите ограничение по IP, иначе синхронизация не будет работать.'
              : lang === 'en' ? '⚠️ When creating the token, remove the IP restriction — otherwise sync will not work.'
              : '⚠️ Token yaratishda IP cheklovini olib tashlang, aks holda sinxronlash ishlamaydi.'}
          </p>
        </div>
        <StatusMsg msg={saveMsg} />
        <button type="submit" disabled={saving}
          className="flex items-center gap-2 btn-primary disabled:opacity-50 px-4 py-2 rounded-xl transition-colors">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {t.save}
        </button>
      </form>

      {/* Sync */}
      {shop && (
        <div className="px-6 pb-6 space-y-3 border-t border-[var(--border)] pt-4">
          <p className="text-[var(--text-muted)] text-xs">
            {lastSync ? <>{t.lastSync}: <span className="text-[var(--text-dim)]">{lastSync}</span></> : t.neverSynced}
          </p>
          {syncing && syncStep && (
            <div className="flex items-center gap-2 text-xs rounded-xl px-3 py-2" style={{ color: 'var(--c1)', background: 'var(--bg-card2)', border: '1px solid var(--border)' }}>
              <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
              {syncStep}
            </div>
          )}
          <StatusMsg msg={syncMsg} />
          {throttled && (
            <div className="flex items-start gap-2 text-xs rounded-xl px-3 py-2"
              style={{ color: 'var(--status-err-text)', background: 'var(--status-err-bg)', border: '1px solid var(--status-err-bdr)' }}>
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <span>
                {lang === 'ru'
                  ? `Wildberries ограничил синхронизацию до ${throttledUntilLabel}. Приложение подождёт, чтобы их лимитер восстановился.`
                  : lang === 'en'
                  ? `Wildberries throttled sync until ${throttledUntilLabel}. The app will wait for their limiter to recover.`
                  : `Wildberries sinxronlashni ${throttledUntilLabel} gacha cheklab qo'ydi. Ilova ularning limiterini tiklanishini kutadi.`}
              </span>
            </div>
          )}
          <div className="flex gap-2 flex-wrap">
            <button onClick={handleTest} disabled={testing || syncing || !hasKey}
              title={!hasKey ? 'Avval token saqlang' : ''}
              className="flex items-center gap-2 bg-[var(--bg-input)] hover:bg-[var(--bg-input)] border border-[var(--border2)] disabled:opacity-40 disabled:cursor-not-allowed text-[var(--text-dim)] text-sm font-medium px-4 py-2 rounded-xl transition-colors">
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" style={{ color: 'var(--status-ok-text)' }} />}
              {t.check}
            </button>
            <button onClick={handleSync} disabled={syncing || !hasKey}
              title={!hasKey ? 'Avval token saqlang' : ''}
              className="flex items-center gap-2 btn-primary border border-transparent disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 rounded-xl transition-colors">
              {syncing ? <><Loader2 className="w-4 h-4 animate-spin" /> {t.syncing}</> : <><RefreshCw className="w-4 h-4" /> {t.sync}</>}
            </button>
            {throttled && (
              <button onClick={handleResetThrottle} disabled={resetting}
                title={lang === 'ru' ? 'Сбросить сохранённый лимит и попробовать синхронизацию снова' : 'Reset the stored throttle and try syncing again'}
                className="flex items-center gap-2 bg-[var(--bg-input)] hover:bg-[var(--bg-input)] border border-[var(--border2)] disabled:opacity-40 disabled:cursor-not-allowed text-[var(--text-dim)] text-sm font-medium px-4 py-2 rounded-xl transition-colors">
                {resetting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                {lang === 'ru' ? 'Сбросить лимит' : lang === 'en' ? 'Reset throttle' : 'Limitni tozalash'}
              </button>
            )}
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
  const { lang } = useLang()
  const t = translations[lang].dashboard.settingsPage
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
      else setMsg({ ok: false, text: data.error ?? t.error })
    } catch { setMsg({ ok: false, text: t.networkErr }) }
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
          <p className="text-[var(--text-base)] font-semibold text-sm">{t.warehouses}</p>
          <p className="text-[var(--text-muted)] text-xs">{t.warehousesSub}</p>
        </div>
        <button
          onClick={() => setShowAdd(v => !v)}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
          style={{ background: 'rgba(99,179,237,0.12)', color: '#63b3ed', border: '1px solid rgba(99,179,237,0.2)' }}
        >
          <Plus className="w-3.5 h-3.5" /> {t.newWarehouse}
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
  const { lang } = useLang()
  const t = translations[lang].dashboard.settingsPage
  const allMpCards = [
    { shop: uzumShop, mp: 'uzum', Component: UzumCard },
    { shop: yandexShop, mp: 'yandex_market', Component: YandexCard },
    { shop: wbShop, mp: 'wildberries', Component: WildberriesCard },
  ]
  // Wildberries is sunset — its card renders nothing, so drop it from the grid
  // entirely rather than leave an empty third column that shoves the remaining
  // two cards to the left. Columns then match the visible card count so the
  // pair fills the width evenly (restores to 3 when WB is re-enabled).
  const mpCards = WB_ENABLED ? allMpCards : allMpCards.filter(c => c.mp !== 'wildberries')
  const connected = mpCards.filter(c => c.shop?.api_key_encrypted)
  const cardCols    = mpCards.length >= 3   ? 'md:grid-cols-3' : 'md:grid-cols-2'
  const summaryCols = connected.length >= 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'

  return (
    <div className="space-y-6">
      {connected.length > 0 && (
        <div className={`grid grid-cols-1 ${summaryCols} gap-3`}>
          {connected.map(({ mp }) => {
            const c = shopCounts[mp]
            const labels: Record<string, string> = { uzum: 'Uzum', yandex_market: 'Yandex', wildberries: 'WB' }
            return (
              <div key={mp} className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-xl px-4 py-3">
                <p className="text-xs font-semibold mb-1" style={{ color: 'var(--c1)' }}>{labels[mp]}</p>
                <p className="text-lg font-bold text-[var(--text-base)]">{c?.products ?? 0} <span className="text-xs font-normal text-[var(--text-muted)]">{t.products}</span></p>
                <p className="text-xs text-[var(--text-muted)]">{c?.orders ?? 0} {t.orders}</p>
              </div>
            )
          })}
        </div>
      )}

      <div className={`grid grid-cols-1 ${cardCols} gap-4`}>
        {mpCards.map(({ shop, Component }) => (
          <Component key={shop?.id ?? Component.name} shop={shop} userId={userId} />
        ))}
      </div>
      <TelegramCard chatId={telegramChatId ?? null} username={telegramUsername ?? null} />
      <WarehousesCard />
    </div>
  )
}

// ─── Telegram link section ────────────────────────────────────────────────────

function TelegramCard({ chatId, username }: { chatId: string | null; username: string | null }) {
  const router  = useRouter()
  const { lang } = useLang()
  const t = translations[lang].dashboard.settingsPage
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
      else setMsg({ ok: false, text: data.error ?? t.error })
    } catch {
      setMsg({ ok: false, text: t.networkErr })
    }
    setLoading(false)
  }

  async function handleDisconnect() {
    setLoading(true); setMsg(null)
    try {
      const res = await fetch('/api/telegram/disconnect', { method: 'POST' })
      if (res.ok) { setLink(null); router.refresh() }
      else setMsg({ ok: false, text: t.error })
    } catch {
      setMsg({ ok: false, text: t.networkErr })
    }
    setLoading(false)
  }

  // Sends a real notification now (bypassing the schedule) so the user can
  // verify Telegram delivery and see what the digest looks like.
  async function handleSendTest() {
    setLoading(true); setMsg(null)
    try {
      const res  = await fetch('/api/telegram/test', { method: 'POST' })
      const data = await res.json().catch(() => null)
      setMsg(res.ok && data?.ok
        ? { ok: true, text: t.testSent }
        : { ok: false, text: data?.error === 'telegram_not_linked' ? t.notConnected : t.error })
    } catch {
      setMsg({ ok: false, text: t.networkErr })
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
          <p className="text-[var(--text-base)] font-semibold text-sm">{t.telegram}</p>
          <p className="text-[var(--text-muted)] text-xs">
            {connected
              ? `${t.connected}${username ? ': @' + username : ''}`
              : t.telegramSub}
          </p>
        </div>
        {connected && (
          <span className="text-[10px] font-semibold px-2 py-1 rounded-full border" style={{ background: 'var(--badge-ok-bg)', borderColor: 'var(--badge-ok-bdr)', color: 'var(--badge-ok-text)' }}>
            {t.connected} ✓
          </span>
        )}
      </div>
      <div className="p-5 space-y-3">
        {connected ? (
          <>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleSendTest}
              disabled={loading}
              className="inline-flex items-center gap-2 btn-primary text-sm font-semibold px-4 py-2.5 rounded-xl disabled:opacity-60"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {t.sendTest}
            </button>
            <button
              onClick={handleDisconnect}
              disabled={loading}
              className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl border border-[var(--border2)] text-[var(--text-muted)] hover:text-red-400 hover:border-red-500/40 transition-all disabled:opacity-60"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
              {t.telegramUnlink}
            </button>
          </div>
          </>
        ) : link ? (
          <div className="space-y-3">
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl text-white transition-all"
              style={{ background: 'linear-gradient(135deg, #29b6f6, #0288d1)' }}
            >
              <Send className="w-4 h-4" /> {t.telegramLink} →
            </a>
          </div>
        ) : (
          <button
            onClick={handleConnect}
            disabled={loading}
            className="inline-flex items-center gap-2 btn-primary text-sm font-semibold px-4 py-2.5 rounded-xl disabled:opacity-60"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LinkIcon className="w-4 h-4" />}
            {t.telegramLink}
          </button>
        )}
        <StatusMsg msg={msg} />
      </div>
    </div>
  )
}

