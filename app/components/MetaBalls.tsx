/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
'use client'

import { useEffect, useRef } from 'react'

interface MetaBallsProps {
  color?: string
  speed?: number
  enableMouseInteraction?: boolean
  hoverSmoothness?: number
  animateOnce?: boolean
  padding?: number
  maxRadius?: number
}

export default function MetaBalls({
  color = '#00d4ff',
  speed = 0.3,
  enableMouseInteraction = true,
  hoverSmoothness = 0.05,
  animateOnce = false,
  padding = 3,
  maxRadius = 30,
}: MetaBallsProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let active = true
    let raf = 0

    const run = async () => {
      const { Renderer, Program, Mesh, Triangle, Vec2 } = await import('ogl')
      const container = containerRef.current
      if (!container || !active) return

      const renderer = new Renderer({ dpr: Math.min(window.devicePixelRatio || 1, 2), alpha: true })
      const gl = renderer.gl
      gl.clearColor(0, 0, 0, 0)
      container.appendChild(gl.canvas)
      gl.canvas.style.width = '100%'
      gl.canvas.style.height = '100%'

      function hexToRgb(hex: string) {
        const v = hex.replace('#', '')
        return {
          r: parseInt(v.slice(0, 2), 16) / 255,
          g: parseInt(v.slice(2, 4), 16) / 255,
          b: parseInt(v.slice(4, 6), 16) / 255,
        }
      }
      const rgb = hexToRgb(color)

      const NUM_METABALLS = 8
      type Ball = { x: number; y: number; vx: number; vy: number; r: number }
      const balls: Ball[] = []

      const resize = () => {
        if (!active) return
        const w = container.clientWidth || window.innerWidth
        const h = container.clientHeight || window.innerHeight
        renderer.setSize(w, h)
        for (let i = 0; i < NUM_METABALLS; i++) {
          balls[i] = balls[i] ?? {
            x: Math.random() * w,
            y: Math.random() * h,
            vx: (Math.random() - 0.5) * speed * 2,
            vy: (Math.random() - 0.5) * speed * 2,
            r: Math.random() * (maxRadius - 15) + 15,
          }
          balls[i].x = Math.max(balls[i].r, Math.min(w - balls[i].r, balls[i].x))
          balls[i].y = Math.max(balls[i].r, Math.min(h - balls[i].r, balls[i].y))
        }
      }

      for (let i = 0; i < NUM_METABALLS; i++) {
        const w = container.clientWidth || window.innerWidth
        const h = container.clientHeight || window.innerHeight
        balls.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * speed * 2,
          vy: (Math.random() - 0.5) * speed * 2,
          r: Math.random() * (maxRadius - 15) + 15,
        })
      }

      const ro = typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => { if (active) resize() })
        : null
      if (ro) ro.observe(container)
      resize()

      // Flatten ball data into uniform arrays
      const ballPositions = new Float32Array(NUM_METABALLS * 2)
      const ballRadii = new Float32Array(NUM_METABALLS)

      const vertex = /* glsl */`
        attribute vec2 position;
        varying vec2 vUv;
        void main() {
          vUv = position * 0.5 + 0.5;
          gl_Position = vec4(position, 0.0, 1.0);
        }
      `
      const fragment = /* glsl */`
        precision highp float;
        varying vec2 vUv;
        uniform vec2 uResolution;
        uniform vec2 uBalls[${NUM_METABALLS}];
        uniform float uRadii[${NUM_METABALLS}];
        uniform vec3 uColor;
        uniform float uPadding;

        void main() {
          vec2 px = vUv * uResolution;
          float sum = 0.0;
          for (int i = 0; i < ${NUM_METABALLS}; i++) {
            float d = distance(px, uBalls[i]);
            float r = uRadii[i] + uPadding;
            sum += (r * r) / max(d * d, 0.0001);
          }
          float alpha = smoothstep(0.9, 1.1, sum);
          gl_FragColor = vec4(uColor, alpha);
        }
      `

      const geometry = new Triangle(gl)
      const program = new Program(gl, {
        vertex,
        fragment,
        uniforms: {
          uResolution: { value: new Vec2(gl.canvas.width, gl.canvas.height) },
          uBalls:  { value: ballPositions },
          uRadii:  { value: ballRadii },
          uColor:  { value: [rgb.r, rgb.g, rgb.b] },
          uPadding: { value: padding },
        },
        transparent: true,
        depthTest: false,
      })
      const mesh = new Mesh(gl, { geometry, program })

      // Mouse interaction
      const mouse = { x: -9999, y: -9999 }
      const currentMouse = { x: -9999, y: -9999 }
      const handlePointerMove = (e: PointerEvent) => {
        const rect = gl.canvas.getBoundingClientRect()
        mouse.x = e.clientX - rect.left
        mouse.y = e.clientY - rect.top
      }
      if (enableMouseInteraction) {
        gl.canvas.addEventListener('pointermove', handlePointerMove)
      }

      const loop = () => {
        if (!active) return
        const w = gl.canvas.width / renderer.dpr
        const h = gl.canvas.height / renderer.dpr

        // Smooth mouse
        if (enableMouseInteraction) {
          currentMouse.x += (mouse.x - currentMouse.x) * hoverSmoothness
          currentMouse.y += (mouse.y - currentMouse.y) * hoverSmoothness
        }

        for (let i = 0; i < NUM_METABALLS; i++) {
          const b = balls[i]
          // Mouse repulsion
          if (enableMouseInteraction && currentMouse.x > 0) {
            const dx = b.x - currentMouse.x
            const dy = b.y - currentMouse.y
            const dist = Math.sqrt(dx * dx + dy * dy)
            if (dist < 100) {
              const force = (100 - dist) / 100 * 0.5
              b.vx += (dx / dist) * force
              b.vy += (dy / dist) * force
            }
          }
          b.x += b.vx * speed
          b.y += b.vy * speed
          // Bounce
          if (b.x - b.r < 0) { b.x = b.r; b.vx = Math.abs(b.vx) }
          if (b.x + b.r > w) { b.x = w - b.r; b.vx = -Math.abs(b.vx) }
          if (b.y - b.r < 0) { b.y = b.r; b.vy = Math.abs(b.vy) }
          if (b.y + b.r > h) { b.y = h - b.r; b.vy = -Math.abs(b.vy) }
          // Clamp velocity
          const spd = Math.sqrt(b.vx * b.vx + b.vy * b.vy)
          const maxSpd = speed * 3
          if (spd > maxSpd) { b.vx = (b.vx / spd) * maxSpd; b.vy = (b.vy / spd) * maxSpd }

          ballPositions[i * 2]     = b.x * renderer.dpr
          ballPositions[i * 2 + 1] = (h - b.y) * renderer.dpr
          ballRadii[i] = b.r * renderer.dpr
        }

        program.uniforms.uResolution.value.set(gl.canvas.width, gl.canvas.height)
        program.uniforms.uPadding.value = padding * renderer.dpr

        gl.clear(gl.COLOR_BUFFER_BIT)
        renderer.render({ scene: mesh })
        raf = requestAnimationFrame(loop)
      }
      loop()

      return () => {
        if (ro) ro.disconnect()
        if (enableMouseInteraction) gl.canvas.removeEventListener('pointermove', handlePointerMove)
        gl.canvas.parentElement?.removeChild(gl.canvas)
      }
    }

    let cleanup: (() => void) | undefined
    run().then(c => { cleanup = c })

    return () => {
      active = false
      cancelAnimationFrame(raf)
      cleanup?.()
    }
   
  }, [color, speed, enableMouseInteraction, hoverSmoothness, padding, maxRadius])

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}
    />
  )
}
