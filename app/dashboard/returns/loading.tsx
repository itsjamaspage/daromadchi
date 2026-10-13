export default function ReturnsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--bg-card2)]" />
        <div className="space-y-2">
          <div className="h-6 w-32 bg-[var(--bg-card2)] rounded" />
          <div className="h-4 w-56 bg-[var(--bg-card2)] rounded" />
        </div>
      </div>
      <div className="grid gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-28 bg-[var(--bg-card2)] rounded-xl border border-[var(--border)]" />
        ))}
      </div>
    </div>
  )
}
