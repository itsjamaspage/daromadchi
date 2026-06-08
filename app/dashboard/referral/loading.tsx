import { PageHeaderSkeleton, SkeletonBox } from '@/components/dashboard/Skeleton'

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <SkeletonBox className="h-48 rounded-2xl" />
      <SkeletonBox className="h-32 rounded-2xl" />
    </div>
  )
}
