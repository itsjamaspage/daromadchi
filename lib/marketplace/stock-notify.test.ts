// Focused, DB-free tests for the notification DIGEST builder — proving one
// combined message groups per sold SKU and reports each store's real result.
// The dedup/dispatch path (notifyStockUpdates) hits the DB and is covered by the
// integration path; here we lock the user-visible shape: one message, per-SKU
// sections, no per-write spam.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildDigestMessage, type StockUpdateEvent } from './stock-notify'

const ev = (o: Partial<StockUpdateEvent> & { sku: string }): StockUpdateEvent => ({
  targetMarketplace: 'yandex_market',
  originMarketplace: 'uzum',
  listed: 1, target: 0, ok: true,
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

  it('humanizes known skip reasons', () => {
    const msg = buildDigestMessage([{
      sku: 'JMJ16BG',
      events: [ev({ sku: 'JMJ16BG', targetMarketplace: 'uzum', ok: false, reason: 'missing_barcode' })],
    }])
    assert.match(msg, /нет штрихкода/)
  })
})
