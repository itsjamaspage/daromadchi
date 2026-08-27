import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { yandexSellableStock } from './client'

// #393: we WRITE free-to-sell (UpdateStockItemDTO's `count` is «Количество
// доступного товара», and has no type field) but READ BACK FIT, which the spec
// defines as «доступный для продажи ИЛИ УЖЕ ЗАРЕЗЕРВИРОВАН». The two differ by
// exactly the reserve, so the diff never closed and the writer re-pushed forever.
describe('yandex sellable stock', () => {
  test('THE BUG: a reserved unit no longer inflates the read', () => {
    // PBGRY: warehouse 1, reserve 1 → free to sell is 0, not 1.
    assert.equal(yandexSellableStock([{ type: 'FIT', count: 1 }, { type: 'FREEZE', count: 1 }]), 0)
  })

  test('with no reserve it matches the old FIT behaviour exactly', () => {
    assert.equal(yandexSellableStock([{ type: 'FIT', count: 3 }]), 3)
    assert.equal(yandexSellableStock([{ type: 'FIT', count: 3 }, { type: 'FREEZE', count: 0 }]), 3)
  })

  test('subtracts a partial reserve', () => {
    assert.equal(yandexSellableStock([{ type: 'FIT', count: 5 }, { type: 'FREEZE', count: 2 }]), 3)
  })

  test('never negative, whatever the marketplace reports', () => {
    assert.equal(yandexSellableStock([{ type: 'FIT', count: 1 }, { type: 'FREEZE', count: 4 }]), 0)
  })

  test('ignores the types we deliberately do not trust', () => {
    // AVAILABLE was found unreliable on these endpoints; DEFECT/EXPIRED are not
    // sellable. Only FIT and FREEZE participate.
    assert.equal(yandexSellableStock([
      { type: 'FIT', count: 2 }, { type: 'FREEZE', count: 1 },
      { type: 'AVAILABLE', count: 99 }, { type: 'DEFECT', count: 7 },
    ]), 1)
  })

  test('empty or missing reads as zero', () => {
    assert.equal(yandexSellableStock([]), 0)
    assert.equal(yandexSellableStock(undefined), 0)
  })
})
