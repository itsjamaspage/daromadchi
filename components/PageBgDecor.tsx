'use client'
interface Props { isDark: boolean }
export function PageBgDecor(_: Props) { return null }


interface Props { isDark: boolean }

interface Bubble {
  x: number; y: number; r: number
  vx: number; vy: number
  color: string; sw: number
}

interface LineAnim {
  x1: number; x2: number
  color: string; width: number
  speed: number; dir: 1 | -1
  y: number
}

const SEG = 320  // visible px-length of each line segment

export function PageBgDecor({ isDark }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let W = 0, H = 0
    const resize = () => {
      W = window.innerWidth
      H = window.innerHeight
      canvas.width  = W
      canvas.height = H
    }
    resize()
    window.addEventListener('resize', resize)

    /* ── Palette ───────────────────────────────────────────────── */
    const palette = isDark
      ? ['#00d4ff','#ff2d9b','#3b82f6','#a855f7','#00ffb3','#6366f1','#ff7c3a','#22d3ee']
      : ['#7c3aed','#db2777','#3b82f6','#8b5cf6','#0d9488','#6366f1','#ec4899','#2563eb']

    /* ── Bubbles — scattered across full viewport ──────────────── */
    const NUM = 13
    const bubbles: Bubble[] = []
    for (let i = 0; i < NUM; i++) {
      const r  = 24 + Math.random() * 58
      const vx = (Math.random() - 0.5) * 1.4
      const vy = (Math.random() - 0.5) * 1.4
      bubbles.push({
        x:  r + Math.random() * (W - 2 * r),
        y:  r + Math.random() * (H - 2 * r),
        r, vx, vy,
        color: palette[i % palette.length],
        sw: isDark ? 1.5 + Math.random() * 0.8 : 1.2 + Math.random() * 0.4,
      })
    }

    /* ── Diagonal lines: left zone (x < 540) ──────────────────── */
    const lineDefs = isDark ? [
      { x1: 140, x2: 260, color: '#3B82F6', width: 3,   speed: 1.2,  dir:  1 as const },
      { x1: 390, x2: 280, color: '#2563EB', width: 2.5, speed: 0.85, dir:  1 as const },
      { x1: 75,  x2: 95,  color: '#6366F1', width: 2.5, speed: 1.45, dir: -1 as const },
      { x1: 490, x2: 510, color: '#4F46E5', width: 2,   speed: 1.0,  dir: -1 as const },
    ] : [
      { x1: 140, x2: 260, color: '#7C3AED', width: 2,   speed: 1.2,  dir:  1 as const },
      { x1: 390, x2: 280, color: '#6D28D9', width: 1.5, speed: 0.85, dir:  1 as const },
      { x1: 75,  x2: 95,  color: '#8B5CF6', width: 1.5, speed: 1.45, dir: -1 as const },
      { x1: 490, x2: 510, color: '#6366F1', width: 1.5, speed: 1.0,  dir: -1 as const },
    ]

    const lines: LineAnim[] = lineDefs.map((l, i) => ({
      ...l, y: -SEG - 300 + i * 320,
    }))

    /* ── Elastic collision between two bubbles ─────────────────── */
    function collide(a: Bubble, b: Bubble) {
      const dx   = b.x - a.x
      const dy   = b.y - a.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist === 0 || dist >= a.r + b.r) return
      const nx = dx / dist
      const ny = dy / dist
      const dvn = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny
      if (dvn > 0) return                   // already separating
      a.vx -= dvn * nx;  a.vy -= dvn * ny
      b.vx += dvn * nx;  b.vy += dvn * ny
      const sep = (a.r + b.r - dist) * 0.5
      a.x -= sep * nx;  a.y -= sep * ny
      b.x += sep * nx;  b.y += sep * ny
    }

    /* ── RAF loop ──────────────────────────────────────────────── */
    let raf: number
    const FADE = 220

    function tick() {
      raf = requestAnimationFrame(tick)
      ctx.clearRect(0, 0, W, H)

      /* Lines */
      for (const l of lines) {
        l.y += l.speed * l.dir
        if (l.dir ===  1 && l.y > H + 300)    l.y = -SEG - 300
        if (l.dir === -1 && l.y < -SEG - 300) l.y =  H + 300

        const midY = l.y + SEG / 2
        let alpha = isDark ? 0.70 : 0.38
        if (midY < FADE)      alpha *= Math.max(0, midY / FADE)
        if (midY > H - FADE)  alpha *= Math.max(0, (H - midY) / FADE)
        if (alpha < 0.01) continue

        ctx.save()
        ctx.globalAlpha = alpha
        if (isDark) { ctx.shadowColor = l.color; ctx.shadowBlur = 10 }
        ctx.strokeStyle = l.color
        ctx.lineWidth   = l.width
        ctx.lineCap     = 'round'
        ctx.beginPath()
        ctx.moveTo(l.x1, l.y)
        ctx.lineTo(l.x2, l.y + SEG)
        ctx.stroke()
        ctx.restore()
      }

      /* Move + wall-bounce */
      for (const b of bubbles) {
        b.x += b.vx;  b.y += b.vy
        if (b.x - b.r < 0)  { b.x = b.r;      b.vx =  Math.abs(b.vx) }
        if (b.x + b.r > W)  { b.x = W - b.r;  b.vx = -Math.abs(b.vx) }
        if (b.y - b.r < 0)  { b.y = b.r;      b.vy =  Math.abs(b.vy) }
        if (b.y + b.r > H)  { b.y = H - b.r;  b.vy = -Math.abs(b.vy) }
      }

      /* Bubble-bubble collisions */
      for (let i = 0; i < bubbles.length; i++)
        for (let j = i + 1; j < bubbles.length; j++)
          collide(bubbles[i], bubbles[j])

      /* Draw bubbles */
      for (const b of bubbles) {
        ctx.save()
        if (isDark) { ctx.shadowColor = b.color; ctx.shadowBlur = 22 }
        ctx.strokeStyle = b.color
        ctx.lineWidth   = b.sw
        ctx.globalAlpha = isDark ? 0.60 : 0.40
        ctx.beginPath()
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2)
        ctx.stroke()
        ctx.restore()
      }
    }

    tick()

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [isDark])

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: -1, pointerEvents: 'none', overflow: 'hidden' }}
      aria-hidden="true"
    >
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      />
    </div>
  )
}
