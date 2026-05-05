'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  RefreshCw, Save, Key, CheckCircle, XCircle, ExternalLink,
  Loader2, Hash,
} from 'lucide-react'
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

function UzumCard({ shop, userId }: { shop: Shop | null; userId: string }) {
  const router   = useRouter()
  const supabase = createClient()

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
    setSaving(true); setSaveMsg(null)
    if (shop) {
      const update: Record<string, string> = {}
      if (apiKey.trim()) update.api_key_encrypted = apiKey.trim()
      const { error } = await supabase.from('shops').update(update).eq('id', shop.id)
      setSaveMsg(error ? { ok: false, text: error.message } : { ok: true, text: 'Saqlandi!' })
    } else {
      const { error } = await supabase.from('shops').insert({
        user_id: userId, name: 'Uzum do\'konim',
        marketplace: 'uzum', is_active: true,
        ...(apiKey.trim() ? { api_key_encrypted: apiKey.trim() } : {}),
      })
      setSaveMsg(error ? { ok: false, text: error.message } : { ok: true, text: 'Do\'kon yaratildi!' })
    }
    setApiKey('')
    router.refresh()
    setSaving(false)
  }

  async function handleSync() {
    setSyncing(true); setSyncMsg(null)
    try {
      const res  = await fetch('/api/uzum/sync', { method: 'POST' })
      const data = await res.json()
      setSyncMsg(data.ok
        ? { ok: true,  text: `${data.productsUpserted ?? 0} mahsulot, ${data.ordersUpserted ?? 0} buyurtma yangilandi.` }
        : { ok: false, text: data.error ?? 'Xato' })
      if (data.ok) router.refresh()
    } catch {
      setSyncMsg({ ok: false, text: 'Server bilan bog\'lanishda xato' })
    }
    setSyncing(false)
  }

  return (
    <div className="bg-[#13131f] border border-white/[0.06] rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/[0.05] flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-violet-500/15 border border-violet-500/25 flex items-center justify-center">
          <span className="text-sm font-bold text-violet-400">U</span>
        </div>
        <div>
          <p className="text-white font-semibold text-sm">Uzum Market</p>
          <p className="text-slate-500 text-xs">seller.uzum.uz</p>
        </div>
        <span className={`ml-auto text-[10px] font-semibold px-2 py-1 rounded-full border ${hasKey ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400' : 'bg-slate-500/10 border-slate-500/20 text-slate-500'}`}>
          {hasKey ? 'Ulangan' : 'Ulanmagan'}
        </span>
      </div>

      {/* API token form */}
      <form onSubmit={handleSave} className="p-6 space-y-4">
        <div>
          <label className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-2">
            <Key className="w-3.5 h-3.5" /> API Token
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder={hasKey ? '••••••••  (yangilash uchun kiriting)' : 'Token kiriting…'}
            className="w-full bg-[#1c1c2e] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500/60 transition-all font-mono"
          />
          <p className="text-slate-500 text-xs mt-1.5 flex items-center gap-1">
            <a href="https://seller.uzum.uz" target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300 flex items-center gap-0.5">
              seller.uzum.uz <ExternalLink className="w-3 h-3" />
            </a>
            → Sozlamalar → API integratsiya
          </p>
        </div>
        <StatusMsg msg={saveMsg} />
        <button type="submit" disabled={saving}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Saqlash
        </button>
      </form>

      {/* Sync */}
      {shop && (
        <div className="px-6 pb-6 space-y-3 border-t border-white/[0.04] pt-4">
          <div className="flex items-center justify-between">
            <p className="text-slate-400 text-xs">
              {lastSync ? <>Oxirgi sinxr: <span className="text-slate-300">{lastSync}</span></> : 'Hali sinxronlanmagan'}
            </p>
          </div>
          <StatusMsg msg={syncMsg} />
          <button onClick={handleSync} disabled={syncing || !hasKey}
            title={!hasKey ? 'Avval token saqlang' : ''}
            className="flex items-center gap-2 bg-[#1c1c2e] hover:bg-white/[0.06] border border-white/[0.08] disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 text-sm font-medium px-4 py-2 rounded-xl transition-colors">
            {syncing ? <><Loader2 className="w-4 h-4 animate-spin" /> Sinxronlanmoqda…</> : <><RefreshCw className="w-4 h-4" /> Sinxronlash</>}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Yandex section ───────────────────────────────────────────────────────────

function YandexCard({ shop, userId }: { shop: Shop | null; userId: string }) {
  const router   = useRouter()
  const supabase = createClient()

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
    setSaving(true); setSaveMsg(null)
    const update: Record<string, string> = {}
    if (apiKey.trim())     update.api_key_encrypted = apiKey.trim()
    if (campaignId.trim()) update.shop_id_external  = campaignId.trim()

    if (shop) {
      const { error } = await supabase.from('shops').update(update).eq('id', shop.id)
      setSaveMsg(error ? { ok: false, text: error.message } : { ok: true, text: 'Saqlandi!' })
    } else {
      const { error } = await supabase.from('shops').insert({
        user_id: userId, name: 'Yandex Market do\'konim',
        marketplace: 'yandex_market', is_active: true,
        ...(apiKey.trim()     ? { api_key_encrypted: apiKey.trim() } : {}),
        ...(campaignId.trim() ? { shop_id_external:  campaignId.trim() } : {}),
      })
      setSaveMsg(error ? { ok: false, text: error.message } : { ok: true, text: 'Do\'kon yaratildi!' })
    }
    setApiKey('')
    router.refresh()
    setSaving(false)
  }

  async function handleSync() {
    setSyncing(true); setSyncMsg(null)
    try {
      const res  = await fetch('/api/yandex/sync', { method: 'POST' })
      const data = await res.json()
      setSyncMsg(data.ok
        ? { ok: true,  text: `${data.productsUpserted ?? 0} mahsulot, ${data.ordersUpserted ?? 0} buyurtma yangilandi.` }
        : { ok: false, text: data.error ?? 'Xato' })
      if (data.ok) router.refresh()
    } catch {
      setSyncMsg({ ok: false, text: 'Server bilan bog\'lanishda xato' })
    }
    setSyncing(false)
  }

  const connected = hasKey && hasCampaign

  return (
    <div className="bg-[#13131f] border border-white/[0.06] rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/[0.05] flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
          <span className="text-sm font-bold text-amber-400">Y</span>
        </div>
        <div>
          <p className="text-white font-semibold text-sm">Yandex Market</p>
          <p className="text-slate-500 text-xs">partner.market.yandex.ru</p>
        </div>
        <span className={`ml-auto text-[10px] font-semibold px-2 py-1 rounded-full border ${connected ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400' : 'bg-slate-500/10 border-slate-500/20 text-slate-500'}`}>
          {connected ? 'Ulangan' : 'Ulanmagan'}
        </span>
      </div>

      {/* Form */}
      <form onSubmit={handleSave} className="p-6 space-y-4">
        <div>
          <label className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-2">
            <Key className="w-3.5 h-3.5" /> OAuth Token
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder={hasKey ? '••••••••  (yangilash uchun kiriting)' : 'OAuth token kiriting…'}
            className="w-full bg-[#1c1c2e] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/40 transition-all font-mono"
          />
        </div>

        <div>
          <label className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mb-2">
            <Hash className="w-3.5 h-3.5" /> Campaign ID
          </label>
          <input
            type="text"
            value={campaignId}
            onChange={e => setCampaignId(e.target.value)}
            placeholder={hasCampaign ? shop!.shop_id_external! : 'Campaign ID (masalan: 12345678)'}
            className="w-full bg-[#1c1c2e] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/40 transition-all font-mono"
          />
          <p className="text-slate-500 text-xs mt-1.5 flex items-center gap-1">
            <a href="https://partner.market.yandex.ru" target="_blank" rel="noopener noreferrer"
              className="text-amber-400 hover:text-amber-300 flex items-center gap-0.5">
              partner.market.yandex.ru <ExternalLink className="w-3 h-3" />
            </a>
            → API → OAuth token va Campaign ID
          </p>
        </div>

        <StatusMsg msg={saveMsg} />
        <button type="submit" disabled={saving}
          className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Saqlash
        </button>
      </form>

      {/* Sync */}
      {shop && (
        <div className="px-6 pb-6 space-y-3 border-t border-white/[0.04] pt-4">
          <p className="text-slate-400 text-xs">
            {lastSync ? <>Oxirgi sinxr: <span className="text-slate-300">{lastSync}</span></> : 'Hali sinxronlanmagan'}
          </p>
          <StatusMsg msg={syncMsg} />
          <button onClick={handleSync} disabled={syncing || !connected}
            title={!connected ? 'Avval token va Campaign ID saqlang' : ''}
            className="flex items-center gap-2 bg-[#1c1c2e] hover:bg-white/[0.06] border border-white/[0.08] disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 text-sm font-medium px-4 py-2 rounded-xl transition-colors">
            {syncing ? <><Loader2 className="w-4 h-4 animate-spin" /> Sinxronlanmoqda…</> : <><RefreshCw className="w-4 h-4" /> Sinxronlash</>}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

interface Props {
  uzumShop:   Shop | null
  yandexShop: Shop | null
  userId:     string
}

export default function SettingsForm({ uzumShop, yandexShop, userId }: Props) {
  return (
    <div className="space-y-4">
      <UzumCard   shop={uzumShop}   userId={userId} />
      <YandexCard shop={yandexShop} userId={userId} />
    </div>
  )
}
