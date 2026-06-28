// @ts-nocheck
'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { gsap } from 'gsap'
import './PillNav.css'

const PillNav = ({
  logo,
  logoAlt = 'Logo',
  logoHref = '/',
  items,
  activeHref,
  className = '',
  ease = 'power3.easeOut',
  baseColor = '#fff',
  pillColor = '#120F17',
  hoveredPillTextColor = '#120F17',
  pillTextColor,
  hoverCircleColor,
  onMobileMenuClick,
  initialLoadAnimation = false,
  rightContent,
}) => {
  const resolvedPillTextColor = pillTextColor ?? baseColor
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const circleRefs = useRef([])
  const tlRefs = useRef([])
  const activeTweenRefs = useRef([])
  const logoImgRef = useRef(null)
  const logoTweenRef = useRef(null)
  const hamburgerRef = useRef(null)
  const mobileMenuRef = useRef(null)
  const navItemsRef = useRef(null)
  const logoRef = useRef(null)

  useEffect(() => {
    const layout = () => {
      circleRefs.current.forEach(circle => {
        if (!circle?.parentElement) return
        const pill = circle.parentElement
        const rect = pill.getBoundingClientRect()
        const { width: w, height: h } = rect
        const R = ((w * w) / 4 + h * h) / (2 * h)
        const D = Math.ceil(2 * R) + 2
        const delta = Math.ceil(R - Math.sqrt(Math.max(0, R * R - (w * w) / 4))) + 1
        const originY = D - delta

        circle.style.width = `${D}px`
        circle.style.height = `${D}px`
        circle.style.bottom = `-${delta}px`

        gsap.set(circle, { xPercent: -50, scale: 0, transformOrigin: `50% ${originY}px` })

        const label = pill.querySelector('.pill-label')
        const white = pill.querySelector('.pill-label-hover')

        if (label) gsap.set(label, { y: 0 })
        if (white) gsap.set(white, { y: h + 12, opacity: 0 })

        const index = circleRefs.current.indexOf(circle)
        if (index === -1) return

        tlRefs.current[index]?.kill()
        const tl = gsap.timeline({ paused: true })
        tl.to(circle, { scale: 1.2, xPercent: -50, duration: 2, ease, overwrite: 'auto' }, 0)
        if (label) tl.to(label, { y: -(h + 8), duration: 2, ease, overwrite: 'auto' }, 0)
        if (white) {
          gsap.set(white, { y: Math.ceil(h + 100), opacity: 0 })
          tl.to(white, { y: 0, opacity: 1, duration: 2, ease, overwrite: 'auto' }, 0)
        }
        tlRefs.current[index] = tl
      })
    }

    layout()
    window.addEventListener('resize', layout)
    if (document.fonts?.ready) document.fonts.ready.then(layout).catch(() => {})

    const menu = mobileMenuRef.current
    if (menu) gsap.set(menu, { visibility: 'hidden', opacity: 0 })

    if (initialLoadAnimation) {
      const logo = logoRef.current
      const navItems = navItemsRef.current
      if (logo) { gsap.set(logo, { scale: 0 }); gsap.to(logo, { scale: 1, duration: 0.6, ease }) }
      if (navItems) { gsap.set(navItems, { width: 0, overflow: 'hidden' }); gsap.to(navItems, { width: 'auto', duration: 0.6, ease }) }
    }

    return () => window.removeEventListener('resize', layout)
  }, [items, ease, initialLoadAnimation])

  const handleEnter = i => {
    const tl = tlRefs.current[i]
    if (!tl) return
    activeTweenRefs.current[i]?.kill()
    activeTweenRefs.current[i] = tl.tweenTo(tl.duration(), { duration: 0.3, ease, overwrite: 'auto' })
  }

  const handleLeave = i => {
    const tl = tlRefs.current[i]
    if (!tl) return
    activeTweenRefs.current[i]?.kill()
    activeTweenRefs.current[i] = tl.tweenTo(0, { duration: 0.2, ease, overwrite: 'auto' })
  }

  const handleLogoEnter = () => {
    const img = logoImgRef.current
    if (!img) return
    logoTweenRef.current?.kill()
    gsap.set(img, { rotate: 0 })
    logoTweenRef.current = gsap.to(img, { rotate: 360, duration: 0.4, ease, overwrite: 'auto' })
  }

  const toggleMobileMenu = () => {
    const newState = !isMobileMenuOpen
    setIsMobileMenuOpen(newState)
    const hamburger = hamburgerRef.current
    const menu = mobileMenuRef.current
    if (hamburger) {
      const lines = hamburger.querySelectorAll('.hamburger-line')
      if (newState) {
        gsap.to(lines[0], { rotation: 45, y: 3, duration: 0.3, ease })
        gsap.to(lines[1], { rotation: -45, y: -3, duration: 0.3, ease })
      } else {
        gsap.to(lines[0], { rotation: 0, y: 0, duration: 0.3, ease })
        gsap.to(lines[1], { rotation: 0, y: 0, duration: 0.3, ease })
      }
    }
    if (menu) {
      if (newState) {
        gsap.set(menu, { visibility: 'visible' })
        gsap.fromTo(menu, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.3, ease, transformOrigin: 'top center' })
      } else {
        gsap.to(menu, { opacity: 0, y: 10, duration: 0.2, ease, transformOrigin: 'top center', onComplete: () => gsap.set(menu, { visibility: 'hidden' }) })
      }
    }
    onMobileMenuClick?.()
  }

  const isHashOrExternal = href =>
    !href ||
    href.startsWith('http') ||
    href.startsWith('//') ||
    href.startsWith('mailto:') ||
    href.startsWith('tel:') ||
    href.startsWith('#')

  const cssVars = {
    ['--base']: baseColor,
    ['--pill-bg']: pillColor,
    ['--hover-text']: hoveredPillTextColor,
    ['--pill-text']: resolvedPillTextColor,
    ...(hoverCircleColor ? { ['--hover-circle']: hoverCircleColor } : {}),
  }

  const renderPill = (item, i) => {
    const isActive = activeHref === item.href
    const cls = `pill${isActive ? ' is-active' : ''}`
    const inner = (
      <>
        <span className="hover-circle" aria-hidden="true" ref={el => { circleRefs.current[i] = el }} />
        <span className="label-stack">
          <span className="pill-label">{item.label}</span>
          <span className="pill-label-hover" aria-hidden="true">{item.label}</span>
        </span>
      </>
    )
    if (isHashOrExternal(item.href)) {
      return (
        <a role="menuitem" href={item.href} className={cls}
          aria-label={item.ariaLabel || item.label}
          onMouseEnter={() => handleEnter(i)} onMouseLeave={() => handleLeave(i)}>
          {inner}
        </a>
      )
    }
    return (
      <Link role="menuitem" href={item.href} className={cls}
        aria-label={item.ariaLabel || item.label}
        onMouseEnter={() => handleEnter(i)} onMouseLeave={() => handleLeave(i)}>
        {inner}
      </Link>
    )
  }

  return (
    <div className="pill-nav-container">
      <nav className={`pill-nav ${className}`} aria-label="Primary" style={cssVars}>
        <a className="pill-logo" href={logoHref} aria-label="Home"
          onMouseEnter={handleLogoEnter} ref={logoRef}>
          <img src={logo} alt={logoAlt} ref={logoImgRef} />
        </a>

        <div className="pill-nav-items desktop-only" ref={navItemsRef}>
          <ul className="pill-list" role="menubar">
            {items.map((item, i) => (
              <li key={item.href || `item-${i}`} role="none">
                {renderPill(item, i)}
              </li>
            ))}
          </ul>
        </div>

        {rightContent && (
          <div className="pill-nav-right desktop-only">{rightContent}</div>
        )}

        <button className="pill-hamburger mobile-only" onClick={toggleMobileMenu}
          aria-label="Toggle menu" ref={hamburgerRef}>
          <span className="hamburger-line" />
          <span className="hamburger-line" />
        </button>
      </nav>

      <div className="mobile-menu-popover mobile-only" ref={mobileMenuRef} style={cssVars}>
        <ul className="mobile-menu-list">
          {items.map((item, i) => (
            <li key={item.href || `mobile-${i}`}>
              {isHashOrExternal(item.href) ? (
                <a href={item.href}
                  className={`mobile-menu-link${activeHref === item.href ? ' is-active' : ''}`}
                  onClick={() => setIsMobileMenuOpen(false)}>{item.label}</a>
              ) : (
                <Link href={item.href}
                  className={`mobile-menu-link${activeHref === item.href ? ' is-active' : ''}`}
                  onClick={() => setIsMobileMenuOpen(false)}>{item.label}</Link>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export default PillNav
