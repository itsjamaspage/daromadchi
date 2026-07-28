import { describe, it, expect } from 'vitest'
import { matchCategory, cyrillicToLatin } from './matcher'
import { TAXONOMY } from './taxonomy'

describe('cyrillicToLatin', () => {
  it('transliterates Uzbek Cyrillic to Latin', () => {
    expect(cyrillicToLatin('Смартфонлар')).toBe('smartfonlar')
    expect(cyrillicToLatin('Қўлқоплар')).toBe("qo'lqoplar")
  })
})

describe('matchCategory — exact tier', () => {
  it('every raw_example resolves to its canonical with tier=exact, score=1.0', () => {
    const failures: string[] = []

    for (const cat of TAXONOMY) {
      for (const mp of ['uzum', 'wildberries', 'yandex_market'] as const) {
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

    expect(failures).toEqual([])
  })
})

describe('matchCategory — term matches', () => {
  it('matches known terms exactly', () => {
    const r1 = matchCategory('Электрочайники')
    expect(r1?.canonical_id).toBe('small_kitchen_appliances')
    expect(r1?.tier).toBe('exact')

    const r2 = matchCategory('iphone')
    expect(r2?.canonical_id).toBe('smartphones')
    expect(r2?.tier).toBe('exact')
  })

  it('matches Uzbek Cyrillic via transliteration', () => {
    const r = matchCategory('Ноутбуклар')
    expect(r?.canonical_id).toBe('laptops')
    expect(r?.tier).toBe('exact')
  })
})

describe('matchCategory — substring tier', () => {
  it('matches when input contains a known term', () => {
    const r = matchCategory('Блендеры погружные и стационарные')
    expect(r?.canonical_id).toBe('small_kitchen_appliances')
    expect(r?.tier).toBe('substring')
    expect(r?.score).toBe(0.85)
  })
})

describe('matchCategory — cross-marketplace disambiguation', () => {
  it('headphones: RU and UZ names resolve to same canonical', () => {
    const ru = matchCategory('Наушники и гарнитуры')
    const uz = matchCategory('Simsiz quloqchinlar')
    expect(ru?.canonical_id).toBe('headphones')
    expect(uz?.canonical_id).toBe('headphones')
  })

  it('phone_accessories vs smartphones — чехол goes to accessories, not phones', () => {
    const r = matchCategory('Чехлы для телефонов')
    expect(r?.canonical_id).toBe('phone_accessories')
    expect(r?.canonical_id).not.toBe('smartphones')
  })

  it('bags_wallets: Мужские сумки matches bags, not mens_clothing', () => {
    const r = matchCategory('Мужские сумки')
    expect(r?.canonical_id).toBe('bags_wallets')
  })

  it('smart_watches vs jewelry — Смарт-часы goes to smart_watches', () => {
    const r = matchCategory('Смарт-часы')
    expect(r?.canonical_id).toBe('smart_watches')
  })

  it('jewelry — Наручные часы goes to jewelry, not smart_watches', () => {
    const r = matchCategory('Наручные часы')
    expect(r?.canonical_id).toBe('jewelry')
  })
})

describe('matchCategory — token_set tier', () => {
  it('matches via high token overlap', () => {
    const r = matchCategory('товары для собак и кошек')
    expect(r).not.toBeNull()
    expect(r!.canonical_id).toBe('pet_supplies')
  })
})

describe('matchCategory — no match', () => {
  it('returns null for gibberish', () => {
    expect(matchCategory('xyzzy12345')).toBeNull()
  })

  it('returns null for very short ambiguous input', () => {
    expect(matchCategory('ab')).toBeNull()
  })
})
