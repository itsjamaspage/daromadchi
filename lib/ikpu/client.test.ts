import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { searchByKeyword, searchByBarcode } from './client'

const realFetch = globalThis.fetch

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

const SAMPLE_SEARCH_ITEM = {
  mxikCode: '06109001001000000',
  name: 'Футболка мужская',
  description: '',
  internationalCode: null,
  label: '1',
  fullName: 'Футболка мужская хлопковая',
  groupCode: '06',
  groupName: 'Одежда',
  classCode: '0610',
  className: 'Трикотажные изделия',
  positionCode: '061090',
  positionName: 'Футболки',
  subPositionCode: '06109001',
  subPositionName: 'Футболки мужские',
  brandCode: '001',
  brandName: null,
  attributeName: null,
  unitsName: 'шт',
  categoryCode: '06109001001',
  categoryName: 'Футболки мужские',
  usePackage: '0',
  packageName: null,
  categoryUnitId: null,
  categoryUnitName: null,
  surveyCategoryId: '1',
  nonChangeable: '0',
  lgotaId: '0',
  lgotaName: '',
  recommendedCategoryUnitName: null,
  recommendedUnitsName: null,
  useCard: '0',
  property: null,
}

const SAMPLE_PARAMS_ITEM = {
  mxikCode: '06109001001000000',
  mxikName: 'Футболка мужская',
  groupName: 'Одежда',
  className: 'Трикотажные изделия',
  positionName: 'Футболки',
  subPositionName: 'Футболки мужские',
  brandName: '',
  attributeName: '',
  unitCode: null,
  unitName: 'шт',
  internationalCode: '6109100010',
  label: 1,
}

let lastUrl = ''

before(() => {
  // @ts-expect-error override global fetch for the test
  globalThis.fetch = async (input: string | URL | Request): Promise<Response> => {
    const url = String(input)
    lastUrl = url

    if (url.includes('/elasticsearch/search')) {
      return json({
        success: true,
        code: 200,
        reason: 'OK',
        data: [SAMPLE_SEARCH_ITEM],
        recordTotal: 1,
        errors: null,
      })
    }
    if (url.includes('/mxik/search/by-params')) {
      if (url.includes('gtin=0000000000000')) {
        return json({
          success: true,
          code: 200,
          reason: 'OK',
          data: { content: [], totalElements: 0, totalPages: 0 },
          errors: null,
        })
      }
      return json({
        success: true,
        code: 200,
        reason: 'OK',
        data: {
          content: [SAMPLE_PARAMS_ITEM],
          totalElements: 1,
          totalPages: 1,
        },
        errors: null,
      })
    }
    return json({ error: 'unhandled' }, 404)
  }
})

after(() => {
  globalThis.fetch = realFetch
})

describe('IKPU client — keyword search', () => {
  it('returns mapped results for a keyword', async () => {
    const { results, total } = await searchByKeyword('Футболка')
    assert.equal(total, 1)
    assert.equal(results.length, 1)
    assert.equal(results[0].mxikCode, '06109001001000000')
    assert.equal(results[0].name, 'Футболка мужская')
    assert.equal(results[0].groupName, 'Одежда')
    assert.equal(results[0].unitName, 'шт')
  })

  it('passes lang and pagination to the URL', async () => {
    await searchByKeyword('test', { lang: 'uz', size: 5, page: 2 })
    assert.ok(lastUrl.includes('lang=uz'))
    assert.ok(lastUrl.includes('size=5'))
    assert.ok(lastUrl.includes('page=2'))
  })

  it('defaults to lang=ru, size=20, page=0', async () => {
    await searchByKeyword('test')
    assert.ok(lastUrl.includes('lang=ru'))
    assert.ok(lastUrl.includes('size=20'))
    assert.ok(lastUrl.includes('page=0'))
  })
})

describe('IKPU client — barcode search', () => {
  it('returns mapped results for a barcode', async () => {
    const { results, total } = await searchByBarcode('4780012345678')
    assert.equal(total, 1)
    assert.equal(results.length, 1)
    assert.equal(results[0].mxikCode, '06109001001000000')
    assert.equal(results[0].name, 'Футболка мужская')
  })

  it('returns empty for a non-matching barcode', async () => {
    const { results, total } = await searchByBarcode('0000000000000')
    assert.equal(total, 0)
    assert.equal(results.length, 0)
  })

  it('sends gtin param in the URL', async () => {
    await searchByBarcode('4780099999999')
    assert.ok(lastUrl.includes('gtin=4780099999999'))
  })
})
