'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

export default function NavigationEvents() {
  const pathname = usePathname()
  const prevPathname = useRef<string | null>(null)
  const pendingEnd = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (prevPathname.current === null) {
      prevPathname.current = pathname
      return
    }
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname
      if (pendingEnd.current) clearTimeout(pendingEnd.current)
      window.dispatchEvent(new Event('__loading_end__'))
    }
  }, [pathname])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest('a')
      if (!anchor) return
      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto') || href.startsWith('tel')) return
      if (anchor.target === '_blank') return
      const isSamePage = href === window.location.pathname || href === window.location.pathname + window.location.search
      if (isSamePage) return

      if (pendingEnd.current) clearTimeout(pendingEnd.current)
      window.dispatchEvent(new Event('__loading_start__'))
      // Safety fallback: hide after 5s if navigation never completes
      pendingEnd.current = setTimeout(() => {
        window.dispatchEvent(new Event('__loading_end__'))
      }, 5000)
    }

    document.addEventListener('click', handleClick, true)
    return () => {
      document.removeEventListener('click', handleClick, true)
      if (pendingEnd.current) clearTimeout(pendingEnd.current)
    }
  }, [])

  return null
}
