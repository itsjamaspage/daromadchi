/**
 * The notifications link that closes every seller alert.
 *
 * It is appended in renderSellerText rather than in each message builder,
 * because that is the single funnel every seller alert passes through — digest,
 * new orders, cancellations, stock-sync, oversell, manual-stock, extension
 * alerts, price notices. These tests hold that seam: the link lands on every
 * alert, exactly once, in every language, and never at the cost of the alert.
 *
 * Run: node --import tsx --test lib/telegram-seller-render.test.ts
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { renderSellerText, notificationsUrl, FALLBACK_TEXT } from './telegram-seller-render'
import { notifT, type NotifLang } from './notif-i18n'

const LANGS: NotifLang[] = ['uz', 'ru', 'en']

describe('notificationsUrl', () => {
  it('points at the in-app notification list on the production apex by default', () => {
    assert.equal(notificationsUrl(), 'https://daromadchi.uz/dashboard/notifications')
  })

  it('follows NEXT_PUBLIC_APP_URL so a staging bot links to staging', () => {
    const prev = process.env.NEXT_PUBLIC_APP_URL
    process.env.NEXT_PUBLIC_APP_URL = 'https://staging.daromadchi.uz/'
    try {
      // Trailing slash trimmed — "…uz//dashboard" is a broken link on some clients.
      assert.equal(notificationsUrl(), 'https://staging.daromadchi.uz/dashboard/notifications')
    } finally {
      if (prev === undefined) delete process.env.NEXT_PUBLIC_APP_URL
      else process.env.NEXT_PUBLIC_APP_URL = prev
    }
  })
})

describe('every seller alert ends with the link', () => {
  it('appends it in each language, after the alert body', () => {
    for (const lang of LANGS) {
      const out = renderSellerText(() => 'ALERT BODY', lang)
      assert.ok(out.startsWith('ALERT BODY'), `${lang}: body not preserved — ${out}`)
      assert.ok(out.endsWith(notifT(lang).notificationsCta(notificationsUrl())), `${lang}: link not last`)
    }
  })

  it('links to the notifications page, not the dashboard root', () => {
    const out = renderSellerText(() => 'x', 'ru')
    assert.match(out, /https:\/\/daromadchi\.uz\/dashboard\/notifications/)
  })

  it('never doubles up when a builder already included the link', () => {
    const url = notificationsUrl()
    const out = renderSellerText(() => `body ${url}`, 'ru')
    assert.equal(out.split(url).length - 1, 1, out)
  })

  it('one link per message, however many lines the alert has', () => {
    const body = ['line 1', 'line 2', 'line 3'].join('\n')
    const out = renderSellerText(() => body, 'uz')
    assert.equal(out.split('/dashboard/notifications').length - 1, 1)
  })
})

describe('the alert always survives the link', () => {
  it('a broken builder still reaches the fallback, with a single link', () => {
    // FALLBACK_TEXT carries its own link; a second one would give the message
    // that exists for emergencies two competing exits.
    const out = renderSellerText(() => { throw new Error('boom') }, 'ru')
    assert.equal(out, FALLBACK_TEXT)
    assert.equal(out.split('daromadchi.uz').length - 1, 1)
  })

  it('falls back to Uzbek copy and still links', () => {
    let calls = 0
    const out = renderSellerText((_, lang) => {
      calls++
      if (lang !== 'uz') throw new Error('ru copy broken')
      return 'UZ BODY'
    }, 'ru')
    assert.equal(calls, 2)
    assert.ok(out.startsWith('UZ BODY'))
    assert.match(out, /\/dashboard\/notifications/)
  })
})
