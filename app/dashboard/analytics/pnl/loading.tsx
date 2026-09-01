import { ChartSkeleton, TableSkeleton, PageHeaderSkeleton } from '@/components/dashboard/Skeleton'

export default function PnlLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <ChartSkeleton height="h-72" />
      <TableSkeleton rows={6} />
    </div>
  )
}
