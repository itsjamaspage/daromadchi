import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { matchCategory, cyrillicToLatin } from './matcher.js'
import { TAXONOMY } from './taxonomy.js'

describe('cyrillicToLatin', () => {
  it('transliterates Uzbek Cyrillic to Latin', () => {
    assert.equal(cyrillicToLatin('Смартфонлар'), 'smartfonlar')
    assert.equal(cyrillicToLatin('Қўлқоплар'), "qo'lqoplar")
  })
})

describe('matchCategory — exact tier', () => {
  it('every raw_example resolves to its canonical with tier=exact, score=1.0', () => {
    const failures: string[] = []

    for (const cat of TAXONOMY) {
      for (const mp of ['uzum', 'yandex_market'] as const) {
        for (const raw of cat.raw_examples[mp]) {
          const result = matchCategory(raw)
          if (!result || result.canonical_id !== cat.id || result.tier !== 'exact' || result.score !== 1.0) {
            failures.push(
              `[${cat.id}][${mp}] "${raw}" → ${result ? `${result.canonical_id} (tier=${result.tier}, score=${result.score})` : 'null'}`,
            )
          }
        }
      }
    }

    assert.deepEqual(failures, [])
  })
})

describe('matchCategory — term matches', () => {
  it('matches known terms exactly', () => {
    const r1 = matchCategory('Электрочайники')
    assert.equal(r1?.canonical_id, 'small_kitchen_appliances')
    assert.equal(r1?.tier, 'exact')

    const r2 = matchCategory('iphone')
    assert.equal(r2?.canonical_id, 'smartphones')
    assert.equal(r2?.tier, 'exact')
  })

  it('matches Uzbek Cyrillic via transliteration', () => {
    const r = matchCategory('Ноутбуклар')
    assert.equal(r?.canonical_id, 'laptops')
    assert.equal(r?.tier, 'exact')
  })
})

describe('matchCategory — substring tier', () => {
  it('matches when input contains a known term', () => {
    const r = matchCategory('Блендеры погружные и стационарные')
    assert.equal(r?.canonical_id, 'small_kitchen_appliances')
    assert.equal(r?.tier, 'substring')
    assert.ok(r!.score > 0.85 && r!.score < 0.86)
  })

  it('prefers longer substring match: "power bank" beats "iphone" in MagSafe title', () => {
    const r = matchCategory('MagSafe power bank simsiz 5000 mAs iPhone uchun magnitli')
    assert.equal(r?.canonical_id, 'power_banks_chargers')
    assert.equal(r?.tier, 'substring')
  })
})

describe('matchCategory — cross-marketplace disambiguation', () => {
  it('headphones: RU and UZ names resolve to same canonical', () => {
    const ru = matchCategory('Наушники и гарнитуры')
    const uz = matchCategory('Simsiz quloqchinlar')
    assert.equal(ru?.canonical_id, 'headphones')
    assert.equal(uz?.canonical_id, 'headphones')
  })

  it('phone_accessories vs smartphones — чехол goes to accessories, not phones', () => {
    const r = matchCategory('Чехлы для телефонов')
    assert.equal(r?.canonical_id, 'phone_accessories')
    assert.notEqual(r?.canonical_id, 'smartphones')
  })

  it('bags_wallets: Мужские сумки matches bags, not mens_clothing', () => {
    const r = matchCategory('Мужские сумки')
    assert.equal(r?.canonical_id, 'bags_wallets')
  })

  it('smart_watches vs jewelry — Смарт-часы goes to smart_watches', () => {
    const r = matchCategory('Смарт-часы')
    assert.equal(r?.canonical_id, 'smart_watches')
  })

  it('jewelry — Наручные часы goes to jewelry, not smart_watches', () => {
    const r = matchCategory('Наручные часы')
    assert.equal(r?.canonical_id, 'jewelry')
  })
})

describe('matchCategory — token_set tier', () => {
  it('matches via high token overlap', () => {
    const r = matchCategory('товары для собак и кошек')
    assert.ok(r, 'should match')
    assert.equal(r!.canonical_id, 'pet_supplies')
  })
})

describe('matchCategory — no match', () => {
  it('returns null for gibberish', () => {
    assert.equal(matchCategory('xyzzy12345'), null)
  })

  it('returns null for very short ambiguous input', () => {
    assert.equal(matchCategory('ab'), null)
  })
})
