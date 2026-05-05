import { SkeletonBox, PageHeaderSkeleton } from '@/components/dashboard/Skeleton'

export default function MarketLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <SkeletonBox className="h-12 rounded-xl" />
      <div>
        <SkeletonBox className="w-24 h-3 mb-3" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {Array.from({ length: 16 }).map((_, i) => (
            <SkeletonBox key={i} className="h-10 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  )
}
