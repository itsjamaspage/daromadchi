// Focused, DB-free tests for the notification DIGEST builder — proving one
// combined message groups per sold SKU and reports each store's real result.
// The dedup/dispatch path (notifyStockUpdates) hits the DB and is covered by the
// integration path; here we lock the user-visible shape: one message, per-SKU
// sections, no per-write spam.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildDigestMessage, isRecentDuplicate, fingerprintOf, type StockUpdateEvent, type NotifyFingerprint } from './stock-notify'

const ev = (o: Partial<StockUpdateEvent> & { sku: string }): StockUpdateEvent => ({
  targetMarketplace: 'yandex_market',
  originMarketplace: 'uzum',
  listed: 1, target: 0, ok: true, available: 10,   // default >= 5 → no restock line
  ...o,
})

describe('buildDigestMessage', () => {
  it('combines both stores of one sold SKU into a single section', () => {
    const msg = buildDigestMessage([{
      sku: 'JMWHT',
      events: [
        ev({ sku: 'JMWHT', targetMarketplace: 'yandex_market', ok: true, listed: 1, target: 0 }),
        ev({ sku: 'JMWHT', targetMarketplace: 'uzum', ok: false, reason: 'http_400' }),
      ],
    }])
    // One header naming the sold SKU + origin, once.
    assert.equal(msg.split('JMWHT').length - 1, 1)
    assert.match(msg, /продажа на Uzum/)
    // Yandex succeeded 1→0; Uzum failed with a humanized HTTP reason.
    assert.match(msg, /✅ Yandex Market: 1→0/)
    assert.match(msg, /⚠️ Uzum: не обновлён \(ошибка API \(HTTP 400\)\) — обновите вручную/)
  })

  it('lists only the SKUs it was given, one section each (no per-write spam)', () => {
    const msg = buildDigestMessage([
      { sku: 'JMWHT', events: [ev({ sku: 'JMWHT', target: 0 })] },
      { sku: 'JMBLK', events: [ev({ sku: 'JMBLK', target: 2 })] },
    ])
    const bullets = msg.split('\n').filter(l => l.startsWith('• '))
    assert.equal(bullets.length, 2)
    assert.match(msg, /• JMWHT/)
    assert.match(msg, /• JMBLK/)
    // A single digest header, not one message per event.
    assert.equal(msg.split('📦').length - 1, 1)
  })

  it('renders full name, colour and price in the SKU header', () => {
    const msg = buildDigestMessage([{
      sku: 'JMBLK',
      events: [ev({
        sku: 'JMBLK', targetMarketplace: 'uzum', ok: true, listed: 2, target: 1,
        name: 'Куртка зимняя', colorKey: 'black', price: 450000,
      })],
    }])
    // • JMBLK — Куртка зимняя · Чёрный · 450 000 сум (продажа на Uzum):
    assert.match(msg, /• JMBLK — Куртка зимняя · Чёрный · 450 000 сум \(продажа на Uzum\):/)
    assert.match(msg, /✅ Uzum: 2→1/)
  })

  it('appends the restock warning when group free-to-sell < 5, omits it at >= 5', () => {
    const low = buildDigestMessage([{ sku: 'JMBLK', events: [ev({ sku: 'JMBLK', available: 3 })] }])
    assert.match(low, /⚠️ Осталось 3 — пополните склад/)
    const ok = buildDigestMessage([{ sku: 'JMBLK', events: [ev({ sku: 'JMBLK', available: 5 })] }])
    assert.doesNotMatch(ok, /пополните склад/)
  })

  it('humanizes known skip reasons', () => {
    const msg = buildDigestMessage([{
      sku: 'JMJ16BG',
      events: [ev({ sku: 'JMJ16BG', targetMarketplace: 'uzum', ok: false, reason: 'missing_barcode' })],
    }])
    assert.match(msg, /нет штрихкода/)
  })
})

describe('isRecentDuplicate — collapse the webhook+cron twin, keep genuine changes', () => {
  // Prior state helper: build the per-marketplace map from a set of events, aged.
  const prior = (events: StockUpdateEvent[], ageMs: number) => {
    const m = new Map<string, { fp: NotifyFingerprint; ageMs: number }>()
    for (const e of events) m.set(e.targetMarketplace, { fp: fingerprintOf(e), ageMs })
    return m
  }

  it('suppresses an IDENTICAL (status, target, available) digest within the window', () => {
    const evs = [
      ev({ sku: 'JMBLK', targetMarketplace: 'uzum', ok: true, target: 1, available: 1 }),
      ev({ sku: 'JMBLK', targetMarketplace: 'yandex_market', ok: true, target: 1, available: 1 }),
    ]
    // The cron fires 30s after the webhook already notified the same state.
    assert.equal(isRecentDuplicate(evs, prior(evs, 30_000)), true)
  })

  it('sends again when available CHANGED (a genuine new sale)', () => {
    const first = [
      ev({ sku: 'JMBLK', targetMarketplace: 'uzum', ok: true, target: 1, available: 1 }),
      ev({ sku: 'JMBLK', targetMarketplace: 'yandex_market', ok: true, target: 1, available: 1 }),
    ]
    const second = [
      ev({ sku: 'JMBLK', targetMarketplace: 'uzum', ok: true, target: 0, available: 0 }),
      ev({ sku: 'JMBLK', targetMarketplace: 'yandex_market', ok: true, target: 0, available: 0 }),
    ]
    // available 1 → 0: new key, not a duplicate.
    assert.equal(isRecentDuplicate(second, prior(first, 30_000)), false)
  })

  it('sends again when the SAME state recurs AFTER the window (a later, separate sellout)', () => {
    const evs = [ev({ sku: 'JMBLK', targetMarketplace: 'uzum', ok: true, target: 0, available: 0 })]
    // Identical state but the last notification was 11 min ago → not a twin.
    assert.equal(isRecentDuplicate(evs, prior(evs, 11 * 60 * 1000)), false)
  })

  it('sends when there is no prior state at all', () => {
    const evs = [ev({ sku: 'JMBLK', target: 1, available: 1 })]
    assert.equal(isRecentDuplicate(evs, new Map()), false)
  })
})
