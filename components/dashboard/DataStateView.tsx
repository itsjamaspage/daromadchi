'use client'

import { useState } from 'react'
import { RefreshCw, AlertCircle, CheckCircle2, Clock, AlertTriangle } from 'lucide-react'
import type { SyncDay } from '@/lib/types'
import { useLang } from '@/app/providers'
import { translations } from '@/lib/i18n'

function fs(n: number | undefined) {
  if (n === undefined) return '—'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + ' mln'
  if (n >= 1_000) return (n / 1_000).toFixed(0) + ' ming'
  return String(n)
}

function statusStyle(s: SyncDay['status']) {
  switch (s) {
    case 'ready':    return { bg: 'bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-500/30', text: 'text-emerald-400' }
    case 'degraded': return { bg: 'bg-amber-500/20 hover:bg-amber-500/30 border-amber-500/30',       text: 'text-amber-400'   }
    case 'error':    return { bg: 'bg-red-500/20 hover:bg-red-500/30 border-red-500/30',             text: 'text-red-400'     }
    case 'pending':  return { bg: 'bg-[var(--bg-card2)] hover:bg-[var(--bg-card2)] border-[var(--border2)]', text: 'text-[var(--text-muted)]' }
  }
}

function statusIcon(s: SyncDay['status']) {
  switch (s) {
    case 'ready':    return <CheckCircle2  className="w-3.5 h-3.5 text-emerald-400" />
    case 'degraded': return <AlertTriangle className="w-3.5 h-3.5 text-amber-400"   />
    case 'error':    return <AlertCircle   className="w-3.5 h-3.5 text-red-400"     />
    case 'pending':  return <Clock         className="w-3.5 h-3.5 text-[var(--text-muted)]" />
  }
}

type MP = 'uzum' | 'yandex' | 'wb'

interface Props {
  uzumDays:     SyncDay[]
  yandexDays:   SyncDay[]
  wbDays:       SyncDay[]
  connectedMps?: string[]
}

export default function DataStateView({ uzumDays, yandexDays, wbDays, connectedMps }: Props) {
  const { lang } = useLang()
  const d = translations[lang].dashboard
  const [mp, setMp] = useState<MP>('uzum')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [resyncing, setResyncing] = useState<Set<string>>(new Set())
  const [hoveredDay, setHoveredDay] = useState<SyncDay | null>(null)

  const days = mp === 'uzum' ? uzumDays : mp === 'yandex' ? yandexDays : wbDays
  const mpId = mp === 'uzum' ? 'uzum' : mp === 'yandex' ? 'yandex_market' : 'wildberries'
  const isConnected = !connectedMps || connectedMps.length === 0 || connectedMps.includes(mpId)

  function statusLabel(s: SyncDay['status']) {
    switch (s) {
      case 'ready':    return d.dsReady
      case 'degraded': return d.dsDegraded
      case 'error':    return d.dsError
      case 'pending':  return d.dsPending
    }
  }

  function toggleDay(date: string) {
    setSelected(prev => {
      const n = new Set(prev)
      if (n.has(date)) n.delete(date); else n.add(date)
      return n
    })
  }

  function selectAll(status?: SyncDay['status']) {
    const toSelect = status ? days.filter(d => d.status === status).map(d => d.date) : days.map(d => d.date)
    setSelected(new Set(toSelect))
  }

  async function resyncSelected() {
    const marketplace = mp === 'uzum' ? 'uzum' : mp === 'yandex' ? 'yandex_market' : 'wildberries'
    setResyncing(new Set(selected))
    setSelected(new Set())
    await fetch('/api/sync/resync-days', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ marketplace, dates: [...selected] }),
    })
    setTimeout(() => setResyncing(new Set()), 2000)
  }

  const counts = {
    ready:    days.filter(d => d.status === 'ready').length,
    degraded: days.filter(d => d.status === 'degraded').length,
    error:    days.filter(d => d.status === 'error').length,
    pending:  days.filter(d => d.status === 'pending').length,
  }

  const noShop = !isConnected
  const noData = isConnected && days.length === 0

  return (
    <div className="space-y-4">
      {/* Marketplace tabs */}
      <div className="flex items-center gap-1 p-1 bg-[var(--bg-card2)] border border-[var(--border)] rounded-xl w-fit">
        {([
          { id: 'uzum',   label: 'Uzum' },
          { id: 'yandex', label: 'Yandex Market' },
          { id: 'wb',     label: 'Wildberries' },
        ] as { id: MP; label: string }[]).map(m => (
          <button key={m.id}
            onClick={() => { setMp(m.id); setSelected(new Set()); setHoveredDay(null) }}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              mp === m.id ? 'bg-[var(--bg-card2)] border border-[var(--border)]' : 'text-[var(--text-muted)] hover:text-[var(--text-dim)]'
            }`}
            style={mp === m.id ? { color: 'var(--c1)' } : {}}>
            {m.label}
          </button>
        ))}
      </div>

      {/* No shop connected */}
      {noShop ? (
        <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl p-8 text-center">
          <p className="text-[var(--text-base)] font-semibold text-sm mb-1">
            {lang === 'ru' ? 'Магазин не подключён' : lang === 'en' ? 'No shop connected' : "Do'kon ulanmagan"}
          </p>
          <p className="text-[var(--text-muted)] text-xs">
            {lang === 'ru' ? 'Подключите магазин в настройках, чтобы увидеть историю синхронизации.' :
             lang === 'en' ? 'Connect a shop in Settings to see sync history.' :
             "Sinxronizatsiya tarixini ko'rish uchun Sozlamalarda do'kon ulang."}
          </p>
        </div>
      ) : noData ? (
        <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl p-8 text-center">
          <p className="text-[var(--text-base)] font-semibold text-sm mb-1">
            {lang === 'ru' ? 'Данные ещё не загружены' : lang === 'en' ? 'No data yet' : "Ma'lumotlar hali yuklanmagan"}
          </p>
          <p className="text-[var(--text-muted)] text-xs">
            {lang === 'ru' ? 'Синхронизация данных началась. Повторите попытку позже.' :
             lang === 'en' ? 'Sync is in progress. Check back soon.' :
             "Sinxronizatsiya jarayoni boshlandi. Biroz vaqt o'tgach qayta ko'ring."}
          </p>
        </div>
      ) : (
        <>
          {/* Status summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {([
              ['ready',    d.dsReady,    counts.ready,    'text-emerald-400', 'bg-emerald-500/10 border-emerald-500/20'],
              ['degraded', d.dsDegraded, counts.degraded, 'text-amber-400',   'bg-amber-500/10 border-amber-500/20'   ],
              ['error',    d.dsError,    counts.error,    'text-red-400',     'bg-red-500/10 border-red-500/20'       ],
              ['pending',  d.dsPending,  counts.pending,  'text-[var(--text-muted)]', 'bg-[var(--bg-card2)] border-[var(--border)]'],
            ] as [SyncDay['status'], string, number, string, string][]).map(([status, label, count, textCls, bgCls]) => (
              <button key={status} onClick={() => selectAll(status)}
                className={`text-left px-4 py-3 rounded-xl border transition-all ${bgCls} hover:scale-[1.01]`}>
                <p className="text-xs text-[var(--text-muted)] mb-1">{label}</p>
                <p className={`text-xl font-bold ${textCls}`}>{count} {d.dsDaysUnit}</p>
                <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{d.dsSelectToClick}</p>
              </button>
            ))}
          </div>

          {/* Actions */}
          {selected.size > 0 && (
            <div className="flex items-center gap-3 bg-[var(--c1)]/5 border border-[var(--border)] rounded-xl px-4 py-3">
              <span className="text-xs font-semibold" style={{ color: 'var(--c1)' }}>{selected.size} {d.dsSelectedSuffix}</span>
              <button onClick={resyncSelected}
                className="flex items-center gap-1.5 px-3 py-1.5 btn-primary text-xs font-semibold rounded-lg transition-colors ml-auto">
                <RefreshCw className="w-3.5 h-3.5" />
                {lang === 'ru' ? 'Пересинхронизировать' : lang === 'en' ? 'Resync' : 'Qayta yuklash'}
              </button>
              <button onClick={() => setSelected(new Set())}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text-dim)] transition-colors">{d.dsCancel}</button>
            </div>
          )}

          {/* Day grid */}
          <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl p-4">
            <p className="text-xs font-semibold text-[var(--text-muted)] mb-4">{d.dsLast30}</p>
            <div className="grid grid-cols-5 sm:grid-cols-7 lg:grid-cols-10 gap-2">
              {days.map(day => {
                const { bg } = statusStyle(day.status)
                const isSelected  = selected.has(day.date)
                const isResyncing = resyncing.has(day.date)
                const dayNum     = new Date(day.date).getDate()
                const monthShort = new Date(day.date).toLocaleDateString('uz-UZ', { month: 'short' })
                return (
                  <button key={day.date}
                    onClick={() => toggleDay(day.date)}
                    onMouseEnter={() => setHoveredDay(day)}
                    onMouseLeave={() => setHoveredDay(null)}
                    className={`relative flex flex-col items-center gap-1 p-2 rounded-xl border transition-all cursor-pointer
                      ${isSelected  ? 'ring-2 ring-[var(--c1)] ring-offset-1 ring-offset-[var(--bg-card2)]' : ''}
                      ${isResyncing ? 'animate-pulse' : ''}
                      ${bg}`}>
                    {isResyncing && (
                      <RefreshCw className="absolute top-1 right-1 w-2.5 h-2.5 text-[var(--c1)] animate-spin" />
                    )}
                    <span className="text-[10px] text-[var(--text-muted)]">{monthShort}</span>
                    <span className="text-sm font-bold text-[var(--text-base)]">{dayNum}</span>
                    <span className="scale-75">{statusIcon(day.status)}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Hovered day detail */}
          {hoveredDay && (
            <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-[var(--text-muted)] mb-1">{d.dsDate}</p>
                <p className="text-sm font-bold text-[var(--text-base)]">{hoveredDay.date}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)] mb-1">{d.dsStatus}</p>
                <div className="flex items-center gap-1.5">
                  {statusIcon(hoveredDay.status)}
                  <span className={`text-sm font-semibold ${statusStyle(hoveredDay.status).text}`}>
                    {statusLabel(hoveredDay.status)}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)] mb-1">{d.dsProducts}</p>
                <p className="text-sm font-bold text-[var(--text-base)]">{hoveredDay.productsCount ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-muted)] mb-1">{d.dsRevenue}</p>
                <p className="text-sm font-bold text-emerald-400">
                  {hoveredDay.revenue !== undefined ? `${fs(hoveredDay.revenue)} so'm` : '—'}
                </p>
              </div>
              {hoveredDay.errorMessage && (
                <div className="col-span-full">
                  <p className="text-xs text-[var(--text-muted)] mb-1">{d.dsError}</p>
                  <p className="text-xs text-red-400">{hoveredDay.errorMessage}</p>
                </div>
              )}
            </div>
          )}

          {/* Legend */}
          <div className="flex flex-wrap gap-4 text-xs text-[var(--text-muted)]">
            <span>{d.dsHint}</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> {d.dsReady}</span>
            <span className="flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> {d.dsDegraded}</span>
            <span className="flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5 text-red-400" /> {d.dsError}</span>
          </div>
        </>
      )}
    </div>
  )
}
