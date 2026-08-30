# Runbook — Gate A: the mandatory dry-run before ledger writes go live

The stock ledger (#421, Part 1) must ship through **Gate A**: the first deploy
runs with **seeding enabled and marketplace writes suppressed**, so the first
seeded tick's *would-write-vs-current* diff can be reviewed before any quantity
reaches Uzum or Yandex. Writes are enabled only after a human reviews that diff
and records it clean. There is no automatic promotion.

This runbook is the operator's checklist. It changes no code — the mechanism
already exists in `stock-writer.ts` (`ledgerDryRunOn()`) and `stock_write_log`.

Spec: `docs/plans/stock-ledger-wiring-spec.md` §9 and §12.

---

## 0. Preconditions

- Migration `090_users_ledger_kill_switch.sql` is applied (the per-user kill
  switch column). Verify: `\d users` shows `ledger_kill_switch`.
- You have the deploy timestamp handy — every query below filters on it, so a
  previous run's rows can't muddy the review. Capture it right before deploy:

  ```bash
  DEPLOY_AT=$(date -u +%FT%TZ); echo "$DEPLOY_AT"
  ```

---

## 1. Turn the dry run ON, then deploy

`STOCK_LEDGER_DRY_RUN` is read at **runtime** inside `ledgerDryRunOn()`, so it
takes effect on process restart with no rebuild. Accepted truthy values:
`1`, `true`, `yes`, `on` (case-insensitive).

In the app's environment file (the same one that holds `DATABASE_URL`):

```bash
STOCK_LEDGER_DRY_RUN=on
```

Then deploy/restart as usual. While this is set, every intended ledger write is
recorded as a `stock_write_log` row with `dry_run = true` carrying the target
quantity, and **nothing reaches a marketplace**.

Confirm it's live after restart — the first sync tick should start producing
dry-run rows:

```sql
SELECT count(*) FROM stock_write_log
WHERE dry_run = true AND reason = 'dry_run' AND created_at >= :deploy_at;
```

Zero after a tick or two means the flag didn't take (check the env value and
that the process actually restarted).

---

## 2. Review the diff (the Gate)

The diff compares each intended quantity against the listing at the time:

```sql
SELECT w.product_id, p.sku, p.stock_quantity AS current_listing,
       w.quantity AS would_write,
       w.quantity - p.stock_quantity AS delta
  FROM stock_write_log w
  JOIN products p ON p.id = w.product_id
 WHERE w.dry_run = true
   AND w.created_at >= :deploy_at
 ORDER BY abs(w.quantity - p.stock_quantity) DESC;
```

**Clean means:** every row's `delta` is either `0`, or explained by an open order
or a known drift **with the explanation written down**. An unexplained row is a
blocker, not a curiosity — do not enable writes until it's understood.

### 2.1 PBGRY specifically (the incident SKU)

PBGRY is the listing the live 0→1 oversell wrote to. Gate A's pass/fail for it:

```sql
SELECT w.sku, p.stock_quantity AS current_listing, w.quantity AS would_write
  FROM stock_write_log w
  JOIN products p ON p.id = w.product_id
 WHERE w.dry_run = true AND w.created_at >= :deploy_at
   AND p.sku ILIKE '%PBGRY%'
 ORDER BY w.created_at DESC;
```

- **PASS:** for a seller-zeroed PBGRY listing, `would_write = 0`. The ledger
  seeds to 0 and would keep it at 0 — the old code's phantom `1` is gone.
- **FAIL:** `would_write = 1` (or any non-zero) against a listing the seller set
  to 0 with no open order to justify it. Stop — do not enable writes; the seed
  math is wrong for this group. Capture the row and re-open the investigation.

---

## 3. Enable writes (only after a recorded clean verdict)

Write the verdict down (who reviewed, when, and the one-line "clean, deltas all
0/explained"). Then remove the flag and restart:

```bash
# delete or comment out the line, OR set it off explicitly:
STOCK_LEDGER_DRY_RUN=off
```

Restart. Writes are now live. Watch the **first live tick** and confirm it stays
consistent with the dry-run diff — no surprise deltas:

```sql
SELECT sku, status, reason, quantity, requested_quantity, created_at
  FROM stock_write_log
 WHERE dry_run = false AND created_at >= :writes_enabled_at
 ORDER BY created_at DESC LIMIT 50;
```

### 3.1 Confirm PBGRY stays 0

The end-to-end proof: a seller-zeroed PBGRY listing must remain 0 after writes go
live — the ledger must not push a `1` back onto it.

```sql
SELECT w.sku, w.quantity AS wrote, w.status, w.created_at
  FROM stock_write_log w
 WHERE w.dry_run = false AND w.created_at >= :writes_enabled_at
   AND w.sku ILIKE '%PBGRY%'
 ORDER BY w.created_at DESC;
```

`wrote = 0` (or no write attempted) is the pass. A `wrote = 1` is the incident
reproducing — pull the switch immediately (§4).

---

## 4. If something is wrong — how to stop

Ordered least to most drastic:

- **Park one seller** without a deploy: set their kill switch.
  ```sql
  UPDATE users SET ledger_kill_switch = true WHERE email = '<seller-email>';
  ```
  Their groups fall back to the legacy pool path on the next tick; everyone else
  is unaffected.
- **Re-suppress all ledger writes:** set `STOCK_LEDGER_DRY_RUN=on` and restart —
  back to dry-run, no marketplace writes.
- **Stop all stock writes entirely** (the global switch, unchanged by the
  ledger): `STOCK_SYNC_KILL_SWITCH=on` and restart.

---

## 5. Gate A is passed when

Per spec §12, Part 1 is done in production when **all** hold:

- a real cancellation restores its group to 10, observed end to end;
- the Gate A dry-run diff was reviewed and recorded clean (§2), PBGRY included;
- writes were enabled and one subsequent live tick is clean (§3), with PBGRY
  confirmed staying at 0.

Only then does Part 2 start, on its own branch.
