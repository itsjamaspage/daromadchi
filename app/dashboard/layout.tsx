import Sidebar from '@/components/dashboard/Sidebar'
import MobileNav from '@/components/dashboard/MobileNav'
import BottomNav from '@/components/dashboard/BottomNav'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      {/* Desktop sidebar */}
      <div className="hidden lg:block fixed left-0 top-0 h-full w-60 z-30">
        <Sidebar />
      </div>

      {/* Mobile: top bar with hamburger + slide-in drawer */}
      <MobileNav />

      {/* Main content — extra bottom padding on mobile for the bottom nav */}
      <main className="lg:ml-60 pt-14 lg:pt-0 pb-20 lg:pb-0 min-w-0">
        <div className="p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>

      {/* Mobile bottom tab bar */}
      <BottomNav />
    </div>
  )
}
