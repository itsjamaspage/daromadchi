'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { RefreshCw, Save, Key, Store, CheckCircle, XCircle, ExternalLink, Loader2 } from 'lucide-react'

interface Props {
  storeName: string
  hasToken: boolean
  lastSyncedAt: string | null
}

export default function SettingsForm({ storeName, hasToken, lastSyncedAt }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [name, setName]         = useState(storeName)
  const [token, setToken]       = useState('')
  const [saving, setSaving]     = useState(false)
  const [syncing, setSyncing]   = useState(false)
  const [saveMsg, setSaveMsg]   = useState<{ ok: boolean; text: string } | null>(null)
  const [syncResult, setSyncResult] = useState<{ ok: boolean; text: string } | null>(null)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaveMsg(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaveMsg({ ok: false, text: 'Autentifikatsiya xatosi' }); setSaving(false); return }

    const update: Record<string, string> = { store_name: name }
    if (token.trim()) update.uzum_api_token = token.trim()

    const { error } = await supabase.from('profiles').update(update).eq('id', user.id)

    if (error) {
      setSaveMsg({ ok: false, text: error.message })
    } else {
      setSaveMsg({ ok: true, text: 'Saqlandi!' })
      setToken('')
      router.refresh()
    }
    setSaving(false)
  }

  async function handleSync() {
    setSyncing(true)
    setSyncResult(null)

    try {
      const res = await fetch('/api/uzum/sync', { method: 'POST' })
      const data = await res.json()

      if (data.ok) {
        setSyncResult({
          ok: true,
          text: `Muvaffaqiyatli! ${data.productsUpserted} mahsulot, ${data.ordersUpserted} buyurtma yangilandi.`,
        })
        router.refresh()
      } else {
        setSyncResult({ ok: false, text: data.error ?? 'Noma\'lum xato' })
      }
    } catch {
      setSyncResult({ ok: false, text: 'Server bilan bog\'lanishda xato' })
    }

    setSyncing(false)
  }

  const lastSync = lastSyncedAt
    ? new Date(lastSyncedAt).toLocaleString('uz-UZ')
    : null

  return (
    <div className="space-y-5">
      {/* Store info */}
      <form onSubmit={handleSave} className="bg-[#13131f] border border-white/[0.06] rounded-2xl p-6 space-y-5">
        <h2 className="text-white font-semibold flex items-center gap-2">
          <Store className="w-4 h-4 text-violet-400" />
          Do&apos;kon ma&apos;lumotlari
        </h2>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-2">Do&apos;kon nomi</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Mening do'konim"
            className="w-full bg-[#1c1c2e] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30 transition-all"
          />
        </div>

        {/* Uzum API token */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-2 flex items-center gap-1.5">
            <Key className="w-3.5 h-3.5" />
            Uzum Seller API Token
          </label>
          <input
            type="password"
            value={token}
            onChange={e => setToken(e.target.value)}
            placeholder={hasToken ? '••••••••  (o\'zgartirish uchun yangi token kiriting)' : 'Token kiriting...'}
            className="w-full bg-[#1c1c2e] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30 transition-all font-mono"
          />
          <p className="text-slate-500 text-xs mt-2 flex items-center gap-1">
            Tokenni
            <a
              href="https://seller.uzum.uz"
              target="_blank"
              rel="noopener noreferrer"
              className="text-violet-400 hover:text-violet-300 inline-flex items-center gap-0.5"
            >
              seller.uzum.uz
              <ExternalLink className="w-3 h-3" />
            </a>
            dan oling: Sozlamalar → API integratsiya
          </p>
        </div>

        {saveMsg && (
          <div className={`flex items-center gap-2 text-sm px-4 py-2.5 rounded-xl ${
            saveMsg.ok ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
          }`}>
            {saveMsg.ok ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            {saveMsg.text}
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors shadow-lg shadow-violet-500/20"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Saqlash
        </button>
      </form>

      {/* Sync panel */}
      <div className="bg-[#13131f] border border-white/[0.06] rounded-2xl p-6 space-y-4">
        <h2 className="text-white font-semibold flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-violet-400" />
          Uzum Market sinxronizatsiya
        </h2>

        <p className="text-slate-400 text-sm">
          Uzum Market do&apos;koningizdan buyurtmalar va mahsulotlarni Daromadchi ga import qiladi.
          So&apos;nggi 90 kunlik ma&apos;lumotlar yangilanadi.
        </p>

        {lastSync && (
          <p className="text-slate-500 text-xs">
            Oxirgi sinxronizatsiya: <span className="text-slate-400">{lastSync}</span>
          </p>
        )}

        {syncResult && (
          <div className={`flex items-start gap-2 text-sm px-4 py-3 rounded-xl ${
            syncResult.ok ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
          }`}>
            {syncResult.ok ? <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /> : <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
            {syncResult.text}
          </div>
        )}

        <button
          onClick={handleSync}
          disabled={syncing || !hasToken}
          title={!hasToken ? 'Avval Uzum API tokenini saqlang' : ''}
          className="flex items-center gap-2 bg-[#1c1c2e] hover:bg-white/[0.06] border border-white/[0.08] disabled:opacity-40 disabled:cursor-not-allowed text-slate-200 text-sm font-medium px-5 py-2.5 rounded-xl transition-colors"
        >
          {syncing
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Sinxronlanmoqda...</>
            : <><RefreshCw className="w-4 h-4" /> Hozir sinxronlash</>
          }
        </button>

        {!hasToken && (
          <p className="text-amber-400/70 text-xs">Sinxronlash uchun avval Uzum API tokenini kiriting va saqlang.</p>
        )}
      </div>
    </div>
  )
}
