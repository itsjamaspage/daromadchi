'use client'

import { useState, useMemo, useRef } from 'react'
import { Star, MessageSquare, Check, ChevronDown, ChevronUp, Search } from 'lucide-react'
import type { ReviewEntry } from '@/lib/mock-reviews-seasonality'
import ExportButton from '@/components/dashboard/ExportButton'
import { useLang } from '@/app/providers'
import { dashT } from '@/lib/dashT'

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star key={i} className={`w-3 h-3 ${i <= rating ? 'text-amber-400 fill-amber-400' : 'text-slate-700'}`} />
      ))}
    </div>
  )
}

function sentimentBg(s: ReviewEntry['sentiment']) {
  return s === 'positive' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
       : s === 'negative' ? 'bg-red-500/10 border-red-500/20 text-red-400'
       : 'bg-slate-700/30 border-slate-700/40 text-[var(--text-muted)]'
}

function sentimentLabel(s: ReviewEntry['sentiment'], t: { sentPositive: string; sentNegative: string; sentNeutral: string }) {
  return s === 'positive' ? t.sentPositive : s === 'negative' ? t.sentNegative : t.sentNeutral
}

function ratingColor(r: number) {
  return r >= 4 ? 'text-emerald-400' : r >= 3 ? 'text-amber-400' : 'text-red-400'
}

type Filter = 'all' | 'unreplied' | 'negative' | 'positive'

interface Props { reviews: ReviewEntry[] }

export default function ReviewsView({ reviews }: Props) {
  const { lang } = useLang()
  const t = dashT[lang].reviews
  const [filter, setFilter]           = useState<Filter>('all')
  const [search, setSearch]           = useState('')
  const [expanded, setExpanded]       = useState<string | null>(null)
  const [replied, setReplied]         = useState<Set<string>>(new Set(reviews.filter(r => r.replied).map(r => r.id)))
  const [replyDraft, setReplyDraft]   = useState<Record<string, string>>({})
  const [replyOpen, setReplyOpen]     = useState<string | null>(null)
  const printRef                      = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return reviews
      .filter(r => {
        if (filter === 'unreplied') return !replied.has(r.id)
        if (filter === 'negative')  return r.sentiment === 'negative'
        if (filter === 'positive')  return r.sentiment === 'positive'
        return true
      })
      .filter(r => !q || r.text.toLowerCase().includes(q) || r.productTitle.toLowerCase().includes(q) || r.author.toLowerCase().includes(q))
  }, [reviews, filter, search, replied])

  const avgRating = reviews.length
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : '—'

  const counts = {
    negative:  reviews.filter(r => r.sentiment === 'negative').length,
    unreplied: reviews.filter(r => !replied.has(r.id)).length,
    positive:  reviews.filter(r => r.sentiment === 'positive').length,
  }

  const exportData = reviews.map(r => ({
    'Muallif':   r.author,
    'Sana':      r.date,
    'Mahsulot':  r.productTitle,
    'Reyting':   r.rating,
    'Izoh':      r.text,
    'Kayfiyat':  sentimentLabel(r.sentiment, t),
    'Holat':     replied.has(r.id) ? t.replied : t.tabUnanswered,
  }))

  function submitReply(id: string) {
    const text = replyDraft[id]?.trim()
    if (!text) return
    setReplied(prev => new Set([...prev, id]))
    setReplyOpen(null)
    // In prod: POST /api/reviews/reply { reviewId: id, text }
  }

  const TABS: { key: Filter; label: string; count?: number }[] = [
    { key: 'all',       label: t.tabAll,       count: reviews.length },
    { key: 'unreplied', label: t.tabUnanswered, count: counts.unreplied },
    { key: 'negative',  label: t.tabNegative,  count: counts.negative },
    { key: 'positive',  label: t.tabPositive,  count: counts.positive },
  ]

  return (
    <div className="space-y-4" ref={printRef}>
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: t.kpiTotal,       value: String(reviews.length),     color: 'text-[var(--text-base)]' },
          { label: t.kpiAvgRating,   value: `⭐ ${avgRating}`,          color: 'text-amber-400'          },
          { label: t.kpiUnanswered,  value: String(counts.unreplied),   color: counts.unreplied > 0 ? 'text-red-400' : 'text-emerald-400' },
          { label: t.kpiNegative,    value: String(counts.negative),    color: counts.negative > 0 ? 'text-red-400' : 'text-emerald-400'  },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-xl px-4 py-3">
            <p className="text-xs text-[var(--text-muted)] mb-1">{label}</p>
            <p className={`text-lg font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center" data-noprint>
        <div className="flex flex-wrap gap-1 p-1 bg-[var(--bg-card2)] border border-[var(--border)] rounded-xl">
          {TABS.map(({ key, label, count }) => (
            <button key={key} onClick={() => setFilter(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                filter === key ? 'bg-violet-600/20 border border-violet-500/30' : 'text-[var(--text-muted)] hover:text-[var(--text-dim)]'
              }`}
              style={filter === key ? { color: 'var(--c1)' } : {}}>
              {label}
              {count !== undefined && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  filter === key ? 'bg-violet-500/20' : 'bg-white/[0.06] text-[var(--text-muted)]'
                }`}
                style={filter === key ? { color: 'var(--c1)' } : {}}>{count}</span>
              )}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="w-full pl-9 pr-3 py-2 bg-[var(--bg-card2)] border border-[var(--border)] rounded-xl text-sm text-[var(--text-base)] placeholder-[var(--text-muted)] focus:outline-none focus:border-violet-500/50" />
        </div>
        <div className="sm:ml-auto flex-shrink-0">
          <ExportButton data={exportData} filename="izohlar" targetRef={printRef} />
        </div>
      </div>

      {/* Reviews list */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl p-10 text-center">
            <MessageSquare className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-3" />
            <p className="text-[var(--text-muted)] text-sm">{t.notFound}</p>
          </div>
        )}

        {filtered.map(review => {
          const isExpanded  = expanded === review.id
          const isReplied   = replied.has(review.id)
          const isReplyOpen = replyOpen === review.id

          return (
            <div key={review.id}
              className={`bg-[var(--bg-card2)] border rounded-2xl overflow-hidden transition-all ${
                !isReplied && review.sentiment === 'negative'
                  ? 'border-red-500/20'
                  : 'border-[var(--border)]'
              }`}>
              {/* Header row */}
              <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-start gap-3">
                {/* Left: rating + meta */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <StarRating rating={review.rating} />
                    <span className={`text-sm font-bold ${ratingColor(review.rating)}`}>{review.rating}.0</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${sentimentBg(review.sentiment)}`}>
                      {sentimentLabel(review.sentiment, t)}
                    </span>
                    {!isReplied && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400">
                        {t.needReply}
                      </span>
                    )}
                    {isReplied && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-1">
                        <Check className="w-2.5 h-2.5" /> {t.replied}
                      </span>
                    )}
                  </div>
                  <p className="text-[var(--text-base)] text-sm leading-relaxed">{review.text}</p>
                  <div className="flex flex-wrap items-center gap-3 mt-2">
                    <span className="text-xs text-[var(--text-muted)]">{review.author}</span>
                    <span className="text-xs text-[var(--text-muted)]">{review.date}</span>
                    <span className="text-xs text-[var(--text-muted)] font-mono truncate max-w-[160px]">{review.productTitle}</span>
                  </div>
                </div>

                {/* Right: actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {!isReplied && (
                    <button onClick={() => setReplyOpen(isReplyOpen ? null : review.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600/10 hover:bg-violet-600/20 text-violet-400 text-xs font-semibold rounded-lg border border-violet-500/20 transition-colors">
                      <MessageSquare className="w-3 h-3" /> {t.replyBtn}
                    </button>
                  )}
                  {review.replyText && (
                    <button onClick={() => setExpanded(isExpanded ? null : review.id)}
                      className="text-[var(--text-muted)] hover:text-[var(--text-dim)] transition-colors">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              </div>

              {/* Existing reply */}
              {isExpanded && review.replyText && (
                <div className="px-4 pb-3 border-t border-white/[0.04] pt-3">
                  <p className="text-xs text-[var(--text-muted)] mb-1.5 font-semibold">{t.yourReply}</p>
                  <p className="text-sm text-[var(--text-dim)] bg-violet-500/5 border border-violet-500/10 rounded-xl px-3 py-2">
                    {review.replyText}
                  </p>
                </div>
              )}

              {/* Reply input */}
              {isReplyOpen && (
                <div className="px-4 pb-4 border-t border-white/[0.04] pt-3 space-y-2">
                  <p className="text-xs text-[var(--text-muted)] font-semibold">{t.replyLabel}</p>
                  <textarea
                    rows={3}
                    value={replyDraft[review.id] || ''}
                    onChange={e => setReplyDraft(prev => ({ ...prev, [review.id]: e.target.value }))}
                    placeholder={t.replyPlaceholder}
                    className="w-full px-3 py-2 bg-[var(--bg-base)] border border-[var(--border2)] rounded-xl text-sm text-[var(--text-base)] placeholder-[var(--text-muted)] focus:outline-none focus:border-violet-500/50 resize-none"
                  />
                  <div className="flex gap-2">
                    <button onClick={() => submitReply(review.id)}
                      className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-[var(--text-base)] text-xs font-semibold rounded-xl transition-colors">
                      {t.replySend}
                    </button>
                    <button onClick={() => setReplyOpen(null)}
                      className="px-4 py-2 bg-white/[0.04] hover:bg-[var(--bg-card2)] text-[var(--text-muted)] text-xs font-semibold rounded-xl transition-colors">
                      {t.replyCancel}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
