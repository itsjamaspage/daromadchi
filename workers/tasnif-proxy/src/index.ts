const TASNIF_BASE = 'https://tasnif.soliq.uz/api/cls-api'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'

interface Env {
  ALLOWED_ORIGIN: string
}

function corsHeaders(origin: string, allowedOrigin: string): Record<string, string> {
  const allowed = allowedOrigin === '*' || origin === allowedOrigin
    || origin === allowedOrigin.replace('https://', 'https://www.')
  return {
    'Access-Control-Allow-Origin': allowed ? origin : allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin') ?? ''
    const cors = corsHeaders(origin, env.ALLOWED_ORIGIN)

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors })
    }

    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405, headers: cors })
    }

    const url = new URL(request.url)
    const path = url.pathname === '/' ? '' : url.pathname
    const targetUrl = `${TASNIF_BASE}${path}${url.search}`

    try {
      const response = await fetch(targetUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': UA,
          'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
          'Referer': 'https://tasnif.soliq.uz/',
          'Origin': 'https://tasnif.soliq.uz',
        },
      })

      const body = await response.text()
      return new Response(body, {
        status: response.status,
        headers: {
          'Content-Type': response.headers.get('Content-Type') ?? 'application/json',
          'Cache-Control': 'public, max-age=60',
          ...cors,
        },
      })
    } catch {
      return new Response(
        JSON.stringify({ error: 'upstream_error', message: 'Failed to reach tasnif.soliq.uz' }),
        { status: 502, headers: { 'Content-Type': 'application/json', ...cors } },
      )
    }
  },
}
