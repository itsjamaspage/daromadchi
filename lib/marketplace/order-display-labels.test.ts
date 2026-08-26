/**
 * Every display status must have a label in every locale, in BOTH translation
 * tables.
 *
 * The regression this locks shut: orderDisplayStatus() started returning
 * 'preparing' and 'shipping', the labels were added to lib/i18n.ts (which the
 * Orders table reads) and missed in lib/dashT.ts (which the dashboard's recent
 * orders list reads). The lookup falls back to the raw enum when a key is
 * absent, so the badge quietly printed "confirmed" and "pending" in English at
 * a Uzbek seller — no error, no type failure, just untranslated internals on
 * the busiest screen in the app.
 *
 * A fallback that renders SOMETHING is why this shipped. The type system cannot
 * catch it either: both tables are plain object literals and the lookup is by
 * computed key. So it is caught here instead.
 *
 * Run: node --import tsx --test lib/marketplace/order-display-labels.test.ts
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { orderDisplayStatus, type OrderDisplayStatus } from './order-display-status'
import { translations } from '@/lib/i18n'
import { dashT } from '@/lib/dashT'

const LANGS = ['uz', 'ru', 'en'] as const
const DISPLAY_STATUSES: OrderDisplayStatus[] = [
  'pending', 'preparing', 'shipping', 'delivered', 'cancelled',
]

describe('every display status is translated', () => {
  it('in dashT — the dashboard recent-orders badge', () => {
    for (const lang of LANGS) {
      const s = dashT[lang].status as Record<string, string | undefined>
      for (const ds of DISPLAY_STATUSES) {
        assert.ok(s[ds], `dashT.${lang}.status.${ds} is missing — the badge will print the raw enum`)
      }
    }
  })

  it('in translations — the Orders table badge', () => {
    for (const lang of LANGS) {
      const s = translations[lang].dashboard.status as Record<string, string | undefined>
      for (const ds of DISPLAY_STATUSES) {
        assert.ok(s[ds], `translations.${lang}.dashboard.status.${ds} is missing`)
      }
    }
  })

  it('no label is left as an English enum name', () => {
    // The failure mode was a seller reading "confirmed" and "pending" in a
    // Uzbek interface. A label equal to its own key is that bug, spelled out.
    for (const lang of LANGS) {
      for (const ds of DISPLAY_STATUSES) {
        assert.notEqual((dashT[lang].status as Record<string, string>)[ds], ds, `dashT.${lang}.${ds}`)
        assert.notEqual((translations[lang].dashboard.status as Record<string, string>)[ds], ds,
          `translations.${lang}.${ds}`)
      }
    }
  })

  it('covers everything orderDisplayStatus can actually return', () => {
    // Guards the list above against drifting from the function it describes.
    const seen = new Set<string>()
    for (const status of ['pending', 'confirmed', 'delivered', 'cancelled', 'returned']) {
      for (const raw of [null, 'PROCESSING', 'DELIVERY', 'PICKUP', 'PACKING', 'DELIVERING', 'WHAT_IS_THIS']) {
        seen.add(orderDisplayStatus(status, raw))
      }
    }
    assert.deepEqual([...seen].sort(), [...DISPLAY_STATUSES].sort())
  })
})
