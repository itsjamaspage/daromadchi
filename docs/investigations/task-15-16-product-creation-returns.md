# Task 15 & 16 — Product Creation + Returns Investigation

**Date:** 2026-09-09
**Status:** Investigation complete (revised — product creation CONFIRMED via internal API)

---

## Task 15 — Create products → push to Uzum + Yandex

### Uzum Product Management API

**Source:** Uzum OpenAPI spec (`GET /swagger/api-docs`, 35 paths, 8 tags)

The "Product" tag description reads: "Получение остатков SKU/информации о товарах и
**изменение цен**, работа с этикетками" — explicitly mentions **price changes**.

Product tag endpoints:

| Endpoint | Method | Purpose |
|---|---|---|
| `GET /v1/product/shop/{shopId}` | GET | List products (already used by Daromadchi) |
| `POST /v1/product/{shopId}/sendPriceData` | POST | **Change SKU prices** |
| `POST /v1/product/shop/{shopId}/barcodes/print` | POST | Print barcode labels (returns PDF) |

#### Price management via `sendPriceData`

The `POST /v1/product/{shopId}/sendPriceData` endpoint accepts `SendPriceData`:

```
SendPriceData {
  productId: integer (required)
  skuList: SendPriceSkuData[] (required)
}

SendPriceSkuData {
  fullPrice: number  — full price (до скидки)
  sellPrice: number  — sell price (после скидки)
  skuId: integer (required)
}
```

This is a **WRITE endpoint** that modifies live listing prices on Uzum.

#### Full list of Uzum write endpoints (POST)

| Endpoint | Purpose | Category |
|---|---|---|
| `POST /v1/product/{shopId}/sendPriceData` | Change SKU prices | **Product** |
| `POST /v1/product/shop/{shopId}/barcodes/print` | Print barcode labels | Product |
| `POST /v2/fbs/sku/stocks` | Update stock quantities | Stocks (already used) |
| `POST /v1/fbs/order/{orderId}/cancel` | Cancel FBS order | Orders (already used) |
| `POST /v1/fbs/order/{orderId}/confirm` | Confirm FBS order | Orders |
| `POST /v1/fbs/order/{orderId}/identifier` | Bind identifiers to order items | Orders |
| `POST /v1/dbs/order/{orderId}/delivering` | DBS order → delivering | Orders |
| `POST /v1/dbs/order/{orderId}/completed` | DBS order → completed | Orders |
| `POST /v1/dbs/order/{orderId}/refund` | DBS order refund | Orders |
| `POST /v1/fbs/invoice` | Create FBS invoice | Invoices |
| `POST /v1/fbs/invoice/{invoiceId}/update-content` | Update invoice content | Invoices |
| `POST /v1/fbs/invoice/{invoiceId}/cancel` | Cancel invoice | Invoices |
| `POST /v1/fbs/invoice/dop/time-slot` | Update drop-off point/timeslot | Invoices |

#### Uzum Internal API — Product Creation (CONFIRMED)

**Source:** Network traffic captured from Uzum seller cabinet (seller.uzum.uz) during
live product creation on 2026-09-09.

The seller cabinet uses a **different API surface** from the documented seller-openapi:

- **Documented API:** `https://api-seller.uzum.uz/api/seller-openapi/...`
- **Internal API:** `https://api-seller.uzum.uz/api/seller/shop/{shopId}/product/...`

The internal API has full product CRUD. Confirmed endpoints:

| Endpoint | Method | Purpose |
|---|---|---|
| `.../childCategories?parentId={id}` | GET | Category tree navigation |
| `.../active?categoryId={id}` | GET | Check if category accepts new products |
| `.../getDefinedCharacteristics?...` | GET | Characteristics/attributes for category |
| `.../required-characteristics?categoryId={id}` | GET | Required fields per category |
| `.../fields` | GET | Product field definitions |
| `.../field-descriptions?categoryId={id}` | GET | Field descriptions/help text |
| `.../values?filterId={id}&page=0` | GET | Filter/attribute value options |
| `.../check-words` | POST | Content moderation/validation |
| `.../upload` | POST | Photo/file upload |
| **`.../createProduct?testVariant=B`** | **POST** | **Create product — returned 201!** |
| `.../product?productId={id}` | GET | Fetch created product by ID |

All endpoints are under `https://api-seller.uzum.uz/api/seller/shop/{shopId}/product/`.

**Request payload shape** (from captured createProduct call):

```json
{
  "categoryId": 13983,
  "title": { "ru": "...", "uz": "..." },
  "shortDescription": { "ru": "..." },
  "description": { "ru": "<p>...</p>" },
  "productImages": [{ "deletable": true, "url": "https://..." }],
  "definedCharacteristics": [{ "orderingNumber": 0, ... }],
  "filterValues": [{ "filterId": 6, "filterValueId": 139... }],
  "productFields": { "WARRANTY": 6 },
  "skuList": [],
  "productCertificates": [],
  "video": null
}
```

**Response** (201 Created): returns the created product with `id: 3319347`,
`shopSkuTitle`, full characteristics, filters, and commission info.

**Auth:** The cabinet uses `Authorization: Bearer {token}` — same header format as the
seller-openapi. **NEEDS VERIFICATION:** whether the same API token works on both surfaces,
or whether the internal API requires a session-derived token (the cabinet also sends a JWT
in cookies). This is the single remaining unknown before implementation.

#### Uzum Verdict (Final)

**Product CREATION: FEASIBLE** via the internal seller API. The endpoint
`POST /api/seller/shop/{shopId}/product/createProduct` exists and returns 201.
Supporting endpoints for categories, characteristics, photo upload, and content
validation are all present. Pending: auth token compatibility verification.

**Product PRICE MANAGEMENT: FEASIBLE** via the documented seller-openapi.
The `sendPriceData` endpoint can update `fullPrice` and `sellPrice` for any SKU.

**Both write paths require:**

1. New intents in the marketplace-readonly-guard (`'product-create'`, `'price-write'`)
2. Owner approval (MANDATORY — these are new marketplace writes)
3. Audit logging similar to stock writes

**Order management: FEASIBLE but separate scope.** Confirm, identifier binding, DBS
delivery/completion/refund endpoints exist. These are order-lifecycle operations, not
product creation — they belong in a separate task if needed.

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
   photo upload, IKPU code from Task 13)
3. Mapping Daromadchi's product model to Yandex's offer-mappings schema
4. Owner approval for the new write path (MANDATORY — this is a new marketplace write)

### Combined Verdict for Task 15

| Capability | Uzum | Yandex |
|---|---|---|
| Create new product from scratch | **FEASIBLE** (internal API) | FEASIBLE |
| Update prices on existing products | **FEASIBLE** (`sendPriceData`) | FEASIBLE |
| Update stock quantities | Already implemented | FEASIBLE |
| Upload product photos | **FEASIBLE** (internal API) | FEASIBLE |
| Archive/unarchive listings | NOT FEASIBLE | FEASIBLE |

**Realistic scope for Task 15:**
- **Uzum:** Full product creation via internal API + price management via seller-openapi
  (pending auth token verification)
- **Yandex:** Full product creation + price management
- **Both:** Require owner approval for new write intents in the readonly guard

---

## Task 16 — Returns-from-warehouse (Sergeli) tracking

### Uzum Returns API (Revised — significantly more data available than initially assessed)

**Source:** Uzum OpenAPI spec — "Return Invoice" tag

The spec has a "Return Invoice" tag with dedicated return invoice endpoints. These are
**read-only GET endpoints** — no guard changes needed.

#### Return Invoice Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `GET /v1/shop/{shopId}/return` | GET | List return invoices for a shop |
| `GET /v1/shop/{shopId}/return/{returnId}` | GET | Detailed return invoice |
| `GET /v1/return` | GET | Global seller returns list |
| `GET /v1/fbs/order/return-reasons` | GET | Return reasons enum |

#### Data available in return invoices

**`GET /v1/shop/{shopId}/return`** returns `SellerReturnLite[]`:

```
SellerReturnLite {
  id: integer
  dateCreated: string (date-time)
  status: enum [CREATED, IN_TRANSIT, READY_TO_PICK, PICKED, EXPIRED, CANCELLED]
  stock: {                        ← WAREHOUSE INFO
    title: string                 ← warehouse name
    address: string               ← full address (e.g. "г. Ташкент, Сергелийский район...")
  }
  timeSlotReservation: {          ← PICKUP SCHEDULING
    timeSlotId: integer
    startTime: string (date-time)
    endTime: string (date-time)
    status: enum [PENDING, ACTIVE, COMPLETED, EXPIRED]
  }
  paidStorage: {                  ← STORAGE FEES
    startDate: string (date-time)
    endDate: string (date-time)
    dailyRate: number
  }
  type: enum [DEFECTED, RETURN, FBS]   ← return reason category
}
```

**`GET /v1/shop/{shopId}/return/{returnId}`** returns `SellerReturnDto` with additional
`returnItems` array:

```
SellerReturnDto extends SellerReturnLite {
  returnItems: [{
    skuId: integer
    amount: integer               ← quantity returned
    packedAmount: integer         ← quantity packed for pickup
    skuTitle: string
    productTitle: string
    purchasePrice: number
  }]
}
```

#### Key finding: Warehouse-specific data IS available

The `stock.address` field contains the physical warehouse address (e.g. Sergeli). The
`status` enum tracks the return lifecycle:

1. `CREATED` — return initiated
2. `IN_TRANSIT` — items being moved to warehouse
3. **`READY_TO_PICK`** — items at warehouse, waiting for seller pickup
4. `PICKED` — seller collected the items
5. `EXPIRED` — pickup window expired
6. `CANCELLED` — return cancelled

The `timeSlotReservation` provides the exact pickup window (start/end time) and its
status (PENDING → ACTIVE → COMPLETED/EXPIRED).

The `paidStorage` data shows when storage fees begin, the daily rate, and the end date —
giving sellers urgency to pick up before fees accumulate.

#### Uzum Verdict (Revised)

**FULLY FEASIBLE.** The return invoice endpoints provide:
- Which items are returned and why (type: DEFECTED/RETURN/FBS)
- Which warehouse they're at (stock.title + stock.address — identifies Sergeli)
- Whether items are ready for pickup (status: READY_TO_PICK)
- The pickup time window (timeSlotReservation)
- Storage fee information (paidStorage)
- Item-level detail (SKU, quantity, title, purchase price)

This is significantly more data than initially assessed. A returns dashboard can show
everything a seller needs: what's waiting, where, when to pick it up, and how much
storage costs if they don't.

### Existing data (supplementary)

The order feed (`GET /v2/fbs/orders`) and finance endpoint (`GET /v1/finance/orders`)
provide additional context:
- Order-level RETURNED status
- `returnCause` and `amountReturns` on finance line items

These complement the return invoice data but are not needed as the primary source.

---

## Recommendations

1. **Task 15 (Product creation) — FEASIBLE on BOTH marketplaces:**
   - **Uzum:** Product creation confirmed via internal API at
     `/api/seller/shop/{shopId}/product/createProduct`. Full flow: category selection →
     characteristics → photo upload → create. **Blocker:** verify that the existing
     seller API token authenticates against the internal API surface (quick test needed).
   - **Yandex:** Full product creation via `/v2/businesses/{businessId}/offer-mappings/update`.
   - **Both:** Require new write intents in the guard + owner approval.

2. **Task 16 (Returns tracking) — FULLY FEASIBLE:**
   - Build a returns dashboard using the return invoice endpoints.
     The API provides warehouse location (Sergeli identification), pickup readiness
     status, time slot scheduling, storage fees, and item-level detail.
   - All endpoints are read-only GET — no guard changes needed.
   - Implementation: add `fetchReturnInvoices` and `fetchReturnDetail` to the Uzum
     client, then build the dashboard UI.

3. **Next step:** Verify auth token compatibility between seller-openapi and the internal
   seller API. If the same token works, product creation can proceed immediately after
   owner approval. If not, investigate the internal API's auth flow (JWT-based session
   tokens from the seller cabinet login).
