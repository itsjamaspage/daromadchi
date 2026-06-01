'use client'

import { useState } from 'react'
import { Monitor, Smartphone, Globe, Eye, EyeOff, RefreshCw, LogOut, ToggleLeft, ToggleRight, ExternalLink, AlertTriangle } from 'lucide-react'

const MOCK_DEVICES = [
  {
    id: 1,
    name: 'MacBook Pro',
    browser: 'Chrome 124',
    lastActive: 'Hozir aktiv',
    status: 'active' as const,
    icon: Monitor,
    unsupported: false,
  },
  {
    id: 2,
    name: 'Windows PC',
    browser: 'Chrome 122',
    lastActive: '2 kun oldin',
    status: 'inactive' as const,
    icon: Monitor,
    unsupported: false,
  },
  {
    id: 3,
    name: 'iPhone (Safari)',
    browser: 'Safari 17',
    lastActive: '1 hafta oldin',
    status: 'inactive' as const,
    icon: Smartphone,
    unsupported: true,
  },
]

type ToggleKey = 'widget' | 'drr' | 'competitor'

const EXTENSION_SETTINGS: { key: ToggleKey; label: string; desc: string }[] = [
  { key: 'widget',     label: 'Widget avtomatik ko\'rsatish',        desc: 'Mahsulot sahifalarida Daromadchi widget\'ini avtomatik ko\'rsatish' },
  { key: 'drr',        label: 'Mahsulot sahifasida DRR ko\'rsatish', desc: 'Har bir mahsulot uchun DRR (reklama xarajati ulushi) ko\'rsatish'   },
  { key: 'competitor', label: 'Raqobatchi narxlarini ko\'rsatish',   desc: 'Boshqa sotuvchilarning narxlarini taqqoslash uchun ko\'rsatish'      },
]

export default function DevicesPage() {
  const [tokenVisible, setTokenVisible] = useState(false)
  const [token, setToken] = useState('drm_••••••••••••xyz')
  const [realToken] = useState('drm_s8kL2pQ9mNxR7vT3')
  const [refreshing, setRefreshing] = useState(false)
  const [settings, setSettings] = useState<Record<ToggleKey, boolean>>({
    widget: true,
    drr: true,
    competitor: false,
  })
  const [devices, setDevices] = useState(MOCK_DEVICES)

  function handleReveal() {
    if (tokenVisible) {
      setToken('drm_••••••••••••xyz')
      setTokenVisible(false)
    } else {
      setToken(realToken)
      setTokenVisible(true)
    }
  }

  function handleRefreshToken() {
    setRefreshing(true)
    setTokenVisible(false)
    setTimeout(() => {
      setToken('drm_••••••••••••xyz')
      setRefreshing(false)
    }, 1200)
  }

  function handleRemoveDevice(id: number) {
    setDevices(prev => prev.filter(d => d.id !== id))
  }

  function handleLogoutAll() {
    setDevices([])
  }

  function toggleSetting(key: ToggleKey) {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Monitor className="w-6 h-6 text-violet-400" />
          Qurilmalar boshqaruvi
        </h1>
        <p className="text-slate-400 text-sm mt-0.5">Chrome kengaytmasi ulangan qurilmalar</p>
      </div>

      {/* Chrome Web Store banner */}
      <div className="flex items-center gap-4 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-2xl px-5 py-4">
        <Globe className="w-8 h-8 text-cyan-400 shrink-0" />
        <div className="flex-1">
          <p className="text-white font-semibold text-sm">Chrome kengaytmasini o&apos;rnating</p>
          <p className="text-slate-400 text-xs mt-0.5">Chrome kengaytmasini o&apos;rnatish uchun Chrome Web Store&apos;ga o&apos;ting</p>
        </div>
        <a
          href="https://chrome.google.com/webstore"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 text-cyan-300 text-xs font-semibold px-3 py-2 rounded-xl transition-all shrink-0"
        >
          Chrome Web Store <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* Connected devices table */}
      <div className="bg-[#13131f] border border-white/[0.06] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.05] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Monitor className="w-4 h-4 text-violet-400" />
            <h2 className="text-white font-semibold text-sm">Ulangan qurilmalar</h2>
            <span className="text-xs text-slate-500 bg-white/[0.04] px-2 py-0.5 rounded-full border border-white/[0.06]">
              {devices.length} ta
            </span>
          </div>
        </div>

        {devices.length === 0 ? (
          <div className="py-10 text-center text-slate-500 text-sm">
            Hech qanday qurilma ulanmagan
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-500 text-xs border-b border-white/[0.05] bg-white/[0.01]">
                  <th className="text-left font-medium px-5 py-3">#</th>
                  <th className="text-left font-medium px-4 py-3">Qurilma</th>
                  <th className="text-left font-medium px-4 py-3">Brauzer</th>
                  <th className="text-left font-medium px-4 py-3">Oxirgi faollik</th>
                  <th className="text-left font-medium px-4 py-3">Holat</th>
                  <th className="text-right font-medium px-4 py-3">Amal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {devices.map((device, idx) => {
                  const Icon = device.icon
                  return (
                    <tr key={device.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-3.5 text-slate-500 text-xs">{idx + 1}</td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4 text-slate-400 shrink-0" />
                          <div>
                            <p className="text-white font-medium text-xs">{device.name}</p>
                            {device.unsupported && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded mt-0.5">
                                <AlertTriangle className="w-2.5 h-2.5" />
                                Qo&apos;llab-quvvatlanmaydi
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-slate-400 text-xs">{device.browser}</td>
                      <td className="px-4 py-3.5 text-slate-400 text-xs">{device.lastActive}</td>
                      <td className="px-4 py-3.5">
                        {device.status === 'active' ? (
                          <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Aktiv
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-xs text-slate-500">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                            Nofaol
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          onClick={() => handleRemoveDevice(device.id)}
                          className="text-xs text-red-400/70 hover:text-red-400 border border-red-500/20 hover:border-red-500/40 px-2.5 py-1 rounded-lg transition-all"
                        >
                          O&apos;chirish
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {devices.length > 0 && (
          <div className="px-5 py-3 border-t border-white/[0.04]">
            <button
              onClick={handleLogoutAll}
              className="flex items-center gap-2 text-xs text-red-400 border border-red-500/30 hover:border-red-500/60 hover:bg-red-500/[0.06] px-3 py-2 rounded-xl transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
              Barchadan chiqish
            </button>
          </div>
        )}
      </div>

      {/* API Token */}
      <div className="bg-[#13131f] border border-white/[0.06] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.05] flex items-center gap-2">
          <Globe className="w-4 h-4 text-violet-400" />
          <h2 className="text-white font-semibold text-sm">API Token (Kengaytma uchun)</h2>
        </div>
        <div className="p-5 space-y-3">
          <div className="flex items-center gap-3">
            <code className="flex-1 bg-[#0d0d1a] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-cyan-300 font-mono tracking-wide">
              {token}
            </code>
            <button
              onClick={handleReveal}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white border border-white/[0.08] hover:border-white/[0.15] px-3 py-3 rounded-xl transition-all"
              title={tokenVisible ? "Yashirish" : "Ko'rsatish"}
            >
              {tokenVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {tokenVisible ? 'Yashirish' : "Ko'rsatish"}
            </button>
            <button
              onClick={handleRefreshToken}
              disabled={refreshing}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white border border-white/[0.08] hover:border-white/[0.15] px-3 py-3 rounded-xl transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Yangilash
            </button>
          </div>
          <div className="flex items-start gap-2 bg-amber-500/[0.07] border border-amber-500/20 rounded-xl px-4 py-3">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-amber-400/80 text-xs">
              <strong className="text-amber-300">Ogohlantirish:</strong> Token yangilansa eski qurilmalarda kengaytma uziladi
            </p>
          </div>
        </div>
      </div>

      {/* Extension settings */}
      <div className="bg-[#13131f] border border-white/[0.06] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.05] flex items-center gap-2">
          <Monitor className="w-4 h-4 text-violet-400" />
          <h2 className="text-white font-semibold text-sm">Kengaytma sozlamalari</h2>
        </div>
        <div className="divide-y divide-white/[0.03]">
          {EXTENSION_SETTINGS.map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-white/[0.02] transition-colors">
              <div>
                <p className="text-white text-sm font-medium">{label}</p>
                <p className="text-slate-500 text-xs mt-0.5">{desc}</p>
              </div>
              <button
                onClick={() => toggleSetting(key)}
                className="shrink-0 transition-all"
                aria-label={settings[key] ? 'O\'chirish' : 'Yoqish'}
              >
                {settings[key] ? (
                  <ToggleRight className="w-8 h-8 text-violet-400" />
                ) : (
                  <ToggleLeft className="w-8 h-8 text-slate-600" />
                )}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
