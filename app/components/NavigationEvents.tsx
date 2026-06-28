'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

export default function NavigationEvents() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const prevKey = useRef<string | null>(null)
  const pendingEnd = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fire __loading_end__ whenever pathname OR search params change
  useEffect(() => {
    const key = `${pathname}?${searchParams.toString()}`
    if (prevKey.current === null) {
      prevKey.current = key
      return
    }
    if (prevKey.current !== key) {
      prevKey.current = key
      if (pendingEnd.current) clearTimeout(pendingEnd.current)
      window.dispatchEvent(new Event('__loading_end__'))
    }
  }, [pathname, searchParams])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest('a')
      if (!anchor) return
      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto') || href.startsWith('tel')) return
      if (anchor.target === '_blank') return
      const isSamePage = href === window.location.pathname + window.location.search
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
