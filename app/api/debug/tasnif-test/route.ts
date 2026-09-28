import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { resolve } from 'node:dns/promises'
import { connect } from 'node:net'

export const runtime = 'nodejs'

async function testDns(): Promise<{ ok: boolean; addresses?: string[]; error?: string }> {
  try {
    const addresses = await resolve('tasnif.soliq.uz')
    return { ok: true, addresses }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

async function testTcp(host: string, port: number, timeoutMs = 5000): Promise<{ ok: boolean; ms?: number; error?: string }> {
  return new Promise((res) => {
    const start = Date.now()
    const sock = connect({ host, port, timeout: timeoutMs })
    sock.on('connect', () => {
      const ms = Date.now() - start
      sock.destroy()
      res({ ok: true, ms })
    })
    sock.on('timeout', () => {
      sock.destroy()
      res({ ok: false, error: `TCP timeout after ${timeoutMs}ms` })
    })
    sock.on('error', (err) => {
      res({ ok: false, error: err.message })
    })
  })
}

async function testFetch(): Promise<{ ok: boolean; status?: number; bodyPreview?: string; error?: string; cause?: string }> {
  try {
    const res = await fetch('https://tasnif.soliq.uz/api/cls-api/elasticsearch/search?search=test&lang=ru&size=1&page=0', {
      signal: AbortSignal.timeout(10_000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Referer': 'https://tasnif.soliq.uz/',
        'Origin': 'https://tasnif.soliq.uz',
      },
    })
    const text = await res.text()
    return { ok: res.ok, status: res.status, bodyPreview: text.slice(0, 300) }
  } catch (err) {
    const cause = err instanceof Error && err.cause
      ? (err.cause instanceof Error ? err.cause.message : String(err.cause))
      : undefined
    return { ok: false, error: err instanceof Error ? err.message : String(err), cause }
  }
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const dns = await testDns()
  const tcp = dns.ok && dns.addresses?.[0]
    ? await testTcp(dns.addresses[0], 443)
    : { ok: false, error: 'skipped (DNS failed)' }
  const http = await testFetch()

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    dns,
    tcp,
    fetch: http,
  }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
