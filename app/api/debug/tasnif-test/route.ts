import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { resolve } from 'node:dns/promises'
import { Resolver } from 'node:dns/promises'
import { connect } from 'node:net'
import * as https from 'node:https'

export const runtime = 'nodejs'

async function testSystemDns(): Promise<{ ok: boolean; addresses?: string[]; error?: string }> {
  try {
    const addresses = await resolve('tasnif.soliq.uz')
    return { ok: true, addresses }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

async function testFallbackDns(): Promise<{ ok: boolean; addresses?: string[]; error?: string }> {
  try {
    const resolver = new Resolver()
    resolver.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4'])
    const addresses = await resolver.resolve4('tasnif.soliq.uz')
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

async function testDirectHttps(ip: string): Promise<{ ok: boolean; status?: number; bodyPreview?: string; error?: string }> {
  return new Promise((res) => {
    const req = https.request(
      {
        hostname: ip,
        port: 443,
        path: '/api/cls-api/elasticsearch/search?search=test&lang=ru&size=1&page=0',
        method: 'GET',
        headers: {
          Host: 'tasnif.soliq.uz',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Referer': 'https://tasnif.soliq.uz/',
          'Origin': 'https://tasnif.soliq.uz',
        },
        servername: 'tasnif.soliq.uz',
        timeout: 10_000,
      },
      (response) => {
        const chunks: Buffer[] = []
        response.on('data', (c: Buffer) => chunks.push(c))
        response.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf-8')
          res({ ok: true, status: response.statusCode, bodyPreview: body.slice(0, 300) })
        })
      },
    )
    req.on('timeout', () => { req.destroy(); res({ ok: false, error: 'timeout after 10s' }) })
    req.on('error', (err) => res({ ok: false, error: err.message }))
    req.end()
  })
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const systemDns = await testSystemDns()
  const fallbackDns = await testFallbackDns()

  const resolvedIp = fallbackDns.ok && fallbackDns.addresses?.[0]
    ? fallbackDns.addresses[0]
    : systemDns.ok && systemDns.addresses?.[0]
      ? systemDns.addresses[0]
      : null

  const tcp = resolvedIp
    ? await testTcp(resolvedIp, 443)
    : { ok: false, error: 'skipped (DNS failed)' }

  const normalFetch = await testFetch()

  const directHttps = resolvedIp
    ? await testDirectHttps(resolvedIp)
    : { ok: false, error: 'skipped (no IP resolved)' }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    systemDns,
    fallbackDns,
    resolvedIp,
    tcp,
    normalFetch,
    directHttps,
  }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
