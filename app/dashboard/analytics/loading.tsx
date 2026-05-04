import { KpiSkeleton, ChartSkeleton, TableSkeleton, PageHeaderSkeleton } from '@/components/dashboard/Skeleton'

export default function AnalyticsLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <KpiSkeleton />
      <ChartSkeleton height="h-72" />
      <TableSkeleton rows={6} />
    </div>
  )
}
