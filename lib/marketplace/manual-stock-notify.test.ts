// Read-only manual-stock reminder — pure logic + a no-write-path guard.
// Run: node --import tsx --test lib/marketplace/manual-stock-notify.test.ts
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  computeManualReminders, shouldRemind, buildManualMessage,
} from './manual-stock-pure'
import type { SyncMember } from './stock-allocation'

function member(over: Partial<SyncMember>): SyncMember {
  return {
    productId: over.productId ?? 'p',
    shopId: over.shopId ?? 's',
    marketplace: over.marketplace ?? 'uzum',
    apiMode: over.apiMode ?? 'read_only',
    priority: over.priority ?? 100,
    listedStock: over.listedStock ?? 0,
    physicalStock: over.physicalStock ?? null,
    pending: over.pending ?? 0,
    sku: 'sku' in over ? (over.sku ?? null) : 'JMWHT',   // preserve an explicit null
  }
}
const uzum = (o: Partial<SyncMember> = {}) => member({ shopId: 'u', marketplace: 'uzum', priority: 0, ...o })
const ym   = (o: Partial<SyncMember> = {}) => member({ shopId: 'y', marketplace: 'yandex_market', priority: 100, ...o })

describe('computeManualReminders — the canonical Uzum-sold / Yandex-stale case', () => {
  it('tells the seller to set the STALE read-only listing to the shared target', () => {
    // Uzum sold its unit: its own listing auto-dropped to 0, a reserving order
    // holds the unit (pending 1). Yandex still shows 1 (stale). Pool MAX(1,1)=1
    // minus pending 1 → Z = 0. Yandex is out of sync; Uzum already matches.
    const members = [
      uzum({ listedStock: 0, physicalStock: 1, pending: 1 }),
      ym({ listedStock: 1, physicalStock: 1, pending: 0 }),
    ]
    const out = computeManualReminders(members)
    assert.deepEqual(out, [{ sku: 'JMWHT', target: 0, marketplace: 'yandex_market' }])
  })

  it('no reminder when both listings already equal the target', () => {
    const members = [
      uzum({ listedStock: 2, physicalStock: 2, pending: 0 }),
      ym({ listedStock: 2, physicalStock: 2, pending: 0 }),
    ]
    assert.deepEqual(computeManualReminders(members), [])
  })

  it('single-marketplace group → nothing to reconcile → no reminder', () => {
    const members = [
      uzum({ shopId: 'u1', listedStock: 0, physicalStock: 1, pending: 1 }),
      uzum({ shopId: 'u2', listedStock: 5, physicalStock: 1, pending: 0 }),
    ]
    assert.deepEqual(computeManualReminders(members), [])
  })

  it('only READ-ONLY members are reminded; a diverging stock_sync member is skipped', () => {
    // Uzum is edit-mode (handled by the writer, not a manual reminder); Yandex is
    // read-only and out of sync → only Yandex gets a manual reminder.
    const members = [
      uzum({ apiMode: 'stock_sync', listedStock: 5, physicalStock: 1, pending: 1 }),
      ym({ apiMode: 'read_only', listedStock: 1, physicalStock: 1, pending: 0 }),
    ]
    const out = computeManualReminders(members)
    assert.equal(out.length, 1)
    assert.equal(out[0].marketplace, 'yandex_market')
    assert.equal(out[0].target, 0)   // MAX(1,1) − 1
  })

  it('skips a member with no human SKU (unidentifiable)', () => {
    const members = [
      uzum({ listedStock: 0, physicalStock: 1, pending: 1 }),
      ym({ sku: null, listedStock: 1, physicalStock: 1, pending: 0 }),
    ]
    assert.deepEqual(computeManualReminders(members), [])
  })
})

describe('shouldRemind — fire once per divergence value, silent while unchanged', () => {
  it('fires when there is no prior fingerprint', () => {
    assert.equal(shouldRemind(null, 0), true)
  })
  it('silent when the same manual target was already reminded', () => {
    assert.equal(shouldRemind({ status: 'manual', target: 0 }, 0), false)
  })
  it('fires when the divergence VALUE changed', () => {
    assert.equal(shouldRemind({ status: 'manual', target: 0 }, 1), true)
  })
  it('fires when the prior row is an edit-mode outcome, not a manual reminder', () => {
    assert.equal(shouldRemind({ status: 'sent', target: 0 }, 0), true)
  })
})

describe('buildManualMessage', () => {
  it('renders a title + one line per listing, in the seller language', () => {
    const msg = buildManualMessage([{ sku: 'JMWHT', target: 0, marketplace: 'yandex_market' }], 'ru')
    assert.match(msg, /Обновите остатки вручную \(1\)/)
    assert.match(msg, /JMWHT/)
    assert.match(msg, /поставьте/)
    assert.match(msg, /Yandex Market/)
    assert.match(msg, /0/)
  })
})

// Direct imports and calls only. The TRANSITIVE check — which catches reaching
// a writer through an intermediate module, e.g. importing stock-sync.ts for its
// loadGroups() — lives in manual-stock-notify.guardrail.test.ts. Both run; this
// one is the fast, readable statement of intent, that one is the proof.
describe('SAFETY — no marketplace write path is reachable from this module', () => {
  it('the module never imports the writer / order-cancel and never calls a write fn', () => {
    // Match real imports/calls only — the module's own SAFETY comment names these
    // in prose, which is documentation, not a reachable write path.
    const src = readFileSync(fileURLToPath(new URL('./manual-stock-notify.ts', import.meta.url)), 'utf8')
    assert.doesNotMatch(src, /from\s+['"][^'"]*stock-writer/, 'must not import the stock writer')
    assert.doesNotMatch(src, /from\s+['"][^'"]*order-cancel/, 'must not import the order-cancel path')
    assert.doesNotMatch(src, /\bpushStock\s*\(/, 'must not call pushStock')
    assert.doesNotMatch(src, /\bcancelOrder\s*\(/, 'must not call cancelOrder')
  })
})
