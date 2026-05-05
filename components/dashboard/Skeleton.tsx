export function SkeletonBox({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`animate-pulse bg-white/[0.05] rounded-xl ${className}`} style={style} />
}

export function KpiSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-[#13131f] border border-white/[0.06] rounded-2xl p-5">
          <div className="flex items-start justify-between mb-4">
            <SkeletonBox className="w-10 h-10" />
            <SkeletonBox className="w-14 h-6" />
          </div>
          <SkeletonBox className="w-24 h-3 mb-2" />
          <SkeletonBox className="w-32 h-7" />
        </div>
      ))}
    </div>
  )
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="bg-[#13131f] border border-white/[0.06] rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-white/[0.05]">
        <SkeletonBox className="w-40 h-4" />
      </div>
      <div className="divide-y divide-white/[0.03]">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="px-5 py-4 flex items-center gap-4">
            <SkeletonBox className="w-8 h-8 rounded-lg flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <SkeletonBox className="h-3 w-48" />
              <SkeletonBox className="h-2.5 w-28" />
            </div>
            <SkeletonBox className="h-3 w-20" />
            <SkeletonBox className="h-3 w-16" />
            <SkeletonBox className="h-6 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function ChartSkeleton({ height = 'h-52' }: { height?: string }) {
  return (
    <div className={`bg-[#13131f] border border-white/[0.06] rounded-2xl p-5 ${height}`}>
      <SkeletonBox className="w-36 h-4 mb-6" />
      <div className="flex items-end gap-2 h-28">
        {Array.from({ length: 12 }).map((_, i) => (
          <SkeletonBox
            key={i}
            className="flex-1"
            style={{ height: `${30 + Math.sin(i * 0.8) * 50 + 50}%` }}
          />
        ))}
      </div>
    </div>
  )
}

export function PageHeaderSkeleton() {
  return (
    <div className="flex items-center gap-3">
      <SkeletonBox className="w-40 h-7" />
      <SkeletonBox className="w-28 h-5 rounded-full" />
    </div>
  )
}
