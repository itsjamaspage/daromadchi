/**
 * Guards the one number.
 *
 * The trial length has now been wrong in user-facing copy twice: the site
 * advertised 3 days for weeks after the code moved to 14, in four separate
 * tables and three languages. A comment saying "don't hardcode it" did not stop
 * it. This does: every copy table is scanned, and any sentence that mentions a
 * trial AND a day count must agree with TRIAL_DAYS.
 *
 * Run: node --import tsx --test lib/trial-copy.test.ts
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { TRIAL_DAYS } from './billing/features'
import { TRIAL_UZ, TRIAL_RU, TRIAL_EN, ruDays } from './trial-copy'
import { translations } from './i18n'
import { T } from './landing-t'
import { dashT } from './dashT'
import { tiersT } from './tiersT'
import { lockT } from './lockT'
import { getAllSlugs, getArticle, getCategoryList } from './help-content'

/** A day count: "14 kun", "14 дней", "3-day", "7 days". */
const DAY_COUNT = /(\d+)[\s-]?(kun|дн|day)/gi
/** Words that mark the sentence as being about the free trial. */
const TRIAL_WORD = /(sinov|пробн|trial)/i

/**
 * Every leaf string in a copy table, flattened. Functions are called with a
 * placeholder so interpolated copy (e.g. "N days left") is scanned too.
 */
function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value)
  else if (typeof value === 'function') {
    try { strings((value as (a: string) => unknown)('N'), out) } catch { /* not a copy fn */ }
  } else if (Array.isArray(value)) value.forEach(v => strings(v, out))
  else if (value && typeof value === 'object') Object.values(value).forEach(v => strings(v, out))
  return out
}

function helpStrings(): string[] {
  const out: string[] = []
  for (const lang of ['uz', 'ru', 'en']) {
    strings(getCategoryList(lang), out)
    for (const slug of getAllSlugs()) strings(getArticle(slug, lang), out)
  }
  return out
}

const TABLES: Record<string, () => string[]> = {
  'lib/i18n.ts': () => strings(translations),
  'lib/landing-t.ts': () => strings(T),
  'lib/dashT.ts': () => strings(dashT),
  'lib/tiersT.ts': () => strings(tiersT),
  'lib/lockT.ts': () => strings(lockT),
  'lib/help-content.ts': helpStrings,
}

describe('trial copy agrees with TRIAL_DAYS', () => {
  for (const [name, load] of Object.entries(TABLES)) {
    it(`${name} never advertises a trial length other than ${TRIAL_DAYS}`, () => {
      const wrong: string[] = []
      for (const line of load()) {
        // Split on sentence boundaries so an unrelated "≤ 3 days" threshold in a
        // neighbouring sentence cannot be blamed on a trial mentioned later.
        for (const sentence of line.split(/(?<=[.!?\n])/)) {
          if (!TRIAL_WORD.test(sentence)) continue
          for (const [, n] of sentence.matchAll(DAY_COUNT)) {
            if (Number(n) !== TRIAL_DAYS) wrong.push(sentence.trim())
          }
        }
      }
      assert.deepEqual(wrong, [], `copy claims a trial length that is not ${TRIAL_DAYS} days`)
    })
  }
})

describe('the interpolated forms', () => {
  it('build from TRIAL_DAYS', () => {
    assert.equal(TRIAL_UZ, `${TRIAL_DAYS} kun`)
    assert.equal(TRIAL_RU, `${TRIAL_DAYS} ${ruDays(TRIAL_DAYS)}`)
    assert.equal(TRIAL_EN, `${TRIAL_DAYS} days`)
  })

  it('declines the Russian day count correctly', () => {
    const cases: [number, string][] = [
      [1, 'день'], [2, 'дня'], [4, 'дня'], [5, 'дней'],
      [11, 'дней'], [12, 'дней'], [14, 'дней'], [21, 'день'], [22, 'дня'], [25, 'дней'],
    ]
    for (const [n, expected] of cases) {
      assert.equal(ruDays(n), expected, `${n} should take "${expected}"`)
    }
  })
})
