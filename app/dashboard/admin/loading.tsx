import { PageHeaderSkeleton, SkeletonBox } from '@/components/dashboard/Skeleton'

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <SkeletonBox className="h-28 rounded-2xl" />
      <SkeletonBox className="h-24 rounded-2xl" />
      <SkeletonBox className="h-64 rounded-2xl" />
    </div>
  )
}
