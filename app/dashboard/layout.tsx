import Sidebar from '@/components/dashboard/Sidebar'
import DashboardTopBar from '@/components/dashboard/DashboardTopBar'
import MobileNav from '@/components/dashboard/MobileNav'
import BottomNav from '@/components/dashboard/BottomNav'
import FeedbackWidget from '@/components/dashboard/FeedbackWidget'
import ChannelGate from '@/components/dashboard/ChannelGate'
import { getCurrentUser } from '@/lib/auth/session'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()

  return (
    <ChannelGate>
      <div className="min-h-screen">
        {/* Desktop sidebar — icon-only (56px), hover-expands to 240px over content */}
        <div className="hidden lg:block fixed left-0 top-0 h-full z-40">
          <Sidebar />
        </div>

        {/* Desktop top bar — profile pill + dropdown */}
        <DashboardTopBar userName={user?.full_name ?? user?.email?.split('@')[0] ?? 'User'} userEmail={user?.email ?? ''} />

        {/* Mobile: top bar with hamburger + slide-in drawer */}
        <MobileNav />

        {/* Main content — offset by collapsed sidebar width only */}
        <main className="lg:ml-14 pt-14 pb-20 lg:pb-0 min-w-0">
          <div className="p-4 sm:p-6 lg:p-8">
            {children}
          </div>
        </main>

        {/* Mobile bottom tab bar */}
        <BottomNav />

        {/* Feedback widget — right side */}
        <FeedbackWidget />
      </div>
    </ChannelGate>
  )
}
