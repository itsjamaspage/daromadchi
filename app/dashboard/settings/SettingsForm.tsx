'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  RefreshCw, Save, Key, CheckCircle, XCircle, ExternalLink,
  Loader2, Hash, Copy, Puzzle, Lock, Eye, EyeOff, X,
} from 'lucide-react'
import type { Shop } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import { useLang } from '@/app/providers'
import { dashT } from '@/lib/dashT'

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

function UzumCard({ shop, userId }: { shop: Shop | null; userId: string }) {
  const router = useRouter()
  const { lang } = useLang()
  const t = dashT[lang].settings
  void userId

  const [apiKey,  setApiKey]  = useState('')
  const [saving,  setSaving]  = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [syncMsg, setSyncMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const hasKey  = !!shop?.api_key_encrypted
  const lastSync = shop?.last_synced_at
    ? new Date(shop.last_synced_at).toLocaleString('uz-UZ') : null

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!apiKey.trim()) return
    setSaving(true); setSaveMsg(null)
    try {
      const res  = await fetch('/api/settings/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketplace: 'uzum', apiKey: apiKey.trim() }),
      })
      const data = await res.json()
      setSaveMsg(data.ok
        ? { ok: true,  text: data.created ? t.shopCreated : t.saved }
        : { ok: false, text: data.error ?? t.err })
      if (data.ok) { setApiKey(''); router.refresh() }
    } catch {
      setSaveMsg({ ok: false, text: t.serverErr })
    }
    setSaving(false)
  }

  async function handleSync() {
    setSyncing(true); setSyncMsg(null)
    try {
      const res  = await fetch('/api/uzum/sync', { method: 'POST' })
      const data = await res.json()
      setSyncMsg(data.ok
        ? { ok: true,  text: `${data.productsUpserted ?? 0} ${t.syncResult1} ${data.ordersUpserted ?? 0} ${t.syncResult2}` }
        : { ok: false, text: data.error ?? t.err })
      if (data.ok) router.refresh()
    } catch {
      setSyncMsg({ ok: false, text: t.serverErr })
    }
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
          <p className="text-white font-semibold text-sm">Uzum Market</p>
          <p className="text-slate-500 text-xs">seller.uzum.uz</p>
        </div>
        <span className={`ml-auto text-[10px] font-semibold px-2 py-1 rounded-full border ${hasKey ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400' : 'bg-slate-500/10 border-slate-500/20 text-slate-500'}`}>
          {hasKey ? t.connected : t.notConnected}
        </span>
      </div>

      {/* API token form */}
      <form onSubmit={handleSave} className="p-6 space-y-4">
        <div>
          <label className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-2">
            <Key className="w-3.5 h-3.5" /> {t.apiToken}
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder={hasKey ? t.tokenPlaceholderHas : t.tokenPlaceholder}
            className="w-full bg-[var(--bg-input)] border border-[var(--border2)] rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500/60 transition-all font-mono"
          />
          <p className="text-slate-500 text-xs mt-1.5 flex items-center gap-1">
            <a href="https://seller.uzum.uz" target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300 flex items-center gap-0.5">
              seller.uzum.uz <ExternalLink className="w-3 h-3" />
            </a>
            → {t.uzumHint1} → {t.uzumHint2}
          </p>
        </div>
        <StatusMsg msg={saveMsg} />
        <button type="submit" disabled={saving}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {t.save}
        </button>
      </form>

      {/* Sync */}
      {shop && (
        <div className="px-6 pb-6 space-y-3 border-t border-[var(--border)] pt-4">
          <div className="flex items-center justify-between">
            <p className="text-slate-400 text-xs">
              {lastSync ? <>{t.lastSyncPre} <span className="text-slate-300">{lastSync}</span></> : t.notSynced}
            </p>
          </div>
          <StatusMsg msg={syncMsg} />
          <button onClick={handleSync} disabled={syncing || !hasKey}
            title={!hasKey ? t.saveTokenFirst : ''}
            className="flex items-center gap-2 bg-[var(--bg-input)] hover:bg-white/[0.06] border border-[var(--border2)] disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 text-sm font-medium px-4 py-2 rounded-xl transition-colors">
            {syncing ? <><Loader2 className="w-4 h-4 animate-spin" /> {t.syncing}</> : <><RefreshCw className="w-4 h-4" /> {t.sync}</>}
          </button>
          <div className="text-xs text-slate-500 bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3 py-2.5 flex items-center gap-2">
            <span className="text-slate-600">⊙</span>
            {t.uzumAdsComing}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Yandex section ───────────────────────────────────────────────────────────

function YandexCard({ shop, userId }: { shop: Shop | null; userId: string }) {
  const router = useRouter()
  const { lang } = useLang()
  const t = dashT[lang].settings
  void userId

  const [apiKey,      setApiKey]      = useState('')
  const [campaignId,  setCampaignId]  = useState(shop?.shop_id_external ?? '')
  const [saving,      setSaving]      = useState(false)
  const [syncing,     setSyncing]     = useState(false)
  const [saveMsg,     setSaveMsg]     = useState<{ ok: boolean; text: string } | null>(null)
  const [syncMsg,     setSyncMsg]     = useState<{ ok: boolean; text: string } | null>(null)

  const hasKey      = !!shop?.api_key_encrypted
  const hasCampaign = !!shop?.shop_id_external
  const lastSync    = shop?.last_synced_at
    ? new Date(shop.last_synced_at).toLocaleString('uz-UZ') : null

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!apiKey.trim() && !campaignId.trim()) return
    setSaving(true); setSaveMsg(null)
    try {
      const res  = await fetch('/api/settings/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marketplace:    'yandex_market',
          apiKey:         apiKey.trim()      || undefined,
          shopIdExternal: campaignId.trim()  || undefined,
        }),
      })
      const data = await res.json()
      setSaveMsg(data.ok
        ? { ok: true,  text: data.created ? t.shopCreated : t.saved }
        : { ok: false, text: data.error ?? t.err })
      if (data.ok) { setApiKey(''); router.refresh() }
    } catch {
      setSaveMsg({ ok: false, text: t.serverErr })
    }
    setSaving(false)
  }

  async function handleSync() {
    setSyncing(true); setSyncMsg(null)
    try {
      const res  = await fetch('/api/yandex/sync', { method: 'POST' })
      const data = await res.json()
      setSyncMsg(data.ok
        ? { ok: true,  text: `${data.productsUpserted ?? 0} ${t.syncResult1} ${data.ordersUpserted ?? 0} ${t.syncResult2}` }
        : { ok: false, text: data.error ?? t.err })
      if (data.ok) router.refresh()
    } catch {
      setSyncMsg({ ok: false, text: t.serverErr })
    }
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
          <p className="text-white font-semibold text-sm">Yandex Market</p>
          <p className="text-slate-500 text-xs">partner.market.yandex.ru</p>
        </div>
        <span className={`ml-auto text-[10px] font-semibold px-2 py-1 rounded-full border ${connected ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400' : 'bg-slate-500/10 border-slate-500/20 text-slate-500'}`}>
          {connected ? t.connected : t.notConnected}
        </span>
      </div>

      {/* Form */}
      <form onSubmit={handleSave} className="p-6 space-y-4">
        <div>
          <label className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-2">
            <Key className="w-3.5 h-3.5" /> {t.oauthToken}
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder={hasKey ? t.tokenPlaceholderHas : t.oauthPlaceholder}
            className="w-full bg-[var(--bg-input)] border border-[var(--border2)] rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/40 transition-all font-mono"
          />
        </div>

        <div>
          <label className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-2">
            <Hash className="w-3.5 h-3.5" /> {t.campaignId}
          </label>
          <input
            type="text"
            value={campaignId}
            onChange={e => setCampaignId(e.target.value)}
            placeholder={hasCampaign ? shop!.shop_id_external! : t.campaignPlaceholder}
            className="w-full bg-[var(--bg-input)] border border-[var(--border2)] rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/40 transition-all font-mono"
          />
          <p className="text-slate-500 text-xs mt-1.5 flex items-center gap-1">
            <a href="https://partner.market.yandex.ru" target="_blank" rel="noopener noreferrer"
              className="text-amber-400 hover:text-amber-300 flex items-center gap-0.5">
              partner.market.yandex.ru <ExternalLink className="w-3 h-3" />
            </a>
            → API → {t.yandexHint}
          </p>
        </div>

        <StatusMsg msg={saveMsg} />
        <button type="submit" disabled={saving}
          className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {t.save}
        </button>
      </form>

      {/* Sync */}
      {shop && (
        <div className="px-6 pb-6 space-y-3 border-t border-[var(--border)] pt-4">
          <p className="text-slate-400 text-xs">
            {lastSync ? <>{t.lastSyncPre} <span className="text-slate-300">{lastSync}</span></> : t.notSynced}
          </p>
          <StatusMsg msg={syncMsg} />
          <button onClick={handleSync} disabled={syncing || !connected}
            title={!connected ? t.saveTokenCampaignFirst : ''}
            className="flex items-center gap-2 bg-[var(--bg-input)] hover:bg-white/[0.06] border border-[var(--border2)] disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 text-sm font-medium px-4 py-2 rounded-xl transition-colors">
            {syncing ? <><Loader2 className="w-4 h-4 animate-spin" /> {t.syncing}</> : <><RefreshCw className="w-4 h-4" /> {t.sync}</>}
          </button>
          <div className="text-xs text-slate-500 bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3 py-2.5 flex items-center gap-2">
            <span className="text-slate-600">⊙</span>
            {t.yandexAdsComing}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Wildberries section ─────────────────────────────────────────────────────

function WildberriesCard({ shop, userId }: { shop: Shop | null; userId: string }) {
  const router = useRouter()
  const { lang } = useLang()
  const t = dashT[lang].settings
  void userId

  const [apiKey,    setApiKey]    = useState('')
  const [saving,    setSaving]    = useState(false)
  const [syncing,   setSyncing]   = useState(false)
  const [syncingAds, setSyncingAds] = useState(false)
  const [saveMsg,   setSaveMsg]   = useState<{ ok: boolean; text: string } | null>(null)
  const [syncMsg,   setSyncMsg]   = useState<{ ok: boolean; text: string } | null>(null)
  const [adsMsg,    setAdsMsg]    = useState<{ ok: boolean; text: string } | null>(null)

  const hasKey  = !!shop?.api_key_encrypted
  const lastSync = shop?.last_synced_at
    ? new Date(shop.last_synced_at).toLocaleString('uz-UZ') : null

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!apiKey.trim()) return
    setSaving(true); setSaveMsg(null)
    try {
      const res  = await fetch('/api/settings/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketplace: 'wildberries', apiKey: apiKey.trim() }),
      })
      const data = await res.json()
      setSaveMsg(data.ok
        ? { ok: true,  text: data.created ? t.shopCreated : t.saved }
        : { ok: false, text: data.error ?? t.err })
      if (data.ok) { setApiKey(''); router.refresh() }
    } catch {
      setSaveMsg({ ok: false, text: t.serverErr })
    }
    setSaving(false)
  }

  async function handleSync() {
    setSyncing(true); setSyncMsg(null)
    try {
      const res  = await fetch('/api/wildberries/sync', { method: 'POST' })
      const data = await res.json()
      setSyncMsg(data.ok
        ? { ok: true,  text: `${data.productsUpserted ?? 0} ${t.syncResult1} ${data.ordersUpserted ?? 0} ${t.syncResult2}` }
        : { ok: false, text: (data.errors ?? [data.error ?? t.err]).join('; ') })
      if (data.ok) router.refresh()
    } catch {
      setSyncMsg({ ok: false, text: t.serverErr })
    }
    setSyncing(false)
  }

  async function handleAdsSync() {
    setSyncingAds(true); setAdsMsg(null)
    try {
      const res  = await fetch('/api/wildberries/ads-sync', { method: 'POST' })
      const data = await res.json()
      setAdsMsg(data.ok
        ? { ok: true,  text: `${data.statsUpserted ?? 0} ${t.adsSynced}` }
        : { ok: false, text: data.error ?? t.err })
    } catch {
      setAdsMsg({ ok: false, text: t.serverErr })
    }
    setSyncingAds(false)
  }

  return (
    <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[var(--border)] flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-purple-500/15 border border-purple-500/25 flex items-center justify-center">
          <span className="text-sm font-bold text-purple-400">W</span>
        </div>
        <div>
          <p className="text-white font-semibold text-sm">Wildberries</p>
          <p className="text-slate-500 text-xs">seller.wildberries.ru</p>
        </div>
        <span className={`ml-auto text-[10px] font-semibold px-2 py-1 rounded-full border ${hasKey ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400' : 'bg-slate-500/10 border-slate-500/20 text-slate-500'}`}>
          {hasKey ? t.connected : t.notConnected}
        </span>
      </div>

      {/* API token form */}
      <form onSubmit={handleSave} className="p-6 space-y-4">
        <div>
          <label className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-2">
            <Key className="w-3.5 h-3.5" /> {t.apiToken}
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder={hasKey ? t.tokenPlaceholderHas : t.tokenPlaceholder}
            className="w-full bg-[var(--bg-input)] border border-[var(--border2)] rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-purple-500/60 transition-all font-mono"
          />
          <p className="text-slate-500 text-xs mt-1.5">{t.wbHint}</p>
        </div>
        <StatusMsg msg={saveMsg} />
        <button type="submit" disabled={saving}
          className="flex items-center gap-2 bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {t.save}
        </button>
      </form>

      {/* Sync */}
      {shop && (
        <div className="px-6 pb-6 space-y-3 border-t border-[var(--border)] pt-4">
          <p className="text-slate-400 text-xs">
            {lastSync ? <>{t.lastSyncPre} <span className="text-slate-300">{lastSync}</span></> : t.notSynced}
          </p>
          <div className="flex gap-2 flex-wrap">
            <button onClick={handleSync} disabled={syncing || !hasKey}
              title={!hasKey ? t.saveTokenFirst : ''}
              className="flex items-center gap-2 bg-[var(--bg-input)] hover:bg-white/[0.06] border border-[var(--border2)] disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 text-sm font-medium px-4 py-2 rounded-xl transition-colors">
              {syncing ? <><Loader2 className="w-4 h-4 animate-spin" /> {t.syncing}</> : <><RefreshCw className="w-4 h-4" /> {t.sync}</>}
            </button>
            <button onClick={handleAdsSync} disabled={syncingAds || !hasKey}
              title={!hasKey ? t.saveTokenFirst : ''}
              className="flex items-center gap-2 bg-purple-900/40 hover:bg-purple-800/40 border border-purple-700/30 disabled:opacity-40 disabled:cursor-not-allowed text-purple-300 text-sm font-medium px-4 py-2 rounded-xl transition-colors">
              {syncingAds ? <><Loader2 className="w-4 h-4 animate-spin" /> {t.syncingAds}</> : <><RefreshCw className="w-4 h-4" /> {t.syncAds}</>}
            </button>
          </div>
          <StatusMsg msg={syncMsg} />
          <StatusMsg msg={adsMsg} />
        </div>
      )}
    </div>
  )
}

// ─── Extension token section ──────────────────────────────────────────────────

function ExtensionTokenCard() {
  const supabase = createClient()
  const { lang } = useLang()
  const t = dashT[lang].settings
  const [token,    setToken]    = useState<string | null>(null)
  const [copied,   setCopied]   = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setToken(data.session?.access_token ?? null)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleRefresh() {
    setRefreshing(true)
    const { data } = await supabase.auth.refreshSession()
    setToken(data.session?.access_token ?? null)
    setRefreshing(false)
  }

  async function handleCopy() {
    if (!token) return
    await navigator.clipboard.writeText(token)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const masked = token ? token.slice(0, 20) + '…' : '—'

  return (
    <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[var(--border)] flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center">
          <Puzzle className="w-4 h-4 text-indigo-400" />
        </div>
        <div>
          <p className="text-white font-semibold text-sm">{t.extToken}</p>
          <p className="text-slate-500 text-xs">{t.extTokenSub}</p>
        </div>
      </div>

      <div className="p-6 space-y-4">
        {/* Masked token display */}
        <div>
          <label className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-2">
            <Key className="w-3.5 h-3.5" /> {t.currentToken}
          </label>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-[var(--bg-input)] border border-[var(--border2)] rounded-xl px-4 py-2.5 text-sm text-slate-300 font-mono truncate">
              {masked}
            </code>
            <button
              onClick={handleCopy}
              disabled={!token}
              title={t.copyTitle}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all shrink-0 ${
                copied
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                  : 'bg-[var(--bg-input)] border-[var(--border2)] text-slate-300 hover:border-indigo-500/40 hover:text-indigo-300 disabled:opacity-40 disabled:cursor-not-allowed'
              }`}
            >
              {copied
                ? <><CheckCircle className="w-4 h-4" /> {t.copied}</>
                : <><Copy className="w-4 h-4" /> {t.copy}</>
              }
            </button>
          </div>
        </div>

        {/* Instructions */}
        <p className="text-slate-500 text-xs leading-relaxed bg-[var(--bg-input)] rounded-xl px-4 py-3 border border-[var(--border)]">
          {t.extInstrPre} <span className="text-slate-300">{t.extInstrStrong}</span> {t.extInstrPost}
        </p>

        {/* Refresh button */}
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 bg-[var(--bg-input)] hover:bg-white/[0.06] border border-[var(--border2)] disabled:opacity-50 text-slate-200 text-sm font-medium px-4 py-2 rounded-xl transition-colors"
        >
          {refreshing
            ? <><Loader2 className="w-4 h-4 animate-spin" /> {t.refreshing}</>
            : <><RefreshCw className="w-4 h-4" /> {t.refresh}</>
          }
        </button>
      </div>
    </div>
  )
}

// ─── Password update modal ────────────────────────────────────────────────────

function PasswordUpdateModal({ onClose }: { onClose: () => void }) {
  const supabase = createClient()
  const { lang } = useLang()
  const t = dashT[lang].settings
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [success,  setSuccess]  = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError(t.pwMin6); return }
    if (password !== confirm) { setError(t.pwMismatch); return }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) { setError(error.message); setLoading(false) }
    else { setSuccess(true); setTimeout(onClose, 2000) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-sm bg-[var(--bg-card)] border border-[var(--border2)] rounded-2xl p-6 shadow-2xl relative">
        <button onClick={onClose}
          className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors">
          <X className="w-4 h-4" />
        </button>

        {success ? (
          <div className="text-center py-4 space-y-3">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <CheckCircle className="w-6 h-6 text-emerald-400" />
            </div>
            <p className="text-white font-semibold">{t.pwChanged}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <h2 className="text-white font-bold text-base mb-1">{t.pwSetNew}</h2>
              <p className="text-slate-500 text-xs">{t.pwSetNewDesc}</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2">{t.pwNew}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input type={showPw ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)} required minLength={6}
                  placeholder="••••••••"
                  className="w-full bg-[var(--bg-input)] border border-[var(--border2)] rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500/40 transition-all"
                />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2">{t.pwConfirm}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input type={showPw ? 'text' : 'password'} value={confirm}
                  onChange={e => setConfirm(e.target.value)} required minLength={6}
                  placeholder="••••••••"
                  className="w-full bg-[var(--bg-input)] border border-[var(--border2)] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500/40 transition-all"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5 text-sm text-red-400">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold text-sm py-2.5 rounded-xl transition-colors">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" />{t.pwSaving}</> : t.pwSave}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

interface Props {
  uzumShop:        Shop | null
  yandexShop:      Shop | null
  wildberriesShop: Shop | null
  userId:          string
}

export default function SettingsForm({ uzumShop, yandexShop, wildberriesShop, userId }: Props) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [showPasswordModal, setShowPasswordModal] = useState(false)

  useEffect(() => {
    if (searchParams.get('reset') === '1') {
      setShowPasswordModal(true)
      router.replace('/dashboard/settings')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      {showPasswordModal && <PasswordUpdateModal onClose={() => setShowPasswordModal(false)} />}
      <div className="space-y-4">
        <UzumCard          shop={uzumShop}        userId={userId} />
        <YandexCard        shop={yandexShop}       userId={userId} />
        <WildberriesCard   shop={wildberriesShop}  userId={userId} />
        <ExtensionTokenCard />
      </div>
    </>
  )
}
