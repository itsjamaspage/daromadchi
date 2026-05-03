import Sidebar from '@/components/dashboard/Sidebar'
import MobileNav from '@/components/dashboard/MobileNav'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Desktop sidebar — fixed, hidden on mobile */}
      <div className="hidden lg:block fixed left-0 top-0 h-full w-60 z-30">
        <Sidebar />
      </div>

      {/* Mobile top bar + slide-in drawer */}
      <MobileNav />

      {/* Main content */}
      <main className="lg:ml-60 pt-14 lg:pt-0 min-w-0 p-4 sm:p-6 lg:p-8">
        {children}
      </main>
    </div>
  )
}
