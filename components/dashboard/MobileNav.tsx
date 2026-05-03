'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'
import Sidebar from './Sidebar'

export default function MobileNav() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  // Close drawer on route change
  useEffect(() => { setOpen(false) }, [pathname])

  // Prevent body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <>
      {/* Top bar — mobile only */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-[#0d0d1a] border-b border-white/[0.05] flex items-center px-4 gap-3">
        <button
          onClick={() => setOpen(true)}
          className="text-slate-400 hover:text-white transition-colors p-1"
          aria-label="Menyuni ochish"
        >
          <Menu className="w-5 h-5" />
        </button>
        <span className="font-bold text-white text-sm tracking-tight">Daromadchi</span>
      </header>

      {/* Backdrop */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Slide-in drawer */}
      <div className={`lg:hidden fixed top-0 left-0 h-full z-50 transition-transform duration-300 ease-in-out ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <Sidebar onClose={() => setOpen(false)} />
      </div>
    </>
  )
}
