// Read-only manual-stock reminder — pure logic + a no-write-path guard.
// Run: node --import tsx --test lib/marketplace/manual-stock-notify.test.ts
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  computeManualReminders, shouldRemind, buildManualMessage, productLabel,
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
describe('message detail — product name, colour and order number', () => {
  // The reminder used to name a bare SKU, which is not what a seller recognises
  // on a phone, and gave no way to tie the alert back to the sale that caused it.
  const group = [uzum({ listedStock: 1, physicalStock: 1, pending: 1 }), ym({ listedStock: 2, physicalStock: 2 })]
  const identity = { title: 'M9', colorKey: 'black', orderId: '124459482' }

  it('carries identity from the group onto every reminder', () => {
    const [r] = computeManualReminders(group, identity)
    assert.equal(r.title, 'M9')
    assert.equal(r.colorKey, 'black')
    assert.equal(r.orderId, '124459482')
  })

  it('renders name first, then colour and SKU — and localizes the colour', () => {
    const [r] = computeManualReminders(group, identity)
    // Capitalised because COLOR_LABELS is shared with the badges and the
    // edit-mode digest; rendering it differently here would be the odd one out.
    assert.equal(productLabel(r, 'ru'), 'M9 (Чёрный, JMWHT)')
    assert.notEqual(productLabel(r, 'uz'), productLabel(r, 'ru'))  // colour is translated
  })

  it('names the order in every language', () => {
    const items = computeManualReminders(group, identity)
    for (const lang of ['ru', 'uz', 'en'] as const) {
      const msg = buildManualMessage(items, lang)
      assert.match(msg, /124459482/, `${lang} lost the order number`)
      assert.match(msg, /M9/, `${lang} lost the product name`)
      assert.doesNotMatch(msg, /undefined/)
    }
  })

  it('degrades to the bare SKU when identity is missing', () => {
    // A product with no title, or a group whose first sale predates order sync.
    const [r] = computeManualReminders(group)
    assert.equal(productLabel(r, 'ru'), 'JMWHT')
    const msg = buildManualMessage([r], 'ru')
    assert.match(msg, /JMWHT/)
    assert.doesNotMatch(msg, /undefined|null|\(\)/)
    assert.doesNotMatch(msg, /заказ/, 'no order id → the clause must be omitted, not left empty')
  })

  it('omits an unknown colour key rather than printing it raw', () => {
    const [r] = computeManualReminders(group, { title: 'M9', colorKey: 'not-a-real-colour' })
    assert.equal(productLabel(r, 'ru'), 'M9 (JMWHT)')
  })
})

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

describe('the selling marketplace maintains its own stock — never remind it', () => {
  // The reported message: ONE Yandex order, and the reminder named BOTH stores.
  // Yandex decrements its own listing when the seller accepts the order for
  // shipping, so the line telling them to set it by hand was noise sitting next
  // to the line that actually needed doing.
  const soldOnYandex = { title: 'Повербанк MagSafe', colorKey: 'grey', orderId: '60870363586', orderMarketplace: 'yandex_market' as const }

  it('drops the line for the marketplace the order came from', () => {
    const members = [
      uzum({ listedStock: 2, physicalStock: 2, pending: 1 }),
      ym({ listedStock: 2, physicalStock: 2, pending: 1 }),
    ]
    const out = computeManualReminders(members, soldOnYandex)
    assert.deepEqual(out.map(r => r.marketplace), ['uzum'],
      'the Yandex listing sold the unit and updates itself — only Uzum needs a human')
  })

  it('mirrored: an Uzum sale reminds only Yandex', () => {
    const members = [
      uzum({ listedStock: 2, physicalStock: 2, pending: 1 }),
      ym({ listedStock: 2, physicalStock: 2, pending: 1 }),
    ]
    const out = computeManualReminders(members, { orderMarketplace: 'uzum' })
    assert.deepEqual(out.map(r => r.marketplace), ['yandex_market'])
  })

  it('suppressing the only diverging listing yields no reminder at all', () => {
    // Uzum already correct, Yandex stale but Yandex is where it sold → nothing
    // to say. Better silence than an instruction to fix what fixes itself.
    const members = [
      uzum({ listedStock: 0, physicalStock: 1, pending: 1 }),
      ym({ listedStock: 1, physicalStock: 1, pending: 1 }),
    ]
    assert.deepEqual(computeManualReminders(members, { orderMarketplace: 'yandex_market' }), [])
  })

  it('with no known order marketplace, every diverging listing is still reminded', () => {
    // The suppression is evidence-driven: absent evidence, say more rather than
    // less. A group with no order yet must not go silent.
    const members = [
      uzum({ listedStock: 2, physicalStock: 2, pending: 1 }),
      ym({ listedStock: 2, physicalStock: 2, pending: 1 }),
    ]
    assert.deepEqual(computeManualReminders(members).map(r => r.marketplace), ['uzum', 'yandex_market'])
  })
})

describe('footer — why the seller is being asked to do this by hand', () => {
  const one = [{ sku: 'PBGRY', target: 1, marketplace: 'uzum' as const }]

  it('names read-only keys and says edit mode would have done it', () => {
    const ru = buildManualMessage(one, 'ru')
    assert.match(ru, /только на чтение/)
    assert.match(ru, /обновился бы сам/)
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
