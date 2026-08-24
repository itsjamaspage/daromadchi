import { test } from 'node:test'
import assert from 'node:assert/strict'
import { YANDEX_STATUS_MAP } from './sync'

// The dashboard's four buckets, mirroring STATUS_GROUP in
// components/dashboard/OrdersTable.tsx. Asserting the BUCKET (not just the enum
// value) is the point: the reported bug was a bucket error, not an enum error.
const BUCKET: Record<string, string> = {
  pending: 'Создан', confirmed: 'В процессе', delivered: 'Доставлен',
  cancelled: 'Отменён', returned: 'Отменён',
}
const bucketOf = (raw: string): string | undefined => {
  const mapped = YANDEX_STATUS_MAP[raw]
  return mapped ? BUCKET[mapped] : undefined
}

// ── The reported bug ────────────────────────────────────────────────────────
test('PICKUP shows as «В процессе», not «Создан» (order 60675080064)', () => {
  // «доставлен в пункт выдачи» — one step from delivered. It was unmapped, so
  // `?? 'pending'` rendered a nearly-complete order as brand new.
  assert.equal(YANDEX_STATUS_MAP.PICKUP, 'confirmed')
  assert.equal(bucketOf('PICKUP'), 'В процессе')
})

test('every transit state lands in «В процессе»', () => {
  for (const raw of ['PROCESSING', 'DELIVERY', 'PICKUP']) {
    assert.equal(bucketOf(raw), 'В процессе', `${raw} should be В процессе`)
  }
})

test('terminal states keep their buckets', () => {
  assert.equal(bucketOf('DELIVERED'), 'Доставлен')
  assert.equal(bucketOf('CANCELLED'), 'Отменён')
  assert.equal(bucketOf('RETURNED'), 'Отменён')
  assert.equal(bucketOf('PARTIALLY_RETURNED'), 'Отменён')
})

test('PENDING stays «Создан» — the seller has it and has not shipped it', () => {
  assert.equal(bucketOf('PENDING'), 'Создан')
})

// ── What is deliberately still unmapped ─────────────────────────────────────
// Pinned so the follow-up branch (a non-actionable enum value + migration) has
// to come here and change this test on purpose, rather than these silently
// acquiring a bucket.
test('draft/unpaid states remain unmapped pending the non-actionable value', () => {
  for (const raw of ['PLACING', 'RESERVED', 'UNPAID', 'UNKNOWN']) {
    assert.equal(YANDEX_STATUS_MAP[raw], undefined, `${raw} must stay unmapped for now`)
  }
})

// ── No status may map outside the enum ──────────────────────────────────────
test('every mapped value is a real order_status enum member', () => {
  const ENUM = ['pending', 'confirmed', 'delivered', 'cancelled', 'returned']
  for (const [raw, mapped] of Object.entries(YANDEX_STATUS_MAP)) {
    assert.ok(ENUM.includes(mapped), `${raw} → ${mapped} is not an order_status value`)
  }
})

// ── Turnover safety (billing) ───────────────────────────────────────────────
// lib/db/turnover.ts sums orders WHERE status NOT IN ('cancelled','returned'),
// and that figure drives the recommended pricing tier. Every status this change
// moves must stay on the same side of that predicate, or a seller's tier math
// shifts as a side effect of a dashboard fix.
test('the remap moves nothing across the turnover predicate', () => {
  const countsTowardTurnover = (s: string) => !['cancelled', 'returned'].includes(s)
  const before: Record<string, string> = {
    PENDING: 'pending', PROCESSING: 'pending', DELIVERY: 'confirmed',
    DELIVERED: 'delivered', CANCELLED: 'cancelled', RETURNED: 'returned',
    PICKUP: 'pending', // via the ?? 'pending' fallback
  }
  for (const [raw, oldVal] of Object.entries(before)) {
    const newVal = YANDEX_STATUS_MAP[raw]
    assert.equal(
      countsTowardTurnover(newVal), countsTowardTurnover(oldVal),
      `${raw}: ${oldVal} → ${newVal} crosses the turnover predicate`,
    )
  }
})
