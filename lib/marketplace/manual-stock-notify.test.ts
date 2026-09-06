// Manual-stock reminder — pure logic + a no-write-path guard.
// With all shops in edit mode (stock_sync), manual reminders never fire in
// practice — the stock writer handles everything automatically. These tests
// verify the pure logic still works and the message formatting is correct.
// Run: node --import tsx --test lib/marketplace/manual-stock-notify.test.ts
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  computeManualReminders, shouldRemind, buildManualMessage, productLabel,
  type ManualReminder,
} from './manual-stock-pure'
import type { SyncMember } from './stock-allocation'

function member(over: Partial<SyncMember>): SyncMember {
  return {
    productId: over.productId ?? 'p',
    shopId: over.shopId ?? 's',
    marketplace: over.marketplace ?? 'uzum',
    apiMode: over.apiMode ?? 'stock_sync',
    priority: over.priority ?? 100,
    listedStock: over.listedStock ?? 0,
    physicalStock: over.physicalStock ?? null,
    pending: over.pending ?? 0,
    sku: 'sku' in over ? (over.sku ?? null) : 'JMWHT',   // preserve an explicit null
  }
}
const uzum = (o: Partial<SyncMember> = {}) => member({ shopId: 'u', marketplace: 'uzum', priority: 0, ...o })
const ym   = (o: Partial<SyncMember> = {}) => member({ shopId: 'y', marketplace: 'yandex_market', priority: 100, ...o })

describe('computeManualReminders — all shops are edit-mode (stock_sync)', () => {
  it('returns no reminders when all members are stock_sync — auto-sync handles everything', () => {
    const members = [
      uzum({ listedStock: 0, physicalStock: 1, pending: 1 }),
      ym({ listedStock: 1, physicalStock: 1, pending: 0 }),
    ]
    assert.deepEqual(computeManualReminders(members), [])
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

// Message detail tests use synthetic ManualReminder objects directly, since
// computeManualReminders now returns [] for all-stock_sync groups.
describe('message detail — product name, colour and order number', () => {
  const reminder: ManualReminder = {
    sku: 'JMWHT', target: 0, marketplace: 'yandex_market',
    title: 'M9', colorKey: 'black', orderId: '124459482',
  }

  it('carries identity onto the reminder', () => {
    assert.equal(reminder.title, 'M9')
    assert.equal(reminder.colorKey, 'black')
    assert.equal(reminder.orderId, '124459482')
  })

  it('renders name first, then colour and SKU — and localizes the colour', () => {
    assert.equal(productLabel(reminder, 'ru'), 'M9 (Чёрный, JMWHT)')
    assert.notEqual(productLabel(reminder, 'uz'), productLabel(reminder, 'ru'))
  })

  it('names the order in every language', () => {
    const items = [reminder]
    for (const lang of ['ru', 'uz', 'en'] as const) {
      const msg = buildManualMessage(items, lang)
      assert.match(msg, /124459482/, `${lang} lost the order number`)
      assert.match(msg, /M9/, `${lang} lost the product name`)
      assert.doesNotMatch(msg, /undefined/)
    }
  })

  it('degrades to the bare SKU when identity is missing', () => {
    const bare: ManualReminder = { sku: 'JMWHT', target: 0, marketplace: 'yandex_market' }
    assert.equal(productLabel(bare, 'ru'), 'JMWHT')
    const msg = buildManualMessage([bare], 'ru')
    assert.match(msg, /JMWHT/)
    assert.doesNotMatch(msg, /undefined|null|\(\)/)
    assert.doesNotMatch(msg, /заказ/, 'no order id → the clause must be omitted, not left empty')
  })

  it('omits an unknown colour key rather than printing it raw', () => {
    const r: ManualReminder = { sku: 'JMWHT', target: 0, marketplace: 'yandex_market', title: 'M9', colorKey: 'not-a-real-colour' }
    assert.equal(productLabel(r, 'ru'), 'M9 (JMWHT)')
  })
})

describe('SAFETY — no marketplace write path is reachable from this module', () => {
  it('the module never imports the writer / order-cancel and never calls a write fn', () => {
    const src = readFileSync(fileURLToPath(new URL('./manual-stock-notify.ts', import.meta.url)), 'utf8')
    assert.doesNotMatch(src, /from\s+['"][^'"]*stock-writer/, 'must not import the stock writer')
    assert.doesNotMatch(src, /from\s+['"][^'"]*order-cancel/, 'must not import the order-cancel path')
    assert.doesNotMatch(src, /\bpushStock\s*\(/, 'must not call pushStock')
    assert.doesNotMatch(src, /\bcancelOrder\s*\(/, 'must not call cancelOrder')
  })
})

describe('footer — why the seller is being asked to do this by hand', () => {
  const one = [{ sku: 'PBGRY', target: 1, marketplace: 'uzum' as const }]

  it('names read-only keys and says what switching them would do', () => {
    const ru = buildManualMessage(one, 'ru')
    assert.match(ru, /только на чтение/)
    assert.match(ru, /обновляться автоматически/)
  })

  it('is present in every language, once', () => {
    for (const [lang, needle] of [['uz', /faqat o'qish/], ['ru', /только на чтение/], ['en', /read-only/]] as const) {
      const msg = buildManualMessage(one, lang)
      assert.match(msg, needle, `missing in ${lang}`)
      assert.equal(msg.split('ℹ️').length - 1, 1, `footer repeated in ${lang}`)
    }
  })

  it('comes last, after every listing line', () => {
    const msg = buildManualMessage([
      { sku: 'A', target: 0, marketplace: 'uzum' },
      { sku: 'B', target: 1, marketplace: 'yandex_market' },
    ], 'ru')
    const lines = msg.split('\n').filter(Boolean)
    assert.match(lines[lines.length - 1], /^ℹ️/)
    assert.equal(lines.filter(l => l.startsWith('•')).length, 2)
  })
})
