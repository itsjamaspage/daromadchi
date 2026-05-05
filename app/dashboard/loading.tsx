import { KpiSkeleton, ChartSkeleton, TableSkeleton, PageHeaderSkeleton, SkeletonBox } from '@/components/dashboard/Skeleton'

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <PageHeaderSkeleton />
        <div className="flex gap-2">
          <SkeletonBox className="w-28 h-9 rounded-xl" />
          <SkeletonBox className="w-20 h-9 rounded-xl" />
        </div>
      </div>
      <KpiSkeleton />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartSkeleton height="h-64" />
        <TableSkeleton rows={4} />
      </div>
    </div>
  )
}
