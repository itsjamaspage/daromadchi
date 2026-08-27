# Codebase audit — 26 Aug 2026

A read-only sweep of the whole app. Every finding below was **reproduced or
demonstrated**, not inferred; where a claim needed evidence, the command that
produced it is quoted. Nothing here has been changed — this is the list, ranked
by what would hurt a seller most.

Scope: `app/` (194 files), `components/` (65), `lib/` (189), `scripts/` (16),
`extension/` (8) — ~80k lines, at `46cfb78`.

**Status — all six ranked findings are fixed and on `main`.** Findings 7–9 (the
LOW ones) are open by choice, and finding 10 below is a bug the audit's own
remediation introduced.

| # | finding | status |
|---|---|---|
| 1 | estimated fees stored as reported | #372 |
| 2 | CI ran no tests | #371 |
| 3 | five suites failing | #371 — one (`test:gating`) still open, see below |
| 4 | no sync concurrency control | #374 |
| 5 | plaintext credentials fallback | #373 |
| 6 | month-end overflow | #375 |
| 7 | marketplace calls bypassing the guard | open (all reads today) |
| 8 | per-row UPDATE loops | open |
| 9 | silent failure surfaces | open by design |
| 10 | deploy script quoting | #378 — **caused by finding 5's fix** |

---

## 1. Estimated marketplace fees are stored as if they were reported — FIXED (#372)

`lib/uzum/sync.ts:1191` derives a commission from the shop's balance and writes
it into `orders.marketplace_fee`:

```ts
const feeRate = totalFees / totalRevenue          // inferred from the balance
await db.update(orders).set({
  marketplace_fee: String(Math.round(rev * feeRate)),
}).where(eq(orders.id, o.id))
```

`lib/money/order-economics.ts:91` treats **any** non-null `marketplace_fee` as a
known fact:

```ts
: o.marketplaceFee != null ? known(o.marketplaceFee + (o.deliveryCost ?? 0))
: notKnown('fee_not_reported')
```

There is no column anywhere in the schema distinguishing an estimate from a
reported fee (`grep -n "estimated\|is_estimate\|fee_source" lib/db/schema.ts` →
no matches).

**Why it matters.** The whole point of the `Known<T>` work is that an unknown can
never be laundered into a fact. This is a back door into exactly that: the
display layer can no longer coerce a null to zero, but the *ingestion* layer can
manufacture a number the display layer will then trust absolutely. A seller sees
a confident «Чистая прибыль» computed from a fee nobody ever charged.

`lib/uzum/sync.ts:1201` does the same for `delivery_cost`.

**Fix shape:** a `fee_source` column (`reported` | `derived`), with `lib/money`
treating `derived` as `fee_not_reported`. Cheap, and it closes the loop.

---

## 2. No test runs in CI — FIXED (#371)

`.github/workflows/ci.yml` has four jobs: Lint, Type Check, Build, Health Check.
`grep -n "test" .github/workflows/ci.yml` matches only `runs-on: ubuntu-latest`.

There are **45 `test:*` scripts** in `package.json` and **no aggregate `npm test`**.

**Why it matters.** Every guardrail built to make a class of bug impossible —
`test:money` (the coalesce ban), `test:week` (the week-maths ban), `test:guard`
(the marketplace read-only ban) — is a plain test file that nothing executes. A
PR reintroducing `coalesce(cost_price, 0)` passes CI green. The `Known<T>` type
*is* enforced, because `tsc --noEmit` runs; the guards around it are not.

This also explains finding 3.

**Status: fixed.** A `Tests` job now runs on every push and PR — Postgres 16
service, schema + migrations, 44 of 45 suites. The suite list is read out of
`package.json` at run time rather than hardcoded, so a newly added suite is
picked up automatically instead of being silently skipped.

**Deliberately not in branch protection yet.** It runs and reports but cannot
block a merge until someone adds "Tests" to the required checks. Nothing depends
on it (`build`, `health-check`, `notify` untouched) and `deploy.yml` never waited
on CI, so it cannot affect a deploy. Promote it once you have watched it pass.

---

## 3. Five test suites failing on `main` — RESOLVED, except one

Diagnosed one by one. Four were environment or wiring, not broken behaviour —
only `test:gating` is genuinely blocked, and by module layering rather than a
failing assertion:

| suite | cause | status |
|---|---|---|
| `test:seo` | script pointed at `lib/seo/apex-redirect.test.ts`; the file was renamed to `canonical-host.test.ts` and the script never updated | **fixed** — one line |
| `test:admin` | asserts GLOBAL totals over `payments`, so any other suite inserting a paid row inflates it. The query is right — admin analytics *is* global | **fixed** — own database in CI |
| `test:nudge` | asserts "…and tells them on Telegram". `lib/telegram.ts:55` reads `TELEGRAM_BOT_TOKEN` at module load and returns `false` without it, so the test's own `fetch` mock is never reached | **fixed** — dummy token in CI env |
| `test:price-notice` | same cause | **fixed** — same |
| `test:gating` | `entitlement.ts` → `getCurrentUserId` → `shop-context` → `auth/session` → `auth/config` → `next-auth` → `next/navigation`. Outside Next's runtime that dies on `next/headers`, or under `--conditions=react-server` on React's server build having no `createContext`. `stock-sync` pulls the same chain | **open** |

**`test:gating` needs a refactor, not a test fix.** Billing rules should not
depend on the auth stack. Only `currentUserAccess()` needs the session; the three
functions the test exercises — `loadEntitlement`, `userHasFeature`,
`everyActiveShopIsReadOnly` — already take an explicit `userId`. Moving
`currentUserAccess` into its own module would let the suite run. Not bundled with
the CI change: it touches call sites across the dashboard.

**A latent break found while wiring CI:** `tsx` was never declared in
`package.json`, despite all 45 test scripts invoking `node --import tsx`. It
resolved only as a transitive dependency of `drizzle-kit`. A drizzle-kit bump
that dropped it, or a change in npm hoisting, would have broken every test at
once. Now an explicit devDependency pinned to 4.23.0 — the version already
resolved, so nothing moves.

## 4. Sync has no concurrency control — FIXED (#374)

`.github/workflows/deploy.yml:91-92` installs:

```
*/5 * * * * cron-runner.sh sync
*/5 * * * * cron-runner.sh stock-sync
```

and `cron-runner.sh` calls each with `curl -m 280` — a **280-second timeout on a
300-second interval**. `grep -rn "advisory_lock\|pg_try_advisory\|FOR UPDATE"`
over `lib/` and `app/` returns nothing: there is no lock, no in-flight flag, no
`flock` in the runner.

When a sync exceeds 280s the curl is killed but **the server-side request keeps
running**, and 20 seconds later the next tick starts another. The manual
«Sinxronlash» button calls the same `syncFromUzum`, so a user can collide with a
cron tick at any moment.

**Consequences, in order of likelihood:**
- Duplicate Telegram notifications — `detectNewOrders` is stateful, and two runs
  can both classify the same order as new.
- Double-applied fee backfill — finding 1's loop recomputes `feeRate` from a
  balance that the other run is concurrently changing.
- `orderItems` are written as `delete`-then-`insert` (`lib/uzum/sync.ts:919-921`,
  `lib/yandex/sync.ts:960-962`); interleaving those two pairs can drop items.

**Fix shape:** `pg_try_advisory_lock` keyed on `shop_id`, or `flock` in the
runner. The advisory lock is better — it also covers the manual button.

---

## 5. `encrypt()` silently stores plaintext when the key is missing — FIXED (#373)

`lib/crypto.ts:14`:

```ts
export function encrypt(plaintext: string): string {
  const key = getKey()
  if (!key) return plaintext        // ← "graceful degradation"
```

and `getKey()` returns `null` both when `ENCRYPTION_KEY` is unset **and** when it
is set but not exactly 32 bytes of base64. So a missing env var *or a typo'd key*
stores every seller's marketplace API token in the database in plaintext, with no
error and no warning.

Nothing checks for it: `grep -rn "ENCRYPTION_KEY"` across the repo finds only
`lib/crypto.ts`, two scripts, and the CI secret. `deploy.yml` warns when
`CRON_SECRET` is absent but says nothing about `ENCRYPTION_KEY`.

The asymmetry is the tell — `decrypt()` throws loudly on a missing key, while
`encrypt()` degrades silently. A deploy in this state is undetectable from the
outside and self-heals on the next deploy, leaving plaintext rows behind.

**Also:** `aes-256-cbc` with no authentication tag. Ciphertext is malleable and
there is no integrity check; `aes-256-gcm` is the standard choice here.

**Fix shape:** fail fast at boot when `ENCRYPTION_KEY` is absent or malformed,
plus a deploy-time check like the `CRON_SECRET` one.

---

## 6. `setMonth()` month-end overflow — FIXED (#375)

JavaScript rolls an overflowing day forward, so `31 May` minus one month is
`1 May`, not `1 April`. Demonstrated:

```
── Billing period end (lib/billing/plans.ts:124, activate.ts:83)
   paid 2026-01-31 for 1 month  →  expires 2026-03-03   ← overshoots
   paid 2026-03-31 for 1 month  →  expires 2026-05-01   ← overshoots
   paid 2026-08-31 for 1 month  →  expires 2026-10-01   ← overshoots

── demand.ts monthKeys, run on 31 Aug 2026 (6-month window)
   buckets : 2026-03, 2026-05, 2026-05, 2026-07, 2026-07, 2026-08
   expected: 2026-03, 2026-04, 2026-05, 2026-06, 2026-07, 2026-08
   MISSING : 2026-04, 2026-06     duplicated: 2026-05, 2026-07

── seasonality.ts (since = now − 11 months), run on 31 Aug 2026
   since = 2025-10-01   (expected September 2025 — a month of history dropped)
```

Sites: `lib/billing/activate.ts:83`, `lib/billing/plans.ts:124`,
`lib/db/seasonality.ts:34,99`, `lib/db/pnl.ts:390`, `lib/db/payouts.ts:39`,
`lib/db/demand.ts:21,64`.

**Severity split.** Billing always overshoots, never undershoots — the seller
gets a few extra days, so no one is overcharged, but renewals chaining from a
drifted end date compound it. `demand.ts` is the functional one: the
coefficient-of-variation that drives reorder advice is computed over a series
with two months double-counted and two months zero-filled, once a month, on the
29th–31st.

**Fix shape:** an `addMonths()` in `lib/period-week.ts` that clamps the day, and
a guardrail entry banning bare `setMonth`.

---

## 7. Three marketplace calls bypass the read-only guard — MEDIUM

`AGENTS.md` makes read-only the top constraint, and `marketplaceFetch` enforces
it. These three reach marketplace hosts with a raw `fetch()` instead:

- `app/api/uzum/sync/route.ts:63` → `api-seller.uzum.uz/.../v1/shops`
- `app/api/yandex/sync/route.ts:77` → `api.partner.market.yandex.ru/v2/campaigns/…/orders`
- `app/api/extension/product/route.ts:137` → Uzum public product API

**All three are currently GETs, so nothing is violated today.** The gap is
structural: the guard cannot see them, so nothing stops a later edit adding
`method: 'PUT'`. `lib/validate-token.ts` already does token validation *through*
the guard, so the pattern to copy exists.

**Fix shape:** route them through `marketplaceFetch`, then add a guardrail test
banning raw `fetch(` to a marketplace hostname.

---

## 8. Per-row `UPDATE` loops in sync — LOW (feeds finding 4)

~10 genuine per-row round-trip loops, the widest being the fee backfill at
`lib/uzum/sync.ts:1188` and `:1200`, which issue one `UPDATE` per order across
*every* non-cancelled order in the shop. Others: `identifier-backfill.ts:115,151`,
`stock-refresh.ts:138,233`, `yandex/sync.ts:398,855,920,1058`.

Not wrong, just slow — and sync slowness is what turns finding 4 from theoretical
into routine.

---

## 9. Silent failure surfaces — LOW / by design, worth revisiting

36 bare `catch {}` blocks and 63 `.catch(() => …)` in `app/` and `lib/`. Most are
deliberate (best-effort Telegram, response-body reads).

The one worth a second look is the dashboard pattern:

```ts
getKpis(...).catch(e => { console.error('[dashboard] getKpis', e); return emptyKpis })
```

The comment says this degrades one panel rather than 500ing the page, which is
reasonable — but the seller cannot tell "you sold nothing this week" from "the
query failed". Given how much of this session went into never showing a
confident wrong number, that distinction is worth surfacing.

---

## 10. The deploy script broke, and finding 5's fix is why — FIXED (#378)

The `ENCRYPTION_KEY` check added for finding 5 carried an unbalanced quote:

```bash
tr -d '"'"'"'"'"'"'"'"'
```

Generated by escaping shell through another language and never run. The YAML is
valid and the workflow lints, so it reached `main` and broke the next three
deploys:

```
bash: line 79: unexpected EOF while looking for matching `"'
```

The failure lands AFTER migrations apply and AFTER pm2 restarts, at the
"Installing cron schedule" step — so production kept receiving each deploy's
code while the crontab silently went un-refreshed and the job reported red.

Worth recording as a finding in its own right, because the lesson is not "check
your quoting": `bash -n` over the workflow's `run:` blocks would ALSO have missed
it. The deploy runs as `ssh … 'bash -s' <<'DEPLOY'`, and to the outer shell a
quoted heredoc is one opaque string — only the remote bash ever reads the body.
The guard (`scripts/workflow-syntax.test.ts`) therefore parses heredoc bodies as
scripts in their own right, and was verified by restoring the broken line and
confirming it reproduces the same message at the same line number.

---

## What I checked and found clean

Worth recording so the next audit does not redo it:

- **Tenancy.** Scanned every `db.select/update/delete/insert` touching a tenant
  table for a missing shop/user scope. 37 candidates, all scoped — either
  directly (`inArray(orders.shop_id, shopIds)`) or via an ID list derived from a
  scoped query. No cross-seller leak found.
- **Read-only guard.** `lib/uzum`, `lib/yandex` and `lib/marketplace` contain
  **zero** raw `fetch(` calls; everything goes through `marketplaceFetch`.
  `test:guard` passes 21/21. Only the three route-level calls in finding 7 sit
  outside it, and all are reads.
- **Extension token.** `crypto.randomUUID() + 16 random bytes` — strong. Stored
  plaintext with no expiry or rotation, which is worth deciding on, but not
  guessable.
- **Migrations.** All numbered migrations from 021 to 085 are registered in
  `scripts/apply-sql-migrations.mjs`. (`ARCHITECTURE.md` said "current through
  080" — corrected to 085 in this change.) Only `020_dashboard_rpcs.sql` is
  unregistered, which is pre-runner and intentional.
- **Cron auth.** All five cron endpoints check `CRON_SECRET`.

---

## Suggested order

1. ~~**Finding 2 + 3**~~ **Done** (#371). 46 of 47 suites now run in CI.
2. ~~**Finding 1**~~ **Done** (#372).
3. ~~**Finding 5**~~ **Done** (#373) — and see finding 10 for what that cost.
4. ~~**Finding 4**~~ **Done** (#374).
5. ~~**Finding 6**~~ **Done** (#375).

**What is left**, smallest first:

- **`test:gating`** — the one suite still excluded from CI. `entitlement.ts`
  imports the auth stack via `getCurrentUserId`, and only `currentUserAccess()`
  needs it; the three functions the test exercises already take an explicit
  `userId`. Moving that one function out would let the suite run.
- **Findings 7–9** — the LOW ones, all still open and all still low.
- **CBC → GCM** for credential encryption. Deliberately deferred: it needs a
  dual-format decrypt and a rollback plan, because a token written as GCM cannot
  be read by the previous release.
3. **Finding 5** — one boot-time check; the downside is plaintext credentials.
4. **Finding 4** — an advisory lock keyed on `shop_id`.
5. **Finding 6** — `addMonths()` plus a guardrail line.
6. Findings 7–9 as cleanup.
