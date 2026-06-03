'use client'

import { useState, useRef, useEffect } from 'react'
import { Bell, X, Package } from 'lucide-react'
import type { StockAlert } from '@/lib/types'

interface Alert {
  id: string
  title: string
  desc: string
}

function alertFromStock(a: StockAlert): Alert {
  const urgency = a.daysLeft <= 3 ? '🔴' : a.daysLeft <= 7 ? '🟡' : '🟠'
  return {
    id:    a.productId,
    title: `${urgency} ${a.productTitle}`,
    desc:  `Zaxira: ${a.currentStock} dona — ${a.daysLeft === 999 ? 'sotuv yo\'q' : `~${a.daysLeft} kun qoldi`}`,
  }
}

export default function NotificationsButton() {
  const [open, setOpen]       = useState(false)
  const [alerts, setAlerts]   = useState<Alert[]>([])
  const [unread, setUnread]   = useState(0)
  const [loaded, setLoaded]   = useState(false)
  const panelRef              = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/alerts')
      .then(r => r.json())
      .then(({ alerts: stockAlerts }: { alerts: StockAlert[] }) => {
        const mapped = (stockAlerts ?? []).map(alertFromStock)
        setAlerts(mapped)
        setUnread(mapped.length)
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [])

  function openPanel() {
    setOpen(true)
    setUnread(0)
  }

  function dismiss(id: string) {
    setAlerts(prev => prev.filter(a => a.id !== id))
  }

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={openPanel}
        className="relative p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-base)] hover:bg-[var(--bg-input)] transition-all"
        aria-label="Bildirishnomalar"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-[var(--text-base)] text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-[var(--bg-card2)] border border-[var(--border2)] rounded-2xl shadow-2xl shadow-black/50 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
            <h3 className="text-[var(--text-base)] font-semibold text-sm">Bildirishnomalar</h3>
            <span className="text-xs text-[var(--text-muted)]">{alerts.length} ta</span>
          </div>

          {!loaded ? (
            <div className="px-4 py-8 text-center">
              <p className="text-[var(--text-muted)] text-sm">Yuklanmoqda...</p>
            </div>
          ) : alerts.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <Bell className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2" />
              <p className="text-[var(--text-muted)] text-sm">Hamma narsa yaxshi!</p>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto divide-y divide-[var(--border)]">
              {alerts.map(alert => (
                <div key={alert.id} className="flex items-start gap-3 px-4 py-3 hover:bg-[var(--bg-input)] group transition-colors">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Package className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[var(--text-base)] text-xs font-medium truncate">{alert.title}</p>
                    <p className="text-[var(--text-muted)] text-xs mt-0.5 leading-relaxed">{alert.desc}</p>
                  </div>
                  <button
                    onClick={() => dismiss(alert.id)}
                    className="text-[var(--text-muted)] hover:text-[var(--text-dim)] transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0 mt-0.5"
                    aria-label="O'chirish"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {alerts.length > 0 && (
            <div className="px-4 py-2.5 border-t border-[var(--border)]">
              <button
                onClick={() => setAlerts([])}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text-dim)] transition-colors w-full text-center"
              >
                Hammasini o&apos;chirish
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
