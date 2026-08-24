import { test } from 'node:test'
import assert from 'node:assert/strict'
import { yandexItemSnapshot } from './sync'

// The reported bug: every Yandex order_items row had a blank sku and title
// while Uzum's were complete. Not a mis-map — the Yandex writers never wrote
// those columns at all. See docs/investigations/yandex-order-items-findings.md.

test('offerId becomes sku, offerName becomes title', () => {
  const s = yandexItemSnapshot({ offerId: 'JMM99', offerName: 'Наушники J16' })
  assert.equal(s.sku, 'JMM99')
  assert.equal(s.title, 'Наушники J16')
})

test('the columns that used to be blank are now non-null for a real item', () => {
  // Regression guard on the actual symptom, stated as the dashboard sees it.
  const s = yandexItemSnapshot({ offerId: 'M9-W', offerName: 'Смарт-часы M9 Белый' })
  assert.notEqual(s.sku, null)
  assert.notEqual(s.title, null)
})

// ── Colour precedence ───────────────────────────────────────────────────────
// Same order as the product path: the offer NAME first (per-colour listings put
// the colour word in the title), then the offer-cards «Цвет» attribute.

test('colour comes from the offer name when the name carries one', () => {
  assert.equal(
    yandexItemSnapshot({ offerId: 'M9-W', offerName: 'Смарт-часы M9 Белый' }).variant_color,
    'white',
  )
})

test('the name wins over the offer-cards attribute', () => {
  const s = yandexItemSnapshot(
    { offerId: 'M9-W', offerName: 'Смарт-часы M9 Белый' },
    new Map([['M9-W', 'black']]),
  )
  assert.equal(s.variant_color, 'white')
})

test('offer-cards attribute fills in when the name has no colour word', () => {
  // The J16 earphones: nothing colour-like in the title, but the seller set
  // «Цвет» on the offer card.
  const s = yandexItemSnapshot(
    { offerId: 'J16', offerName: 'Наушники J16' },
    new Map([['J16', 'black']]),
  )
  assert.equal(s.variant_color, 'black')
})

test('offer-cards map is keyed by offerId, not by title', () => {
  const s = yandexItemSnapshot(
    { offerId: 'J16', offerName: 'Наушники J16' },
    new Map([['Наушники J16', 'black']]),
  )
  assert.equal(s.variant_color, null)
})

test('no colour anywhere is null, not a guess', () => {
  assert.equal(yandexItemSnapshot({ offerId: 'J16', offerName: 'Наушники J16' }).variant_color, null)
  assert.equal(yandexItemSnapshot({ offerId: 'J16', offerName: 'Наушники J16' }, new Map()).variant_color, null)
})

test('the light pass has no offer-cards map at all and still works', () => {
  // offerCardColors is only fetched on a heavy pass with a resolvable
  // businessId; the writers must not depend on it existing.
  const s = yandexItemSnapshot({ offerId: 'M9-W', offerName: 'Смарт-часы M9 Белый' })
  assert.deepEqual(s, { title: 'Смарт-часы M9 Белый', sku: 'M9-W', variant_color: 'white' })
})

// ── Empty / missing input ───────────────────────────────────────────────────
// The columns are nullable. Writing '' would be worse than NULL: the UI's
// "do we know what this is?" check would pass and then render nothing.

test('missing fields are NULL, never empty strings', () => {
  assert.deepEqual(yandexItemSnapshot({}), { title: null, sku: null, variant_color: null })
})

test('whitespace-only fields collapse to NULL', () => {
  assert.deepEqual(
    yandexItemSnapshot({ offerId: '   ', offerName: '\t\n' }),
    { title: null, sku: null, variant_color: null },
  )
})

test('a blank offerId does not look up the colour map under an empty key', () => {
  const s = yandexItemSnapshot({ offerId: '', offerName: 'Наушники J16' }, new Map([['', 'red']]))
  assert.equal(s.variant_color, null)
})

test('one blank field does not blank the other', () => {
  assert.deepEqual(
    yandexItemSnapshot({ offerId: 'JMM99' }),
    { title: null, sku: 'JMM99', variant_color: null },
  )
  assert.deepEqual(
    yandexItemSnapshot({ offerName: 'Смарт-часы M9 Белый' }),
    { title: 'Смарт-часы M9 Белый', sku: null, variant_color: 'white' },
  )
})
