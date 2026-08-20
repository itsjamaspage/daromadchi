/**
 * READ-ONLY probe: does a token-legitimate Uzum payout signal exist?
 *
 * Three checks, in order, none of which changes anything — no DB writes, no
 * marketplace writes, and (see CHECK 3) no POST is ever sent.
 *
 *   CHECK 1  Dump the OpenAPI spec we already download every 6h and discard:
 *            every path, the AUTHORITATIVE finance status enum, and the full
 *            detail of every finance/payout-shaped path.
 *   CHECK 2  GET /v1/finance/expenses once — in our spec, never read.
 *   CHECK 3  For each payout candidate: GET it, then report what the SPEC says
 *            about its POST operation. Sends no POST. Prints the allowlist lines
 *            the owner would need to approve, with the evidence to judge them.
 *
 * ── Why CHECK 3 reports instead of probing ──────────────────────────────────
 * A POST to /v1/finance/payments could list payments or CREATE one. Nothing we
 * have observed distinguishes those, and lib/marketplace-readonly-guard.ts is
 * owner-set precisely so that guess cannot be made casually. CHECK 1 settles it
 * for free: the spec declares each POST's operationId, summary and request body.
 * So this script gathers the evidence and stops. Allowlisting comes after, as a
 * deliberate act, with the operationId in hand.
 *
 * Run on the VPS (needs DATABASE_URL + ENCRYPTION_KEY + outbound):
 *   set -a; . ./.env; set +a
 *   ./node_modules/.bin/tsx scripts/probe-uzum-payout-surface.ts
 *   ./node_modules/.bin/tsx scripts/probe-uzum-payout-surface.ts > /tmp/uzum-probe.json
 */
import { and, eq } from 'drizzle-orm'
import { db, shops } from '@/lib/db'
import { decrypt } from '@/lib/crypto'
import { marketplaceFetch } from '@/lib/marketplace-readonly-guard'
import { UZUM_API_BASE } from '@/lib/uzum/client'

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * The statuses lib/uzum/client.ts:292 sends on every finance/orders call. Copied
 * here (not imported — it is not exported, and this probe must not edit product
 * code) so CHECK 1 can diff it against what the spec actually declares. If these
 * two disagree, we have been filtering out real rows.
 */
const OUR_FINANCE_STATUSES = ['TO_WITHDRAW', 'PROCESSING', 'CANCELED', 'PARTIALLY_CANCELLED']

/** Paths §0 of the payouts plan probed and got 403 RBAC on. */
const PAYOUT_CANDIDATES = [
  '/v1/finance/payments',
  '/v1/finance/payouts',
  '/v1/finance/withdrawals',
  '/v1/finance/operations',
  '/v1/finance/transactions',
  '/v1/finance/balance',
  '/v1/seller/payouts',
  '/v1/payout/list',
  '/v1/finance/payment-history',
]

const FINANCE_KEYWORDS = /financ|balance|payment|payout|transaction|operation|settlement|accrual|report|earning|withdraw|invoice/i

/**
 * Fixture seam. Defaults to the real API; overridden ONLY by
 * scripts/probe-uzum-payout-surface.fixture.mjs, which serves a spec-shaped
 * response locally so the parser and the POST classifier can be exercised
 * without an Uzum round-trip. Never set in production.
 */
const API_BASE = process.env.UZUM_PROBE_BASE ?? UZUM_API_BASE

const out: Record<string, unknown> = {}
const log = (...a: unknown[]) => console.error(...a)   // progress → stderr, JSON → stdout

/* ── plumbing ─────────────────────────────────────────────────────────────── */

interface Hit { status: number; ok: boolean; body: string; json: any; from: 'uzum' | 'local' | 'network' }

/**
 * Did this response come from Uzum, or from something between us and Uzum?
 *
 * This distinction is load-bearing. A corporate proxy, an egress allowlist or a
 * WAF answers 403 too, and a 403 is EXACTLY the signal this investigation turns
 * on — "403 RBAC" is what the payout-history verdict rests on. Reading a
 * proxy's 403 as Uzum's would manufacture evidence for a conclusion that was
 * never tested. Uzum's own errors are JSON with an `errors`/`payload`/`title`
 * envelope; anything else at this layer is somebody else talking.
 */
function originOf(status: number, body: string, json: any): 'uzum' | 'network' {
  if (json && typeof json === 'object' && ('errors' in json || 'payload' in json || 'title' in json || 'timestamp' in json)) return 'uzum'
  if (status === 200) return 'uzum'
  if (/not in allowlist|egress|proxy|tunnel|CONNECT|gateway|certificate/i.test(body)) return 'network'
  // An empty or HTML body on a 4xx/5xx is not something Uzum's JSON API sends.
  if (!body.trim() || /^\s*<(!doctype|html)/i.test(body)) return 'network'
  return 'uzum'
}

async function get(path: string, token: string): Promise<Hit> {
  try {
    const res = await marketplaceFetch(`${API_BASE}${path}`, {
      headers: { Authorization: token.trim(), Accept: 'application/json' },
      next: { revalidate: 0 },
    } as any)
    const body = await res.text().catch(() => '')
    let json: any = null
    try { json = JSON.parse(body) } catch { /* non-JSON */ }
    const snippet = body.slice(0, 500)
    return { status: res.status, ok: res.ok, body: snippet, json, from: originOf(res.status, snippet, json) }
  } catch (e) {
    // A read-only-guard rejection lands here. It never reached Uzum, and must
    // never be recorded as an Uzum answer — that misreading is what left the
    // POST half of the finance discovery looking like it had been tried.
    return { status: 0, ok: false, body: `LOCAL: ${String(e).slice(0, 300)}`, json: null, from: 'local' }
  }
}

const resolveRef = (spec: any, node: any, depth = 0): any => {
  if (depth > 8 || node == null || typeof node !== 'object') return node
  if (typeof node.$ref === 'string') {
    let cur: any = spec
    for (const part of node.$ref.replace(/^#\//, '').split('/')) cur = cur?.[part]
    return resolveRef(spec, cur, depth + 1)
  }
  return node
}

/** Field names + types + enums, two levels deep. Enough to spot an unmapped field. */
function describe(spec: any, schema: any, depth = 0): any {
  schema = resolveRef(spec, schema)
  if (!schema || typeof schema !== 'object') return null
  if (schema.type === 'array' || schema.items) {
    return { type: 'array', items: depth < 3 ? describe(spec, schema.items, depth + 1) : '…' }
  }
  const props = schema.properties
  if (!props || typeof props !== 'object') {
    return { type: schema.type ?? 'unknown', ...(schema.enum ? { enum: schema.enum } : {}) }
  }
  const o: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(props)) {
    const rv = resolveRef(spec, v)
    o[k] = depth < 2 && rv && (rv.type === 'array' || rv.properties)
      ? describe(spec, rv, depth + 1)
      : { type: rv?.type ?? 'unknown', ...(rv?.format ? { format: rv.format } : {}), ...(rv?.enum ? { enum: rv.enum } : {}) }
  }
  return { type: 'object', required: schema.required ?? [], properties: o }
}

/**
 * Is this operation a READ that happens to need POST, or a mutation?
 * Decided from the spec's own words — never from the path name, which is what
 * makes /v1/finance/payments ambiguous in the first place.
 */
export function classifyPost(op: any): { verdict: 'read' | 'write' | 'unclear'; why: string } {
  // Split camelCase/snake_case into words BEFORE matching. Without this,
  // \bcreate\b never matches inside "createPayout" and the operationId — the
  // most reliable field in the whole spec — classifies as unclear.
  const raw = `${op?.operationId ?? ''} ${op?.summary ?? ''} ${op?.description ?? ''}`
  const text = raw
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
  if (!text.trim()) return { verdict: 'unclear', why: 'spec declares no operationId/summary/description' }
  // Checked FIRST, so a mixed "get or create" resolves to write. The bias is
  // deliberate: a false 'write' costs a question to Uzum, a false 'read' could
  // put a mutating endpoint in the guard's allowlist.
  if (/\b(create|add|new|register|issue|initiate|submit|send|withdraw|withdrawal|order|update|set|change|cancel|delete)\b/.test(text)) {
    return { verdict: 'write', why: `mutation verb in "${text.trim().slice(0, 120)}"` }
  }
  if (/\b(get|list|search|find|fetch|retrieve|history|report|view|filter|page)\b/.test(text)) {
    return { verdict: 'read', why: `read verb in "${text.trim().slice(0, 120)}"` }
  }
  return { verdict: 'unclear', why: `no decisive verb in "${text.trim().slice(0, 120)}"` }
}

/* ── main ─────────────────────────────────────────────────────────────────── */

async function main() {
  const [shop] = await db.select({ id: shops.id, name: shops.name, ext: shops.shop_id_external, enc: shops.api_key_encrypted })
    .from(shops).where(and(eq(shops.marketplace, 'uzum'), eq(shops.is_active, true)))
  if (!shop?.enc) { log('No active Uzum shop with a token.'); process.exit(1) }
  const token = decrypt(shop.enc)
  const shopIds = shop.ext && /^\d+$/.test(shop.ext) ? [Number(shop.ext)] : []
  out.shop = { id: shop.id, name: shop.name, uzumShopIds: shopIds }
  log(`shop=${shop.name ?? shop.id} uzumShopIds=[${shopIds}]`)

  /* ── CHECK 1 — the spec we already download and discard ─────────────────── */
  log('\nCHECK 1: OpenAPI spec')
  let spec: any = null
  let specPath: string | null = null
  const specAttempts: { path: string; status: number; from: string; body: string }[] = []
  for (const p of ['/swagger/v3/api-docs', '/swagger/api-docs', '/swagger/v2/api-docs', '/v3/api-docs', '/api-docs', '/swagger/v1/api-docs']) {
    const h = await get(p, token)
    if (h.ok && h.json && (h.json.paths || h.json.openapi || h.json.swagger)) { spec = h.json; specPath = p; break }
    specAttempts.push({ path: p, status: h.status, from: h.from, body: h.body.slice(0, 160) })
    log(`  ${p} → ${h.status} (${h.from})`)
  }

  if (!spec) {
    const reachedUzum = specAttempts.some(a => a.from === 'uzum')
    out.check1 = {
      ok: false,
      error: reachedUzum
        ? 'Uzum answered, but served no OpenAPI spec on any candidate path'
        : 'NEVER REACHED UZUM — every attempt was answered by the network, not the API',
      reachedUzum, attempts: specAttempts,
    }
    if (!reachedUzum) {
      // Stop. Every downstream verdict would be about the network, dressed up
      // as a finding about Uzum's API.
      out.aborted = 'No response in this run came from Uzum. Run this on the VPS, where outbound to api-seller.uzum.uz is open. No conclusions are drawn below.'
      log('  ABORT — nothing reached Uzum (network answered every attempt). Run on the VPS.')
      console.log(JSON.stringify(out, null, 2))
      process.exit(2)
    }
    log('  SPEC UNREACHABLE — checks 1 and 3 cannot be answered.')
  } else {
    const paths = spec.paths ?? {}
    const allPaths = Object.entries(paths)
      .map(([p, ops]) => ({ path: p, methods: Object.keys(ops as object).filter(m => ['get', 'post', 'put', 'patch', 'delete'].includes(m)) }))
      .sort((a, b) => a.path.localeCompare(b.path))

    // Every finance-shaped path, in full: what it takes, what it returns.
    const financePaths = allPaths.filter(p => FINANCE_KEYWORDS.test(p.path)).map(({ path, methods }) => ({
      path,
      operations: methods.map(m => {
        const op = (paths[path] as any)[m]
        return {
          method: m.toUpperCase(),
          operationId: op?.operationId ?? null,
          summary: op?.summary ?? null,
          description: op?.description ?? null,
          parameters: (op?.parameters ?? []).map((raw: any) => {
            const pr = resolveRef(spec, raw)
            let s = resolveRef(spec, pr?.schema)
            if (s?.type === 'array') s = resolveRef(spec, s.items)
            return { name: pr?.name, in: pr?.in, required: pr?.required ?? false, type: s?.type ?? null, enum: s?.enum ?? null }
          }),
          requestBody: op?.requestBody?.content?.['application/json']?.schema
            ? describe(spec, op.requestBody.content['application/json'].schema) : null,
          response200: describe(spec, op?.responses?.['200']?.content?.['application/json']?.schema),
        }
      }),
    }))

    // The authoritative finance status enum — the thing client.ts:292 asserts
    // but never reads. Pulled from the finance/orders `statuses` parameter.
    let specStatuses: string[] | null = null
    for (const fp of financePaths) {
      if (!/\/finance\/orders\/?$/.test(fp.path)) continue
      for (const op of fp.operations) {
        const p = op.parameters.find((x: any) => x.name === 'statuses' || x.name === 'status')
        if (p?.enum?.length) { specStatuses = p.enum.map(String); break }
      }
    }
    const missing = specStatuses ? specStatuses.filter(s => !OUR_FINANCE_STATUSES.includes(s)) : []
    const stale   = specStatuses ? OUR_FINANCE_STATUSES.filter(s => !specStatuses!.includes(s)) : []

    out.check1 = {
      ok: true, specPath, totalPaths: allPaths.length,
      financeStatusEnum: {
        fromSpec: specStatuses,
        weSend: OUR_FINANCE_STATUSES,
        // Non-empty `missingFromOurs` = we have been filtering out real rows,
        // and one of them could be the withdrawn state this whole hunt is for.
        missingFromOurs: missing,
        weSendButSpecDoesNotDeclare: stale,
        verdict: specStatuses == null ? 'spec does not declare the enum'
          : missing.length ? 'DRIFT — spec has statuses we never request'
          : 'our list matches the spec',
      },
      financePaths,
      allPaths,
    }
    log(`  spec=${specPath} paths=${allPaths.length} finance-shaped=${financePaths.length}`)
    log(`  status enum: spec=${JSON.stringify(specStatuses)} missingFromOurs=${JSON.stringify(missing)}`)
  }

  /* ── CHECK 2 — /v1/finance/expenses, never read before ──────────────────── */
  log('\nCHECK 2: /v1/finance/expenses')
  const YEAR = 365 * 24 * 60 * 60 * 1000
  const qs = new URLSearchParams({ page: '0', size: '100' })
  for (const id of shopIds) qs.append('shopIds', String(id))
  qs.set('dateFrom', String(Date.now() - YEAR))
  qs.set('dateTo', String(Date.now()))
  const exp = await get(`/v1/finance/expenses?${qs}`, token)

  // Find the row array wherever Uzum put it (this feed is double-wrapped in at
  // least one observed shape — see client.ts:277).
  const findRows = (j: any): any[] => {
    if (Array.isArray(j)) return j
    for (const node of [j, j?.payload, j?.data, j?.payload?.data]) {
      if (!node || typeof node !== 'object') continue
      for (const v of Object.values(node)) if (Array.isArray(v) && v.length) return v as any[]
    }
    return []
  }
  const rows = exp.ok ? findRows(exp.json) : []
  const keys = new Set<string>()
  const enums: Record<string, Set<string>> = {}
  for (const r of rows) {
    if (!r || typeof r !== 'object') continue
    for (const [k, v] of Object.entries(r)) {
      keys.add(k)
      // Collect distinct values of every short string field — a withdrawal row
      // type would show up here as an OUTCOME/WITHDRAWAL/PAYOUT value.
      if (typeof v === 'string' && v.length <= 40) (enums[k] ??= new Set()).add(v)
    }
  }
  out.check2 = {
    ok: exp.ok, httpStatus: exp.status, from: exp.from,
    envelopeKeys: exp.json && typeof exp.json === 'object' ? Object.keys(exp.json) : null,
    rowCount: rows.length,
    allRowKeys: [...keys].sort(),
    distinctStringValues: Object.fromEntries(Object.entries(enums).map(([k, v]) => [k, [...v].slice(0, 25)])),
    // The question this check exists to answer. Deliberately NOT matching the
    // generic OUTCOME/расход direction — every ad charge is an outcome too, and
    // a bucket that catches those reads like a hit when it is noise.
    rowsMentioningWithdrawal: rows.filter(r =>
      /withdraw|payout|вывод|выплат|перевод/i.test(JSON.stringify(r ?? {}))).slice(0, 20),
    // One page only. If the feed filled it, there may be older rows unseen.
    possiblyTruncated: rows.length >= 100,
    sampleRows: rows.slice(0, 5),
    bodyIfFailed: exp.ok ? undefined : exp.body,
  }
  log(`  → ${exp.status} (${exp.from}) rows=${rows.length} keys=${[...keys].sort().join(',') || '—'}`)

  /* ── CHECK 3 — payout candidates: GET live, POST only per the spec ──────── */
  log('\nCHECK 3: payout candidates (GET live; POST reported, NOT sent)')
  const specPaths = spec?.paths ?? {}
  const candidates = []
  for (const path of PAYOUT_CANDIDATES) {
    const h = await get(`${path}?${qs}`, token)
    const declared = specPaths[path] ?? null
    const postOp = declared?.post ?? null
    const cls = postOp ? classifyPost(postOp) : null
    candidates.push({
      path,
      // `from` guards the headline finding: only a 403 Uzum itself sent is
      // evidence of an RBAC denial.
      get: { httpStatus: h.status, ok: h.ok, from: h.from, body: h.body },
      isGenuineUzumRbacDenial: h.status === 403 && h.from === 'uzum',
      inSpec: declared != null,
      specMethods: declared ? Object.keys(declared) : [],
      post: postOp ? {
        operationId: postOp.operationId ?? null,
        summary: postOp.summary ?? null,
        requestBody: postOp.requestBody?.content?.['application/json']?.schema
          ? describe(spec, postOp.requestBody.content['application/json'].schema) : null,
        classification: cls,
        // Only a spec-proven READ is worth putting in front of the owner.
        allowlistLineIfApproved: cls?.verdict === 'read'
          ? `/api-seller\\.uzum\\.uz\\/api\\/seller-openapi${path.replace(/\//g, '\\/')}/`
          : null,
      } : null,
      verdict: !spec ? 'spec unreachable — cannot judge whether a POST exists'
        : !declared ? 'not in this token\'s spec — no POST to try'
        : !postOp ? 'in spec, but declares no POST operation'
        : cls!.verdict === 'read' ? 'SPEC SAYS READ — candidate for the allowlist'
        : cls!.verdict === 'write' ? 'SPEC SAYS MUTATION — must never be allowlisted'
        : 'UNCLEAR — do not allowlist without asking Uzum',
    })
    log(`  ${path} → GET ${h.status} (${h.from}) | ${candidates[candidates.length - 1].verdict}`)
    await new Promise(r => setTimeout(r, 400))   // be polite to the rate limiter
  }
  out.check3 = {
    note: 'No POST was sent by this script. Verdicts come from the OpenAPI spec.',
    candidates,
    readShapedPosts: candidates.filter(c => c.post?.classification?.verdict === 'read').map(c => c.path),
  }

  console.log(JSON.stringify(out, null, 2))
  process.exit(0)
}

// Only run when executed directly — importing this file (the classifier test
// does) must not open a DB connection or touch the network.
if (process.argv[1] && /probe-uzum-payout-surface\.ts$/.test(process.argv[1])) {
  main().catch((e) => { console.error(e); process.exit(1) })
}
