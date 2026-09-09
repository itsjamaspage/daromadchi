# Task 15 & 16 — Product Creation + Returns Investigation

**Date:** 2026-09-09
**Status:** Investigation complete

---

## Task 15 — Create products → push to Uzum + Yandex

### Uzum Product Creation API

**Source:** Uzum OpenAPI spec (`GET /swagger/api-docs`, 35 paths, 8 tags)

The "Product" tag in Uzum's spec contains:

- `GET /v1/product/shop/{shopId}` — list products (already used by Daromadchi)

The spec has **no POST/PUT product creation endpoint**. The only write endpoints in the
entire 35-path spec are:

- `POST /v2/fbs/sku/stocks` — stock quantity update (already used by stock-writer)
- `POST /v1/fbs/order/{id}/cancel` — order cancellation (already used by order-cancel)

**Verdict: NOT FEASIBLE for Uzum.** The seller API does not expose product creation.
Uzum sellers create products exclusively through the seller cabinet UI
(seller.uzum.uz). There is no API path to create, update title/price/photos, or
manage product listings programmatically.

### Yandex Product Creation API

**Source:** Yandex Market Partner API docs + existing client code

Yandex **does** have product creation/update endpoints:

| Endpoint | Method | Purpose |
|---|---|---|
| `/v2/businesses/{businessId}/offer-mappings/update` | POST | Create or update offers |
| `/v2/businesses/{businessId}/offer-cards/update` | POST | Update offer card content |
| `/v2/businesses/{businessId}/offer-mappings/archive` | POST | Archive offers |
| `/v2/businesses/{businessId}/offer-mappings/unarchive` | POST | Unarchive offers |
| `/v2/categories/tree` | POST | Category tree (needed for mapping) |
| `/v2/category/{categoryId}/parameters` | POST | Category-specific required fields |

The existing codebase already reads from `/v2/businesses/{businessId}/offer-mappings`
(POST for read — already in APPROVED_POST_ENDPOINTS). The **update** variant is a
different URL and would be a **WRITE operation** — currently BLOCKED by the
marketplace-readonly-guard.

**Verdict: TECHNICALLY FEASIBLE for Yandex, but requires owner approval.** The Yandex
Partner API has full product CRUD. Implementation would require:

1. Adding `POST /v2/businesses/{businessId}/offer-mappings/update` to the guard's
   write allowlist (new intent, e.g. `'product-write'`)
2. Building the product creation form (category selection, required fields per category,
   photo upload, ИКПУ code from Task 13)
3. Mapping Daromadchi's product model to Yandex's offer-mappings schema
4. Owner approval for the new write path (MANDATORY — this is a new marketplace write)

### Combined Verdict for Task 15

**Partial feasibility:**
- **Uzum: NOT FEASIBLE** — no product creation API exists
- **Yandex: FEASIBLE** with owner approval for a new write path

A realistic scope: let sellers create products in Daromadchi and push to Yandex only.
Uzum products would still need to be created in the Uzum seller cabinet manually, then
synced into Daromadchi via the existing read path.

---

## Task 16 — Returns-from-warehouse (Sergeli) tracking

### Uzum Returns API

**Source:** Uzum OpenAPI spec — "Return Invoice" tag

The spec has a "Return Invoice" tag. The paths under it handle return/delivery paperwork.
These are **read-only GET endpoints** — no guard changes needed.

The existing order feed (`GET /v2/fbs/orders`) already returns orders with statuses
including `RETURNED` and `CANCELLED`. The `GET /v1/finance/orders` endpoint includes
`returnCause` and `amountReturns` fields on each finance line item.

**What's available:**
- Order status tracking already captures RETURNED status
- Finance orders endpoint has return cause and return amounts
- Return Invoice endpoints (if accessible) may have warehouse-specific data

**What's NOT available:**
- No specific "warehouse pickup" or "Sergeli location" endpoint
- No API field that says "this item is waiting at Sergeli warehouse for pickup"

**Verdict: PARTIALLY FEASIBLE.** We can show which orders were returned and their
return causes (already partially in the data). We cannot show warehouse-specific
pickup status (Sergeli queue) — that data likely lives only in Uzum's internal
logistics system, not in the seller API.

A realistic scope: surface returned orders with return reasons and amounts, highlighting
items the seller needs to collect. The exact warehouse pickup status would need to be
tracked manually by the seller.

---

## Recommendations

1. **Task 15:** Scope down to Yandex-only product creation. Requires owner approval for
   the new write intent. Uzum product creation is not possible via API.

2. **Task 16:** Build a returns dashboard using existing order status + finance data.
   Don't promise warehouse-specific tracking — the API doesn't support it.

3. **Both tasks depend on owner approval** before any implementation begins (per the
   reconstruction plan's STOP-REVIEW gates).
