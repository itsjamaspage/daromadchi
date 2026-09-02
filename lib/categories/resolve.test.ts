import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { resolveCanonical, canonicalName, lookupTaxonomy } from './resolve.js'

describe('resolveCanonical — synonym collapse', () => {
  it('«умные часы» and «смартчасы» both resolve to smart_watches', () => {
    const a = resolveCanonical('умные часы')
    const b = resolveCanonical('Смарт-часы')
    assert.ok(a, '«умные часы» should resolve')
    assert.ok(b, '«Смарт-часы» should resolve')
    assert.equal(a!.canonical_id, 'smart_watches')
    assert.equal(b!.canonical_id, 'smart_watches')
    assert.equal(a!.canonical_id, b!.canonical_id, 'both must collapse to the same canonical')
  })

  it('cross-marketplace headphone synonyms collapse', () => {
    const ru = resolveCanonical('Наушники')
    const uz = resolveCanonical('Simsiz quloqchinlar')
    assert.ok(ru)
    assert.ok(uz)
    assert.equal(ru!.canonical_id, uz!.canonical_id, 'RU and UZ headphones should merge')
  })

  it('provides trilingual names', () => {
    const r = resolveCanonical('Смартфоны')
    assert.ok(r)
    assert.equal(r!.canonical_id, 'smartphones')
    assert.ok(r!.name_ru.length > 0)
    assert.ok(r!.name_uz.length > 0)
    assert.ok(r!.name_en.length > 0)
  })

  it('returns null for unrecognised categories', () => {
    const r = resolveCanonical('xyzzy_random_category_2024')
    assert.equal(r, null)
  })

  it('caches results (same reference on second call)', () => {
    const a = resolveCanonical('Наушники')
    const b = resolveCanonical('Наушники')
    assert.equal(a, b, 'cached value should be the same object')
  })
})

describe('canonicalName', () => {
  it('returns the localized canonical name for a known category', () => {
    assert.equal(canonicalName('Смартфоны', 'ru'), 'Смартфоны')
    assert.equal(canonicalName('Смартфоны', 'en'), 'Smartphones')
    assert.equal(canonicalName('Смартфоны', 'uz'), 'Smartfonlar')
  })

  it('returns the raw string for an unknown category', () => {
    assert.equal(canonicalName('totally_unknown', 'ru'), 'totally_unknown')
  })
})

describe('lookupTaxonomy', () => {
  it('retrieves a taxonomy entry by slug', () => {
    const cat = lookupTaxonomy('smart_watches')
    assert.ok(cat)
    assert.equal(cat!.id, 'smart_watches')
    assert.ok(cat!.name.ru.length > 0)
  })

  it('returns undefined for unknown slug', () => {
    assert.equal(lookupTaxonomy('nonexistent'), undefined)
  })
})

describe('merge-key simulation (what _fetchCategoryRevenue does)', () => {
  it('two raw watch categories produce the same merge key', () => {
    const raw1 = 'умные часы'
    const raw2 = 'Смарт-часы и фитнес-браслеты'
    const r1 = resolveCanonical(raw1)
    const r2 = resolveCanonical(raw2)
    assert.ok(r1, `"${raw1}" should resolve`)
    assert.ok(r2, `"${raw2}" should resolve`)
    const key1 = `t:${r1!.canonical_id}`
    const key2 = `t:${r2!.canonical_id}`
    assert.equal(key1, key2, `merge keys must match: ${key1} vs ${key2}`)
  })

  it('power bank synonyms across languages merge', () => {
    const uz = resolveCanonical('Tashqi akkumulyatorlar')
    const ru = resolveCanonical('Портативные аккумуляторы')
    assert.ok(uz, '"Tashqi akkumulyatorlar" should resolve')
    assert.ok(ru, '"Портативные аккумуляторы" should resolve')
    assert.equal(uz!.canonical_id, ru!.canonical_id, 'UZ and RU power banks must merge')
    assert.equal(uz!.canonical_id, 'power_banks_chargers')
  })

  it('keyboard+mouse set resolves to computer_peripherals', () => {
    const r = resolveCanonical('Комплекты клавиатур и мышей')
    assert.ok(r, '"Комплекты клавиатур и мышей" should resolve')
    assert.equal(r!.canonical_id, 'computer_peripherals')
  })

  it('smartphone synonyms produce the same merge key', () => {
    const uzum = resolveCanonical('Smartfonlar')
    const yandex = resolveCanonical('Мобильные телефоны')
    assert.ok(uzum)
    assert.ok(yandex)
    assert.equal(
      `t:${uzum!.canonical_id}`,
      `t:${yandex!.canonical_id}`,
      'Uzum and Yandex smartphone categories must merge'
    )
  })
})
