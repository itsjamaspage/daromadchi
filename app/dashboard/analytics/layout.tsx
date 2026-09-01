import AnalyticsTabs from '@/components/dashboard/AnalyticsTabs'

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <AnalyticsTabs />
      {children}
    </div>
  )
}
