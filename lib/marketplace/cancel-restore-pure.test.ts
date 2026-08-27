// Read-only cancel-restore alert — pure logic (variant, batching, message).
// Run: node --import tsx --test lib/marketplace/cancel-restore-pure.test.ts
//
// The DB-gated cases from the spec's matrix are enforced by the SQL predicate in
// cancel-restore-alert.ts, not here: edit-capable connection silent
// (api_mode='read_only'), never-reserved / NULL snapshot silent
// (reserved_stock_snapshot IS NOT NULL), duplicate sync pass one alert
// (restore_alert_sent_at IS NULL + stamp), and Uzum-read-only+Yandex-edit only
// the Uzum one (the gate is per shop row). This file covers the pure logic.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  pickVariant, planRestoreAlerts, buildRestoreMessage, type RestoreCandidate,
} from './cancel-restore-pure'

const cand = (o: Partial<RestoreCandidate> = {}): RestoreCandidate => ({
  orderId: o.orderId ?? '124708369',
  marketplace: o.marketplace ?? 'uzum',
  sku: o.sku ?? 'KBWHT',
  name: o.name ?? 'GTX350',
  before: o.before ?? 2,
  after: o.after ?? 1,
  qty: o.qty ?? 1,
})

describe('pickVariant', () => {
  it('ACTION when the listing is still short (unit did not come back)', () => {
    assert.equal(pickVariant(2, 1, 1), 'action')
    assert.equal(pickVariant(1, 0, 1), 'action')
  })
  it('INFO when the listing is back at/above the snapshot', () => {
    assert.equal(pickVariant(2, 2, 1), 'info')
    assert.equal(pickVariant(2, 3, 1), 'info')
  })
})

describe('planRestoreAlerts — batch per (marketplace, variant)', () => {
  it('two cancellations, same marketplace + variant → ONE group of two', () => {
    const { groups, orderIds } = planRestoreAlerts([
      cand({ orderId: 'A', sku: 'KBWHT', before: 2, after: 1 }),
      cand({ orderId: 'B', sku: 'JMBLK', before: 3, after: 2 }),
    ])
    assert.equal(groups.length, 1)
    assert.equal(groups[0].items.length, 2)
    assert.deepEqual(orderIds, ['A', 'B'])
  })

  it('mixed variants do NOT share a message — ACTION and INFO split into two groups', () => {
    const { groups } = planRestoreAlerts([
      cand({ orderId: 'A', before: 2, after: 1 }),   // action
      cand({ orderId: 'B', before: 2, after: 2 }),   // info
    ])
    assert.equal(groups.length, 2)
    assert.deepEqual(groups.map(g => g.variant).sort(), ['action', 'info'])
  })

  it('different marketplaces split too', () => {
    const { groups } = planRestoreAlerts([
      cand({ orderId: 'A', marketplace: 'uzum' }),
      cand({ orderId: 'B', marketplace: 'yandex_market' }),
    ])
    assert.equal(groups.length, 2)
  })
})

describe('buildRestoreMessage (ru)', () => {
  it('single ACTION reads like the spec, with the real before/after', () => {
    const [g] = planRestoreAlerts([cand({ orderId: '124708369', before: 2, after: 1 })]).groups
    const msg = buildRestoreMessage(g, 'ru').replace(/<\/?b>/g, '')
    assert.match(msg, /Остаток не вернулся после отмены/)
    assert.match(msg, /Заказ 124708369 \(GTX350, KBWHT\) отменён на Uzum\./)
    assert.match(msg, /было 2, стало 1/)
    assert.match(msg, /Верните остаток на 2 в личном кабинете Uzum/)
  })

  it('single INFO tells them nothing to do', () => {
    const [g] = planRestoreAlerts([cand({ before: 2, after: 2 })]).groups
    const msg = buildRestoreMessage(g, 'ru').replace(/<\/?b>/g, '')
    assert.match(msg, /Отмена обработана/)
    assert.match(msg, /сам вернул остаток на витрину: 2/)
    assert.match(msg, /Ничего делать не нужно/)
  })

  it('multi-order ACTION: one line per order under the marketplace, one closing', () => {
    const { groups } = planRestoreAlerts([
      cand({ orderId: 'A', sku: 'KBWHT', before: 2, after: 1 }),
      cand({ orderId: 'B', sku: 'JMBLK', before: 3, after: 2 }),
    ])
    const msg = buildRestoreMessage(groups[0], 'ru').replace(/<\/?b>/g, '')
    assert.match(msg, /Остаток не вернулся после отмены/)
    assert.match(msg, /Uzum:/)
    assert.match(msg, /• KBWHT — 2 → 1/)
    assert.match(msg, /• JMBLK — 3 → 2/)
    assert.match(msg, /Верните остатки вручную в личном кабинете Uzum/)
  })
})
