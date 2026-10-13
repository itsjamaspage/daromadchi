import { SkeletonBox } from '@/components/dashboard/Skeleton'

export default function Loading() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <SkeletonBox className="h-7 w-56 rounded-lg mb-2" />
        <SkeletonBox className="h-4 w-72 rounded-lg" />
      </div>
      <SkeletonBox className="h-16 w-full rounded-2xl" />
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center justify-between py-3.5 px-4" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="flex items-center gap-3">
              <SkeletonBox className="h-3 w-3 rounded-full" />
              <SkeletonBox className="h-4 w-28 rounded-lg" />
            </div>
            <SkeletonBox className="h-5 w-20 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  )
}
