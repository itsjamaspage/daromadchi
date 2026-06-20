'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, CheckCircle, XCircle, Loader2, Settings } from 'lucide-react'
import Link from 'next/link'
import { useLang } from '@/app/providers'
import { dashT } from '@/lib/dashT'

interface Shop {
  id: string
  name: string
  marketplace: string
  api_key_encrypted: string | null
  last_synced_at: string | null
  productCount: number
  orderCount: number
}

const MP_CONFIG: Record<string, { label: string; color: string; letter: string; syncUrl: string; adsUrl?: string }> = {
  uzum:         { label: 'Uzum Market',    color: 'violet',  letter: 'U', syncUrl: '/api/uzum/sync' },
  yandex_market:{ label: 'Yandex Market',  color: 'amber',   letter: 'Y', syncUrl: '/api/yandex/sync' },
  wildberries:  { label: 'Wildberries',    color: 'purple',  letter: 'W', syncUrl: '/api/wildberries/sync', adsUrl: '/api/wildberries/ads-sync' },
}

const COLOR_CLASSES: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  violet: { bg: 'bg-[rgba(131,192,249,0.12)]', border: 'border-[rgba(131,192,249,0.25)]', text: 'text-[#83c0f9]', badge: 'bg-[rgba(131,192,249,0.12)] border-[rgba(131,192,249,0.25)] text-[var(--c1)]' },
  amber:  { bg: 'bg-amber-500/15',              border: 'border-amber-500/25',             text: 'text-amber-400',  badge: 'bg-amber-500/10 border-amber-500/25 text-amber-400'   },
  purple: { bg: 'bg-[rgba(131,192,249,0.12)]', border: 'border-[rgba(131,192,249,0.25)]', text: 'text-[#83c0f9]', badge: 'bg-[rgba(131,192,249,0.12)] border-[rgba(131,192,249,0.25)] text-[var(--c1)]' },
}

function ShopCard({ shop }: { shop: Shop }) {
  const router = useRouter()
  const { lang } = useLang()
  const t = dashT[lang].sync
  const st = dashT[lang].settings

  const [syncState, setSyncState]     = useState<'idle' | 'syncing' | 'ok' | 'err'>('idle')
  const [adsSyncState, setAdsSyncState] = useState<'idle' | 'syncing' | 'ok' | 'err'>('idle')
  const [syncMsg, setSyncMsg]   = useState<string | null>(null)
  const [adsSyncMsg, setAdsSyncMsg] = useState<string | null>(null)
  const [fromDays, setFromDays] = useState<number | null>(null)

  const cfg = MP_CONFIG[shop.marketplace]
  const col = COLOR_CLASSES[cfg?.color ?? 'violet']
  const LAUNCH_YEAR: Record<string, string> = {
    uzum: 'okt 2022', yandex_market: 'apr 2025', wildberries: 'fev 2022',
  }
  const hasKey = !!shop.api_key_encrypted
  const lastSync = shop.last_synced_at ? new Date(shop.last_synced_at).toLocaleString() : null

  async function handleSync() {
    if (!cfg) return
    setSyncState('syncing'); setSyncMsg(null)
    try {
      const res = await fetch(cfg.syncUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fromDays !== null ? { fromDays } : {}),
      })
      const data = await res.json()
      if (data.ok) {
        setSyncState('ok')
        const base = `${data.productsUpserted ?? 0} ${t.products}, ${data.ordersUpserted ?? 0} ${t.orders}`
        setSyncMsg(data.details ? `${base} · ${data.details}` : base)
        router.refresh()
        setTimeout(() => { setSyncState('idle'); setSyncMsg(null) }, 4000)
      } else {
        setSyncState('err')
        setSyncMsg((data.errors ?? [data.error ?? t.errorSync]).join('; '))
      }
    } catch {
      setSyncState('err'); setSyncMsg(t.errorSync)
    }
  }

  async function handleAdsSync() {
    if (!cfg?.adsUrl) return
    setAdsSyncState('syncing'); setAdsSyncMsg(null)
    try {
      const res = await fetch(cfg.adsUrl, { method: 'POST' })
      const data = await res.json()
      if (data.ok) {
        setAdsSyncState('ok')
        setAdsSyncMsg(`${data.statsUpserted ?? 0} ${st.adsSynced}`)
        setTimeout(() => { setAdsSyncState('idle'); setAdsSyncMsg(null) }, 4000)
      } else {
        setAdsSyncState('err')
        setAdsSyncMsg(data.error ?? t.errorSync)
      }
    } catch {
      setAdsSyncState('err'); setAdsSyncMsg(t.errorSync)
    }
  }

  if (!cfg) return null

  return (
    <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-[var(--border)] flex items-center gap-3">
        <div className={`w-9 h-9 rounded-xl ${col.bg} border ${col.border} flex items-center justify-center`}>
          <span className={`text-sm font-bold ${col.text}`}>{cfg.letter}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[var(--text-base)] font-semibold text-sm">{cfg.label}</p>
          <p className="text-[var(--text-muted)] text-xs">{shop.name}</p>
        </div>
        <span className={`text-[10px] font-semibold px-2 py-1 rounded-full border ${hasKey ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400' : 'bg-slate-500/10 border-[var(--border)] text-[var(--text-muted)]'}`}>
          {hasKey ? t.connected : t.notConnected}
        </span>
      </div>

      <div className="px-6 py-4 grid grid-cols-3 gap-4">
        <div>
          <p className="text-[var(--text-muted)] text-xs mb-0.5">{t.lastSync}</p>
          <p className="text-[var(--text-base)] text-sm font-medium">{lastSync ?? t.notSynced}</p>
        </div>
        <div>
          <p className="text-[var(--text-muted)] text-xs mb-0.5">{t.products}</p>
          <p className="text-[var(--text-base)] text-sm font-semibold">{shop.productCount.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-[var(--text-muted)] text-xs mb-0.5">{t.orders}</p>
          <p className="text-[var(--text-base)] text-sm font-semibold">{shop.orderCount.toLocaleString()}</p>
        </div>
      </div>

      <div className="px-6 pb-5 space-y-3 border-t border-[var(--border)] pt-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-muted)] shrink-0">{t.historyLabel}:</span>
          <select
            value={fromDays ?? ''}
            onChange={e => setFromDays(e.target.value === '' ? null : Number(e.target.value))}
            disabled={syncState === 'syncing'}
            className="flex-1 text-xs bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-base)] rounded-lg px-2 py-1.5 appearance-none cursor-pointer disabled:opacity-40"
          >
            <option value="">{t.fromLastSync}</option>
            <option value="30">{t.days30}</option>
            <option value="90">{t.days90}</option>
            <option value="180">{t.days180}</option>
            <option value="365">{t.days365}</option>
            <option value="730">{t.days730}</option>
            <option value="0">{t.daysAll} ({LAUNCH_YEAR[shop.marketplace] ?? '2022'})</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleSync}
            disabled={syncState === 'syncing' || !hasKey}
            className="flex items-center gap-2 bg-[var(--bg-input)] hover:bg-[var(--bg-input)] border border-[var(--border2)] disabled:opacity-40 disabled:cursor-not-allowed text-[var(--text-base)] text-sm font-medium px-4 py-2 rounded-xl transition-colors"
          >
            {syncState === 'syncing' ? <Loader2 className="w-4 h-4 animate-spin" /> : syncState === 'ok' ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : syncState === 'err' ? <XCircle className="w-4 h-4 text-red-400" /> : <RefreshCw className="w-4 h-4" />}
            {syncState === 'syncing' ? t.syncing : t.syncNow}
          </button>

          {cfg.adsUrl && (
            <button
              onClick={handleAdsSync}
              disabled={adsSyncState === 'syncing' || !hasKey}
              className={`flex items-center gap-2 border disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium px-4 py-2 rounded-xl transition-colors ${col.bg} ${col.border} ${col.text} hover:opacity-80`}
            >
              {adsSyncState === 'syncing' ? <Loader2 className="w-4 h-4 animate-spin" /> : adsSyncState === 'ok' ? <CheckCircle className="w-4 h-4" /> : adsSyncState === 'err' ? <XCircle className="w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
              {adsSyncState === 'syncing' ? t.adsSyncing : t.adsSync}
            </button>
          )}
        </div>

        {syncMsg && (
          <p className={`text-xs ${syncState === 'err' ? 'text-red-400' : 'text-emerald-400'}`}>{syncMsg}</p>
        )}
        {adsSyncMsg && (
          <p className={`text-xs ${adsSyncState === 'err' ? 'text-red-400' : 'text-emerald-400'}`}>{adsSyncMsg}</p>
        )}
      </div>
    </div>
  )
}

export default function SyncStatusClient({ shops }: { shops: Shop[] }) {
  const router = useRouter()
  const { lang } = useLang()
  const t = dashT[lang].sync
  const [syncingAll, setSyncingAll] = useState(false)

  async function handleSyncAll() {
    setSyncingAll(true)
    await Promise.allSettled([
      fetch('/api/uzum/sync', { method: 'POST' }),
      fetch('/api/yandex/sync', { method: 'POST' }),
      fetch('/api/wildberries/sync', { method: 'POST' }),
    ])
    router.refresh()
    setSyncingAll(false)
  }

  if (shops.length === 0) {
    return (
      <div className="bg-[var(--bg-card2)] border border-dashed rounded-2xl p-10 text-center" style={{ borderColor: 'rgba(131,192,249,0.3)' }}>
        <p className="text-[var(--text-base)] font-bold mb-2">{t.noShops}</p>
        <p className="text-[var(--text-muted)] text-sm mb-4">{t.noShopsDesc}</p>
        <Link href="/dashboard/settings"
          className="inline-flex items-center gap-2 btn-primary text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors">
          <Settings className="w-4 h-4" /> Settings
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={handleSyncAll}
          disabled={syncingAll}
          className="flex items-center gap-2 disabled:opacity-50 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors" style={{ background: '#83c0f9', color: '#131321' }}
        >
          {syncingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {syncingAll ? t.syncing : t.syncAll}
        </button>
      </div>
      {shops.map(shop => <ShopCard key={shop.id} shop={shop} />)}
    </div>
  )
}
