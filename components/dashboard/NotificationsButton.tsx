'use client'

import { useState, useRef, useEffect } from 'react'
import { Bell, AlertTriangle, TrendingDown, Package, X } from 'lucide-react'
import { products, productAds } from '@/lib/mock-data'

interface Alert {
  id: string
  type: 'stock' | 'drr' | 'spend'
  title: string
  desc: string
  color: string
  icon: React.ElementType
}

function buildAlerts(): Alert[] {
  const alerts: Alert[] = []

  for (const p of products) {
    const velocity = p.sold / 30
    const daysLeft = velocity > 0 ? Math.floor(p.stock / velocity) : 999

    if (daysLeft <= 7) {
      alerts.push({
        id: `stock-${p.id}`,
        type: 'stock',
        title: `${p.name}`,
        desc: `Faqat ${daysLeft} kun zaxira qoldi — tezda buyurtma bering`,
        color: 'text-red-400',
        icon: Package,
      })
    } else if (daysLeft <= 14) {
      alerts.push({
        id: `stock-${p.id}`,
        type: 'stock',
        title: `${p.name}`,
        desc: `${daysLeft} kun zaxira qoldi — zaxira kamaymoqda`,
        color: 'text-amber-400',
        icon: Package,
      })
    }

    const ad = productAds[p.id]
    if (ad) {
      const revenue = p.price * p.sold
      const drr = revenue > 0 ? (ad.adSpend / revenue) * 100 : 0

      if (ad.adOrders === 0 && ad.adSpend > 0) {
        alerts.push({
          id: `spend-${p.id}`,
          type: 'spend',
          title: `${p.name}`,
          desc: `Reklamaga ${new Intl.NumberFormat('uz-UZ').format(Math.round(ad.adSpend / 1000))}K so'm sarflandi, lekin sotuvga ta'sir yo'q`,
          color: 'text-amber-400',
          icon: TrendingDown,
        })
      } else if (drr > 25) {
        alerts.push({
          id: `drr-${p.id}`,
          type: 'drr',
          title: `${p.name}`,
          desc: `DRR ${drr.toFixed(1)}% — reklama byudjetini kamaytiring`,
          color: 'text-red-400',
          icon: AlertTriangle,
        })
      }
    }
  }

  return alerts
}

const ALL_ALERTS = buildAlerts()

export default function NotificationsButton() {
  const [open, setOpen]       = useState(false)
  const [unread, setUnread]   = useState(ALL_ALERTS.length)
  const [alerts, setAlerts]   = useState(ALL_ALERTS)
  const panelRef              = useRef<HTMLDivElement>(null)

  function openPanel() {
    setOpen(true)
    setUnread(0)
  }

  function dismiss(id: string) {
    setAlerts(prev => prev.filter(a => a.id !== id))
  }

  // Close on outside click
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
        className="relative p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.06] transition-all"
        aria-label="Bildirishnomalar"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-[#13131f] border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/50 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.05]">
            <h3 className="text-white font-semibold text-sm">Bildirishnomalar</h3>
            <span className="text-xs text-slate-500">{alerts.length} ta</span>
          </div>

          {alerts.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <Bell className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">Hamma narsa yaxshi!</p>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto divide-y divide-white/[0.04]">
              {alerts.map(alert => (
                <div key={alert.id} className="flex items-start gap-3 px-4 py-3 hover:bg-white/[0.02] group transition-colors">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    alert.type === 'stock' ? 'bg-amber-500/10' :
                    alert.type === 'drr'   ? 'bg-red-500/10'   :
                                             'bg-amber-500/10'
                  }`}>
                    <alert.icon className={`w-3.5 h-3.5 ${alert.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-medium truncate">{alert.title}</p>
                    <p className="text-slate-400 text-xs mt-0.5 leading-relaxed">{alert.desc}</p>
                  </div>
                  <button
                    onClick={() => dismiss(alert.id)}
                    className="text-slate-600 hover:text-slate-400 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0 mt-0.5"
                    aria-label="O'chirish"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {alerts.length > 0 && (
            <div className="px-4 py-2.5 border-t border-white/[0.05]">
              <button
                onClick={() => setAlerts([])}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors w-full text-center"
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
