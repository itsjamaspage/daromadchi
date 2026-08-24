import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveShopIdentity, type ShopIdentityCandidate } from './shop-identity'

const shop = (id: string, ext: string | null): ShopIdentityCandidate =>
  ({ id, shop_id_external: ext })

const FBS = '149137909'   // campaign A
const FBY = '987654321'   // campaign B

// ── The reported bug ────────────────────────────────────────────────────────
test('adding a second Yandex campaign creates a NEW shop, never touching the first', () => {
  // The FBS + FBY case. Previously this resolved to campaign A's row and tripped
  // clearShopData, deleting A's orders, products and history.
  const r = resolveShopIdentity([shop('A', FBS)], FBY)
  assert.deepEqual(r, { action: 'insert' })
})

test('the wipe path is unreachable: no resolution ever re-points an existing shop', () => {
  // clearShopData fired on "existing row, different campaign id". Every
  // resolution that returns `update` either matched the id exactly or adopted a
  // row that had none — so that combination cannot be produced.
  const cases: Array<[ShopIdentityCandidate[], string | null]> = [
    [[shop('A', FBS)], FBS],            // exact re-save
    [[shop('A', FBS)], FBY],            // second campaign
    [[shop('A', null)], FBS],           // adopt
    [[shop('A', FBS), shop('B', FBY)], FBY],
    [[], FBS],
    [[shop('A', FBS)], null],
  ]
  for (const [candidates, ext] of cases) {
    const r = resolveShopIdentity(candidates, ext)
    if (r.action !== 'update') continue
    const target = candidates.find(c => c.id === r.shopId)!
    const repoints = !!target.shop_id_external && !!ext && target.shop_id_external !== ext
    assert.equal(repoints, false, `${target.shop_id_external} → ${ext} would re-point shop ${r.shopId}`)
  }
})

// ── Acceptance cases ────────────────────────────────────────────────────────
test('reconnecting the same campaign updates in place', () => {
  assert.deepEqual(
    resolveShopIdentity([shop('A', FBS)], FBS),
    { action: 'update', shopId: 'A', adopts: false },
  )
})

test('once both are connected, each campaign addresses its own shop', () => {
  const both = [shop('A', FBS), shop('B', FBY)]
  assert.deepEqual(resolveShopIdentity(both, FBS), { action: 'update', shopId: 'A', adopts: false })
  assert.deepEqual(resolveShopIdentity(both, FBY), { action: 'update', shopId: 'B', adopts: false })
})

test('a first connect with no shops yet inserts', () => {
  assert.deepEqual(resolveShopIdentity([], FBS), { action: 'insert' })
  assert.deepEqual(resolveShopIdentity([], null), { action: 'insert' })
})

// ── Adoption: a row that has no external id yet ─────────────────────────────
test('a shop with no campaign id adopts the one being entered', () => {
  // First time a campaign id is supplied, or a legacy row created before it was
  // known. Must NOT orphan that row beside a new one.
  assert.deepEqual(
    resolveShopIdentity([shop('A', null)], FBS),
    { action: 'update', shopId: 'A', adopts: true },
  )
})

test('an exact match wins over an unclaimed row', () => {
  assert.deepEqual(
    resolveShopIdentity([shop('A', null), shop('B', FBS)], FBS),
    { action: 'update', shopId: 'B', adopts: false },
  )
})

// ── Uzum: no campaign id is ever sent ───────────────────────────────────────
test('Uzum keeps single-row behaviour and can never fork a second shop', () => {
  // Uzum learns its shop id inside the sync, so the connect carries none. With
  // one row it must always resolve to that row — never insert a duplicate on
  // every token re-save.
  assert.deepEqual(
    resolveShopIdentity([shop('U', '4242')], null),
    { action: 'update', shopId: 'U', adopts: false },
  )
  assert.deepEqual(
    resolveShopIdentity([shop('U', null)], undefined),
    { action: 'update', shopId: 'U', adopts: false },
  )
})

// ── Ambiguity ───────────────────────────────────────────────────────────────
test('a token-only save is refused once several campaigns exist', () => {
  // Silently writing the token onto whichever row came back first would be
  // worse than refusing: it could point campaign A at campaign B's credentials.
  assert.deepEqual(
    resolveShopIdentity([shop('A', FBS), shop('B', FBY)], null),
    { action: 'ambiguous' },
  )
})

// ── Input hygiene ───────────────────────────────────────────────────────────
test('whitespace and empty strings are normalised, not matched literally', () => {
  assert.deepEqual(
    resolveShopIdentity([shop('A', FBS)], `  ${FBS}  `),
    { action: 'update', shopId: 'A', adopts: false },
  )
  // An empty/whitespace id is "no id given", not an id that matches nothing.
  assert.deepEqual(
    resolveShopIdentity([shop('A', FBS)], '   '),
    { action: 'update', shopId: 'A', adopts: false },
  )
  // A stored blank counts as unclaimed, so it adopts rather than forking.
  assert.deepEqual(
    resolveShopIdentity([shop('A', '  ')], FBS),
    { action: 'update', shopId: 'A', adopts: true },
  )
})
