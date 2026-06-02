import { getT } from '@/lib/server-i18n'
import { reviewEntries } from '@/lib/mock-reviews-seasonality'
import ReviewsView from '@/components/dashboard/ReviewsView'
import HelpTooltip from '@/components/dashboard/HelpTooltip'

export default async function ReviewsPage() {
  const t       = await getT()
  const d       = t.dashboard
  const reviews = reviewEntries
  const unread  = reviews.filter(r => !r.replied).length

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-0.5">
          <h1 className="text-2xl font-bold text-white">{d.reviewsTitle}</h1>
          {unread > 0 && (
            <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-red-500/10 border border-red-500/25 text-red-400">
              {unread} {d.unanswered}
            </span>
          )}
          <HelpTooltip section="reviews" />
        </div>
        <p className="text-slate-400 text-sm">{d.reviewsSubtitle}</p>
      </div>
      <ReviewsView reviews={reviews} />
    </div>
  )
}
