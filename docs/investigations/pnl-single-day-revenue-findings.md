# P&L / revenue chart shows a whole period's sales on one day

**Reported:** On `/dashboard/pnl` for 24–30 Aug 2026, the revenue chart shows a
single 315K bar on **26 Aug** and nothing on the other days, although the seller
had order activity across several days. "It should show sales in different days."

## How the chart is built (not a rendering bug)

- `lib/db/pnl.ts` → `getPnl()` buckets orders by **`orders.ordered_at`** (the day
  the order was *placed*) and counts **delivered-only** revenue.
- `app/dashboard/pnl/page.tsx` feeds `pnl.rows` straight into `PnlChart`.
- `lib/db/revenue.ts` (the dashboard's daily chart) does the same:
  `date(orders.ordered_at)` grouping.

So every date bucket on the dashboard, P&L and revenue chart is keyed on
`ordered_at`. If many orders share one `ordered_at`, they all pile onto one bar.
The rendering is faithful — the question is whether `ordered_at` is correct.

## Evidence from the screenshot

| Day    | Orders | Cancelled | Revenue | Commission | Delivery |
|--------|--------|-----------|---------|------------|----------|
| 24 Aug | 0      | 2         | 0       | —          | —        |
| 25 Aug | 0      | 1         | 0       | 34 000     | 10 500   |
| 26 Aug | 3      | 2         | 315 000 | 27 025     | 6 000    |

Two facts matter:

1. **Cancellations keep distinct dates (24 and 25 Aug).** So `ordered_at` is *not*
   collapsing globally — orders that stopped being re-synced kept their real day.
2. **All delivered revenue sits on 26 Aug**, and 25 Aug even carries real
   settlement fees with *zero* delivered orders. So orders genuinely exist on
   24/25/26 — but only the delivered ones, all dated 26 Aug, carry revenue.

That pattern — cancelled orders frozen on their real day, active/delivered orders
all bunched on the most-recent sync day — is the fingerprint of an `ordered_at`
that gets **overwritten on every re-sync**.

## Root cause: Uzum `ordered_at` is overwritten with the sync time

`lib/uzum/sync.ts`:

- `parseOrderedAt(o.dateCreated ?? o.createdAt)` returned **`new Date()` (the sync
  time)** whenever the payload had no parseable date, instead of signalling
  "unknown".
- The order **upsert's UPDATE path ran that value on every poll**
  (`ordered_at: r.ordered_at`). An order stays in the active-orders API until it
  is delivered/archived, so each sync re-wrote its `ordered_at`. If any of those
  re-sync payloads lacked `dateCreated`, the fallback walked the date forward to
  the current sync day.

Net effect: orders placed on different days, still being synced, converge onto
"today" (26 Aug), while orders that dropped out of the feed (cancelled) keep the
last date they were written with. Exactly the screenshot.

**Yandex is not affected.** `lib/yandex/sync.ts` uses
`parseYandexDate(o.creationDate) ?? parseYandexDate(o.updatedAt)` and **drops**
orders with no parseable date rather than defaulting to now — so it never stamps
the sync time onto an order.

## The fix (`lib/uzum/sync.ts`)

`ordered_at` is treated as the **immutable placement date**:

1. `parseOrderedAt` now returns `Date | null` — `null` for a missing/unparseable
   date instead of silently becoming the sync time.
2. **Insert** (first sighting) uses `r.ordered_at ?? new Date()` — a brand-new
   row must have *some* date, and the sync time is the only fallback available
   the very first time we see an order.
3. **Update** only sets `ordered_at` when the payload carried a parseable date
   (`r.ordered_at != null`). A dateless re-sync leaves the stored date untouched
   — it can never overwrite a real order date with the sync time.

Because the update still writes a *good* date when one is present, a later sync
that does carry `dateCreated` will **heal** any row previously stamped with a
fallback, snapping it back to the true order day.

Covered by `lib/uzum/ordered-at.test.ts` (null contract + parse cases + the
"distinct days stay distinct" regression).

### Scope guard

No revenue **semantics** were changed: still delivered-only, still bucketed by
order date. Nothing on the dashboard/P&L/KPIs changes for orders whose date
already parsed correctly. The only behavioural change is in the previously-silent
failure case, which now preserves the stored date instead of moving it.

## Confirm on the box, and heal existing rows

The fix stops *future* collapse and self-heals on the next good sync. To verify
the cause and see whether current rows are already collapsed, on the prod box:

```sql
-- Are many recent Uzum orders bunched on one ordered_at (the sync day)?
SELECT date(ordered_at) AS day, count(*), min(status), max(status)
FROM orders
WHERE marketplace = 'uzum' AND ordered_at >= now() - interval '10 days'
GROUP BY 1 ORDER BY 1;

-- Do the collapsed rows share (near) the same timestamp — i.e. a sync time,
-- not organic order times spread through the day?
SELECT order_id_external, status, ordered_at
FROM orders
WHERE marketplace = 'uzum' AND status = 'delivered'
  AND ordered_at::date = '2026-08-26'
ORDER BY ordered_at;
```

If those delivered rows share a suspiciously tight timestamp, they were stamped
by the old fallback. After deploying this fix, running a **full Uzum order sync**
(one that fetches `dateCreated`) rewrites them to their real placement dates and
the chart spreads back out across the days.
