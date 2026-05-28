import { SkeletonBox, PageHeaderSkeleton } from '@/components/dashboard/Skeleton'

export default function SettingsLoading() {
  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeaderSkeleton />
      <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl p-6 space-y-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <SkeletonBox className="w-32 h-3" />
            <SkeletonBox className="w-full h-10 rounded-xl" />
          </div>
        ))}
        <SkeletonBox className="w-32 h-10 rounded-xl" />
      </div>
    </div>
  )
}
