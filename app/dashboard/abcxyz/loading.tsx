export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-64 bg-[var(--bg-input)] rounded-xl" />
      <div className="grid grid-cols-3 gap-4">
        {[0, 1, 2].map(i => <div key={i} className="h-24 bg-[var(--bg-card2)] rounded-2xl" />)}
      </div>
      <div className="h-28 bg-[var(--bg-card2)] rounded-2xl" />
      <div className="flex gap-2">
        {[0, 1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-8 w-16 bg-[var(--bg-card2)] rounded-lg" />)}
      </div>
      <div className="h-96 bg-[var(--bg-card2)] rounded-2xl" />
    </div>
  )
}
