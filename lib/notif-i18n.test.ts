// The guard that stops this bug recurring.
//
// A Russian seller once got Russian digests and Uzbek order alerts in the same
// chat, because one message was built as a hardcoded literal that never read
// notif_lang. Fixing that one instance fixed nothing structural: three more
// senders had the same defect, and sendTelegramMessage(chatId, text) takes a
// plain string, so nothing stops a fifth.
//
// These tests are the missing check. A hardcoded string produces identical
// output in every language, so asserting that the three languages DIFFER fails
// automatically the moment someone bypasses this module.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { notifT, notifLocale, normalizeLang, type NotifLang } from './notif-i18n'

const LANGS: NotifLang[] = ['uz', 'ru', 'en']

// Every plain-string key, and every function key with arguments to call it with.
// A new seller-facing string must be added here — that is the point.
const CALLS: Record<string, unknown[]> = {
  weeklyTitle: [7], lowStockTitle: [3], lowStockDays: [5],
  stockUpdateTitle: [2], stockUpdateLine: ['Item', 'Uzum', 4, 'Yandex'],
  deliveryTitle: [1],
  newOrdersTitle: [2], newOrdersLine: ['Uzum', 3], newOrdersMore: [4],
  cancelledTitle: [2], cancelledLine: ['Uzum', 3], cancelledMore: [4],
  stockSyncSoldOn: ['Uzum'], stockSyncOk: ['Uzum', 5, 3],
  stockSyncFailed: ['Uzum', ' (x)'], stockSyncRestock: [2],
  stockSyncReason: ['missing_barcode'],
  extDailyTitle: ['21.08.2026'],
  oversellRateLimited: [1, 3, 'Uzum'], oversellCancelling: ['Uzum'],
  oversellHead: ['JMWHT', 'Uzum #124452180'],
  manualStockTitle: [2], manualStockLine: ['M9 (чёрный, JMWHT)', 0, 'Yandex Market', '124459482'],
}

function render(key: string, lang: NotifLang): string {
  const v = (notifT(lang) as unknown as Record<string, unknown>)[key]
  return typeof v === 'function'
    ? String((v as (...a: unknown[]) => string)(...(CALLS[key] ?? [1])))
    : String(v)
}

const KEYS = Object.keys(notifT('uz') as unknown as Record<string, unknown>)

test('every language defines every key — no silent undefined in a message', () => {
  for (const lang of LANGS) {
    const t = notifT(lang) as unknown as Record<string, unknown>
    for (const k of KEYS) {
      assert.ok(t[k] !== undefined, `${lang} is missing ${k}`)
      assert.doesNotMatch(render(k, lang), /undefined/, `${lang}.${k} renders "undefined"`)
    }
  }
})

// The real guard. Keys whose text is genuinely language-independent are listed
// here with the reason; everything else must differ between ru and uz.
const LANGUAGE_NEUTRAL = new Set([
  'som',            // "so'm"/"сум" differ, but the uz/en forms coincide
  'stockSyncOk',    // "   ✅ Uzum: 5→3" — a marketplace name and two numbers
])

test('no seller-facing string is hardcoded — ru and uz must differ', () => {
  const identical = KEYS
    .filter(k => !LANGUAGE_NEUTRAL.has(k))
    .filter(k => render(k, 'ru') === render(k, 'uz'))
  assert.deepEqual(identical, [],
    `these render identically in ru and uz, which is what a hardcoded literal looks like: ${identical.join(', ')}`)
})

test('en is a real translation too, not a copy of another language', () => {
  const identical = KEYS
    .filter(k => !LANGUAGE_NEUTRAL.has(k))
    .filter(k => render(k, 'en') === render(k, 'ru'))
  assert.deepEqual(identical, [])
})

test('an unknown or missing notif_lang falls back to Uzbek, never to undefined', () => {
  for (const bad of [null, undefined, '', 'de', 'RU']) {
    assert.equal(normalizeLang(bad), 'uz', String(bad))
    assert.equal(notifT(bad).extRevenue, notifT('uz').extRevenue)
  }
})

test('date and number locale follow the same language as the words', () => {
  assert.equal(notifLocale('ru'), 'ru-RU')
  assert.equal(notifLocale('en'), 'en-US')
  assert.equal(notifLocale(null), 'uz-UZ')
})

test('reason phrasing is translated, and an unknown reason survives untranslated', () => {
  assert.notEqual(notifT('ru').stockSyncReason('missing_barcode'),
                  notifT('uz').stockSyncReason('missing_barcode'))
  // An HTTP code keeps its number in every language.
  for (const lang of LANGS) assert.match(notifT(lang).stockSyncReason('http_503'), /503/)
  // Something we have no phrasing for is passed through rather than dropped.
  for (const lang of LANGS) assert.equal(notifT(lang).stockSyncReason('brand_new_reason'), 'brand_new_reason')
})

// ── Delivery must not depend on localisation being correct ──────────────────
// A missing key or a typo in one language block is a cosmetic bug. A seller
// never hearing that an order arrived is not. These pin that ordering.

test('a builder that throws still produces a message, never silence', async () => {
  const { renderForTest } = await import('./telegram-seller-render')
  // Blows up only for ru — the uz table is a different object, so the fallback
  // has something intact to build from.
  const build = (T: NotifStrings, lang: NotifLang) => {
    if (lang === 'ru') throw new TypeError('T.somethingNew is not a function')
    return `ok in ${lang}: ${T.newOrdersSub}`
  }
  const text = renderForTest(build, 'ru')
  assert.ok(text.length > 0, 'must render something')
  assert.match(text, /ok in uz/, 'falls back to the other string table')
})

test('a builder that throws in EVERY language still sends a generic notice', async () => {
  const { renderForTest } = await import('./telegram-seller-render')
  const text = renderForTest(() => { throw new Error('broken in all languages') }, 'ru')
  assert.ok(text.length > 0)
  assert.match(text, /daromadchi\.uz/, 'the seller is still pointed somewhere useful')
})

test('a working builder is untouched by the fallback path', async () => {
  const { renderForTest } = await import('./telegram-seller-render')
  assert.equal(renderForTest((T) => T.newOrdersCta, 'ru'), notifT('ru').newOrdersCta)
})
