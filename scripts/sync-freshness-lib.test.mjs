// Pure watchdog-decision tests. Run: node --test scripts/sync-freshness-lib.test.mjs
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { classifyFreshness, decideNotification, fmtAge, STATUS } from './sync-freshness-lib.mjs'

const MIN = 60_000
const THRESHOLD = 40 * MIN
const REALERT = 60 * MIN
const now = 1_000_000_000_000

describe('classifyFreshness', () => {
  it('is QUIET when there are no active shops (nothing to sync)', () => {
    assert.deepEqual(classifyFreshness({ activeShops: 0, freshestMs: null, nowMs: now, thresholdMs: THRESHOLD }),
      { status: STATUS.QUIET, ageMs: null })
  })
  it('is OK when the freshest read is within the window', () => {
    const r = classifyFreshness({ activeShops: 3, freshestMs: now - 10 * MIN, nowMs: now, thresholdMs: THRESHOLD })
    assert.equal(r.status, STATUS.OK)
    assert.equal(r.ageMs, 10 * MIN)
  })
  it('is STALE exactly at the threshold and beyond', () => {
    assert.equal(classifyFreshness({ activeShops: 3, freshestMs: now - THRESHOLD, nowMs: now, thresholdMs: THRESHOLD }).status, STATUS.STALE)
    assert.equal(classifyFreshness({ activeShops: 3, freshestMs: now - 90 * MIN, nowMs: now, thresholdMs: THRESHOLD }).status, STATUS.STALE)
  })
  it('is OK one ms under the threshold', () => {
    assert.equal(classifyFreshness({ activeShops: 3, freshestMs: now - THRESHOLD + 1, nowMs: now, thresholdMs: THRESHOLD }).status, STATUS.OK)
  })
  it('is STALE with null freshest but active shops (never synced), ageMs null', () => {
    assert.deepEqual(classifyFreshness({ activeShops: 3, freshestMs: null, nowMs: now, thresholdMs: THRESHOLD }),
      { status: STATUS.STALE, ageMs: null })
  })
})

describe('decideNotification', () => {
  it('pages on the edge into STALE', () => {
    const r = decideNotification({ prev: { status: STATUS.OK, lastNotifiedMs: null }, currStatus: STATUS.STALE, nowMs: now, reAlertMs: REALERT })
    assert.equal(r.notify, 'alert')
    assert.equal(r.nextState.lastNotifiedMs, now)
  })
  it('pages on first run if already stale (prev undefined)', () => {
    const r = decideNotification({ prev: {}, currStatus: STATUS.STALE, nowMs: now, reAlertMs: REALERT })
    assert.equal(r.notify, 'alert')
  })
  it('stays quiet while stale within the re-alert gap', () => {
    const prev = { status: STATUS.STALE, lastNotifiedMs: now - 10 * MIN }
    const r = decideNotification({ prev, currStatus: STATUS.STALE, nowMs: now, reAlertMs: REALERT })
    assert.equal(r.notify, null)
    assert.equal(r.nextState.lastNotifiedMs, now - 10 * MIN)   // unchanged
  })
  it('re-pages once the re-alert gap elapses', () => {
    const prev = { status: STATUS.STALE, lastNotifiedMs: now - 61 * MIN }
    const r = decideNotification({ prev, currStatus: STATUS.STALE, nowMs: now, reAlertMs: REALERT })
    assert.equal(r.notify, 'alert')
    assert.equal(r.nextState.lastNotifiedMs, now)
  })
  it('sends recovery on STALE → OK', () => {
    const r = decideNotification({ prev: { status: STATUS.STALE, lastNotifiedMs: now - 5 * MIN }, currStatus: STATUS.OK, nowMs: now, reAlertMs: REALERT })
    assert.equal(r.notify, 'recovery')
    assert.equal(r.nextState.status, STATUS.OK)
  })
  it('is silent on steady OK', () => {
    assert.equal(decideNotification({ prev: { status: STATUS.OK, lastNotifiedMs: null }, currStatus: STATUS.OK, nowMs: now, reAlertMs: REALERT }).notify, null)
  })
  it('is silent on QUIET even coming from stale (no shops to watch)', () => {
    assert.equal(decideNotification({ prev: { status: STATUS.STALE, lastNotifiedMs: now }, currStatus: STATUS.QUIET, nowMs: now, reAlertMs: REALERT }).notify, null)
  })
})

describe('fmtAge', () => {
  it('formats minutes, hours, and the null case', () => {
    assert.equal(fmtAge(null), 'no sync on record')
    assert.equal(fmtAge(10 * MIN), '10m')
    assert.equal(fmtAge(95 * MIN), '1h35m')
  })
})
