/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import Link from 'next/link'
import { GoArrowUpRight } from 'react-icons/go'
import './CardNav.css'

export interface CardNavLink {
  label: string
  ariaLabel?: string
  href?: string
}

export interface CardNavItem {
  label: string
  bgColor: string
  textColor: string
  links?: CardNavLink[]
}

interface CardNavProps {
  logo?: string
  logoAlt?: string
  logoText?: string
  logoTextColor?: string
  items: CardNavItem[]
  className?: string
  ease?: string
  baseColor?: string
  menuColor?: string
  buttonBgColor?: string
  buttonTextColor?: string
  buttonLabel?: string
  buttonHref?: string
  rightControls?: React.ReactNode
  scrolled?: boolean
}

const CardNav = ({
  logo,
  logoAlt = 'Logo',
  logoText,
  logoTextColor,
  items,
  className = '',
  ease = 'power3.out',
  baseColor = '#fff',
  menuColor,
  buttonBgColor = '#111',
  buttonTextColor = '#fff',
  buttonLabel = 'Get Started',
  buttonHref = '/',
  rightControls,
  scrolled = false,
}: CardNavProps) => {
  const [isHamburgerOpen, setIsHamburgerOpen] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const navRef = useRef(null)
  const cardsRef = useRef([])
  const tlRef = useRef(null)

  const calculateHeight = () => {
    const navEl = navRef.current
    if (!navEl) return 260

    const isMobile = window.matchMedia('(max-width: 768px)').matches
    if (isMobile) {
      const contentEl = navEl.querySelector('.card-nav-content')
      if (contentEl) {
        const wasVis = contentEl.style.visibility
        const wasPE  = contentEl.style.pointerEvents
        const wasPos = contentEl.style.position
        const wasH   = contentEl.style.height

        contentEl.style.visibility = 'visible'
        contentEl.style.pointerEvents = 'auto'
        contentEl.style.position = 'static'
        contentEl.style.height = 'auto'

        void contentEl.offsetHeight

        const contentHeight = contentEl.scrollHeight

        contentEl.style.visibility = wasVis
        contentEl.style.pointerEvents = wasPE
        contentEl.style.position = wasPos
        contentEl.style.height = wasH

        return 60 + contentHeight + 16
      }
    }
    return 260
  }

  const createTimeline = () => {
    const navEl = navRef.current
    if (!navEl) return null

    gsap.set(navEl, { height: 60, overflow: 'hidden' })
    gsap.set(cardsRef.current, { y: 50, opacity: 0 })

    const tl = gsap.timeline({ paused: true })
    tl.to(navEl, { height: calculateHeight, duration: 0.4, ease })
    tl.to(cardsRef.current, { y: 0, opacity: 1, duration: 0.4, ease, stagger: 0.08 }, '-=0.1')
    return tl
  }

  useLayoutEffect(() => {
    const tl = createTimeline()
    tlRef.current = tl
    return () => { tl?.kill(); tlRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ease, items])

  useLayoutEffect(() => {
    const handleResize = () => {
      if (!tlRef.current) return
      if (isExpanded) {
        const newH = calculateHeight()
        gsap.set(navRef.current, { height: newH })
        tlRef.current.kill()
        const newTl = createTimeline()
        if (newTl) { newTl.progress(1); tlRef.current = newTl }
      } else {
        tlRef.current.kill()
        const newTl = createTimeline()
        if (newTl) tlRef.current = newTl
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExpanded])

  const toggleMenu = () => {
    const tl = tlRef.current
    if (!tl) return
    if (!isExpanded) {
      setIsHamburgerOpen(true)
      setIsExpanded(true)
      tl.play(0)
    } else {
      setIsHamburgerOpen(false)
      tl.eventCallback('onReverseComplete', () => setIsExpanded(false))
      tl.reverse()
    }
  }

  const setCardRef = (i: number) => (el: HTMLDivElement) => {
    if (el) cardsRef.current[i] = el
  }

  return (
    <div className={`card-nav-container ${className}`}>
      <nav
        ref={navRef}
        className={`card-nav ${isExpanded ? 'open' : ''} ${scrolled ? 'card-nav-scrolled' : ''}`}
        style={{ backgroundColor: baseColor }}
      >
        <div className="card-nav-top">
          {/* Hamburger */}
          <div
            className={`hamburger-menu ${isHamburgerOpen ? 'open' : ''}`}
            onClick={toggleMenu}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleMenu() } }}
            role="button"
            aria-label={isExpanded ? 'Close menu' : 'Open menu'}
            aria-expanded={isExpanded}
            tabIndex={0}
            style={{ color: menuColor || '#000' }}
          >
            <div className="hamburger-line" />
            <div className="hamburger-line" />
          </div>

          {/* Logo (centered) */}
          <Link href="/" className="card-nav-logo-container">
            {logo && <img src={logo} alt={logoAlt} className="card-nav-logo" />}
            {logoText && (
              <span className="card-nav-logo-text" style={{ color: logoTextColor || menuColor || '#000' }}>
                {logoText}
              </span>
            )}
          </Link>

          {/* Right controls + CTA */}
          <div className="card-nav-right">
            {rightControls}
            <Link
              href={buttonHref}
              className="card-nav-cta-button"
              style={{ backgroundColor: buttonBgColor, color: buttonTextColor }}
            >
              {buttonLabel}
            </Link>
          </div>
        </div>

        {/* Expandable nav cards */}
        <div className="card-nav-content" aria-hidden={!isExpanded}>
          {(items || []).slice(0, 3).map((item, idx) => (
            <div
              key={`${item.label}-${idx}`}
              className="nav-card"
              ref={setCardRef(idx)}
              style={{ backgroundColor: item.bgColor, color: item.textColor }}
            >
              <div className="nav-card-links">
                {item.links?.map((lnk, i) => (
                  <a
                    key={`${lnk.label}-${i}`}
                    className="nav-card-link"
                    href={lnk.href}
                    aria-label={lnk.ariaLabel}
                    style={{ color: item.textColor }}
                    onClick={() => { setIsHamburgerOpen(false); setIsExpanded(false) }}
                  >
                    <GoArrowUpRight aria-hidden="true" />
                    {lnk.label}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      </nav>
    </div>
  )
}

export default CardNav
