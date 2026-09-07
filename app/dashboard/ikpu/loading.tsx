import { TableSkeleton, PageHeaderSkeleton } from '@/components/dashboard/Skeleton'

export default function IkpuLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <TableSkeleton rows={8} />
    </div>
  )
}
