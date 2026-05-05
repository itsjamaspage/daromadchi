import { TableSkeleton, PageHeaderSkeleton } from '@/components/dashboard/Skeleton'

export default function OrdersLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <TableSkeleton rows={8} />
    </div>
  )
}
