'use client'

import { useState } from 'react'
import { Monitor, Smartphone, Globe, LogOut, ToggleLeft, ToggleRight, ExternalLink, AlertTriangle } from 'lucide-react'
import { useLang } from '@/app/providers'
import { translations } from '@/lib/i18n'

// Connected-device tracking requires a server-side session registry that isn't
// built yet, so the list shows an honest empty state instead of fabricated rows.
type Device = {
  id: number
  name: string
  browser: string
  lastActive: string
  status: 'active' | 'inactive'
  icon: typeof Monitor
  unsupported: boolean
}

type ToggleKey = 'widget' | 'drr' | 'competitor'

export default function DevicesPage() {
  const { lang } = useLang()
  const d = translations[lang].dashboard

  const EXTENSION_SETTINGS: { key: ToggleKey; label: string; desc: string }[] = [
    { key: 'widget',     label: d.devicesExtWidget,     desc: d.devicesExtWidgetDesc },
    { key: 'drr',        label: d.devicesExtDrr,        desc: d.devicesExtDrrDesc },
    { key: 'competitor', label: d.devicesExtCompetitor, desc: d.devicesExtCompetitorDesc },
  ]

  const [settings, setSettings] = useState<Record<ToggleKey, boolean>>({
    widget: true,
    drr: true,
    competitor: false,
  })
  const [devices, setDevices] = useState<Device[]>([])

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
        <h1 className="text-2xl font-bold text-[var(--text-base)] flex items-center gap-2">
          <Monitor className="w-6 h-6 text-violet-400" />
          {d.devicesManageTitle}
        </h1>
        <p className="text-[var(--text-muted)] text-sm mt-0.5">{d.devicesManageSubtitle}</p>
      </div>

      {/* Chrome Web Store banner */}
      <div className="flex items-center gap-4 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-2xl px-5 py-4">
        <Globe className="w-8 h-8 text-cyan-400 shrink-0" />
        <div className="flex-1">
          <p className="text-[var(--text-base)] font-semibold text-sm">{d.devicesInstallExt}</p>
          <p className="text-[var(--text-muted)] text-xs mt-0.5">{d.devicesInstallExtDesc}</p>
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
      <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Monitor className="w-4 h-4 text-violet-400" />
            <h2 className="text-[var(--text-base)] font-semibold text-sm">{d.devicesConnected}</h2>
            <span className="text-xs text-[var(--text-muted)] bg-[var(--bg-card2)] px-2 py-0.5 rounded-full border border-[var(--border)]">
              {devices.length}
            </span>
          </div>
        </div>

        {devices.length === 0 ? (
          <div className="py-10 text-center text-[var(--text-muted)] text-sm">
            {d.devicesNoneConnected}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[var(--text-muted)] text-xs border-b border-[var(--border)] bg-[var(--bg-card2)]">
                  <th className="text-left font-medium px-5 py-3">#</th>
                  <th className="text-left font-medium px-4 py-3">{d.devicesColDevice}</th>
                  <th className="text-left font-medium px-4 py-3">{d.devicesColBrowser}</th>
                  <th className="text-left font-medium px-4 py-3">{d.devicesColLastActive}</th>
                  <th className="text-left font-medium px-4 py-3">{d.devicesColStatus}</th>
                  <th className="text-right font-medium px-4 py-3">{d.devicesColAction}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {devices.map((device, idx) => {
                  const Icon = device.icon
                  return (
                    <tr key={device.id} className="hover:bg-[var(--bg-card2)] transition-colors">
                      <td className="px-5 py-3.5 text-[var(--text-muted)] text-xs">{idx + 1}</td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
                          <div>
                            <p className="text-[var(--text-base)] font-medium text-xs">{device.name}</p>
                            {device.unsupported && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded mt-0.5">
                                <AlertTriangle className="w-2.5 h-2.5" />
                                {d.devicesUnsupported}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-[var(--text-muted)] text-xs">{device.browser}</td>
                      <td className="px-4 py-3.5 text-[var(--text-muted)] text-xs">{device.lastActive}</td>
                      <td className="px-4 py-3.5">
                        {device.status === 'active' ? (
                          <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            {d.devicesActive}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                            {d.devicesInactive}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          onClick={() => handleRemoveDevice(device.id)}
                          className="text-xs text-red-400/70 hover:text-red-400 border border-red-500/20 hover:border-red-500/40 px-2.5 py-1 rounded-lg transition-all"
                        >
                          {d.devicesDelete}
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
          <div className="px-5 py-3 border-t border-[var(--border)]">
            <button
              onClick={handleLogoutAll}
              className="flex items-center gap-2 text-xs text-red-400 border border-red-500/30 hover:border-red-500/60 hover:bg-red-500/[0.06] px-3 py-2 rounded-xl transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
              {d.devicesSignOutAll}
            </button>
          </div>
        )}
      </div>

      {/* Extension settings */}
      <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-2">
          <Monitor className="w-4 h-4 text-violet-400" />
          <h2 className="text-[var(--text-base)] font-semibold text-sm">{d.devicesExtSettings}</h2>
        </div>
        <div className="divide-y divide-[var(--border)]">
          {EXTENSION_SETTINGS.map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-[var(--bg-card2)] transition-colors">
              <div>
                <p className="text-[var(--text-base)] text-sm font-medium">{label}</p>
                <p className="text-[var(--text-muted)] text-xs mt-0.5">{desc}</p>
              </div>
              <button
                onClick={() => toggleSetting(key)}
                className="shrink-0 transition-all"
                aria-label={settings[key] ? d.profileHide : d.profileShow}
              >
                {settings[key] ? (
                  <ToggleRight className="w-8 h-8 text-violet-400" />
                ) : (
                  <ToggleLeft className="w-8 h-8 text-[var(--text-muted)]" />
                )}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
