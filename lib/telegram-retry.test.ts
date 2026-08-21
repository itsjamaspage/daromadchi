// The transport must survive a hiccup. There is no queue behind sendTelegramMessage
// and no second chance later: a dropped send means the seller never hears about
// the order. These pin what is retried and — just as important — what is not,
// so a blocked chat cannot stall a cron loop over every seller.

import { test } from 'node:test'
import assert from 'node:assert/strict'

const ORIGINAL_FETCH = globalThis.fetch
process.env.TELEGRAM_BOT_TOKEN ??= 'test-token'

async function withFetch(
  impl: (call: number) => { ok: boolean; status: number; body?: unknown },
  run: () => Promise<boolean>,
): Promise<{ result: boolean; calls: number }> {
  let calls = 0
  globalThis.fetch = (async () => {
    const r = impl(calls++)
    return {
      ok: r.ok, status: r.status,
      clone: () => ({ json: async () => r.body ?? {} }),
      json: async () => r.body ?? {},
    } as unknown as Response
  }) as typeof fetch
  try { return { result: await run(), calls } }
  finally { globalThis.fetch = ORIGINAL_FETCH }
}

const send = async () => {
  const { sendTelegramMessage } = await import('./telegram')
  return sendTelegramMessage('123', 'hello')
}

test('a transient 5xx is retried and the message still gets through', async () => {
  const { result, calls } = await withFetch(
    c => c === 0 ? { ok: false, status: 503 } : { ok: true, status: 200 }, send)
  assert.equal(result, true, 'delivered on the retry')
  assert.equal(calls, 2)
})

test('a network throw is retried too — a blip must not drop an alert', async () => {
  let calls = 0
  globalThis.fetch = (async () => {
    if (calls++ === 0) throw new TypeError('fetch failed')
    return { ok: true, status: 200, clone: () => ({ json: async () => ({}) }) } as unknown as Response
  }) as typeof fetch
  try {
    assert.equal(await send(), true)
    assert.equal(calls, 2)
  } finally { globalThis.fetch = ORIGINAL_FETCH }
})

test('a permanent 400 is NOT retried — a blocked chat must not stall the loop', async () => {
  const { result, calls } = await withFetch(() => ({ ok: false, status: 400 }), send)
  assert.equal(result, false)
  assert.equal(calls, 1, 'one attempt only; retrying a blocked chat wastes the cron budget')
})

test('a 429 is retried, honouring retry_after but capped', async () => {
  const started = Date.now()
  const { result, calls } = await withFetch(
    c => c === 0 ? { ok: false, status: 429, body: { parameters: { retry_after: 1 } } }
                 : { ok: true, status: 200 }, send)
  assert.equal(result, true)
  assert.equal(calls, 2)
  assert.ok(Date.now() - started < 5000, 'a rate-limit wait is bounded, never open-ended')
})

test('it gives up after a bounded number of attempts rather than looping forever', async () => {
  const { result, calls } = await withFetch(() => ({ ok: false, status: 500 }), send)
  assert.equal(result, false)
  assert.equal(calls, 3)
})
