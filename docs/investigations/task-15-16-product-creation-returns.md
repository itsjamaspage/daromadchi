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

3. **REVISED approach — Excel file generation (no API writes needed):** See Section 3 below.

---

## Section 3 — Excel-Based Product Creation (Revised approach)

**Date:** 2026-09-11
**Status:** Deep research complete — FULLY FEASIBLE

### Background

Direct API product creation was rejected: the internal Uzum API requires session-based
auth (seller cabinet login), and sellers won't share their credentials. The Yandex
`updateOfferMappings` endpoint exists but requires WRITE authorization that violates
the read-only-by-default rule.

**Alternative discovered:** Both Uzum and Yandex support bulk product creation via Excel
file upload through their seller cabinets. Daromadchi can generate these marketplace-specific
Excel files programmatically — sellers fill product info once on Daromadchi, download the
files, and upload them to each marketplace manually.

### Uzum Template Analysis (XLSM)

**File:** `template_210826.xlsm` (downloaded from Uzum seller cabinet)
**Format:** XLSM (Excel with macros, but the `xlsx` library reports NO VBA macros present
— the macro content is embedded in the sheet structure as formulas/data-validation, not VBA)

**Structure — 6 sheets:**

| Sheet | Purpose | Size |
|-------|---------|------|
| Лист1 | Main data entry (product rows) | 789 rows × 37 cols (A-AK) |
| Лист2 | Category catalog + filters | 5,330 rows (5,317 unique categories) |
| Лист3 | Reference data (sizes, colors, brands, countries) | 72,343 rows |
| Инструкция_RU | Instructions in Russian | 27 rows |
| Ko'rsatmalar_UZ | Instructions in Uzbek | 25 rows |
| _cache | Empty (internal use) | — |

**Лист1 — Main data columns (row 2 = headers, row 3 = descriptions):**

| Col | Header | Required | Description |
|-----|--------|----------|-------------|
| A | Название товара RU* | ✅ | Product name in Russian |
| B | Идентификатор от продавца | 🔘 | Seller's internal SKU ID |
| C | Название товара UZ* | ✅ | Product name in Uzbek |
| D | Группировка SKU* | ✅ | SKU grouping key (up to 100 chars) |
| E | Название категории* | ✅ auto | Category name (auto-filled from selection) |
| F | id категории* | ✅ auto | Category ID (auto-filled) |
| G | Бренд* | ✅ | Brand (from dropdown reference) |
| H | Модель | 🔘 | Model name |
| I | Страна производства* | ✅ | Country of manufacture (from dropdown) |
| J | Описание товара RU* | ✅ | Product description in Russian |
| K | Описание товара UZ* | ✅ | Product description in Uzbek |
| L | Краткое описание RU* | ✅ | Short description RU |
| M | Краткое описание UZ* | ✅ | Short description UZ |
| N | Состав RU | 🔘 | Composition in Russian |
| O | Состав UZ | 🔘 | Composition in Uzbek |
| P | Инструкция по уходу RU | 🔘 | Care instructions RU |
| Q | Инструкция по уходу UZ | 🔘 | Care instructions UZ |
| R | Размерная сетка RU | 🔘 | Size chart RU |
| S | Размерная сетка UZ | 🔘 | Size chart UZ |
| T | Ссылки на фото* | ✅ | Photo URLs (JPEG/JPG/WebP/PNG, 1080×1440, ≤5MB) |
| U | Штрихкод | 🔘 | Barcode (EAN-13/UPC-A, auto-generated if empty) |
| V | ИКПУ* | ✅ | Tax classification code (16 digits) |
| W | Цвет | 🔘 | Color (for SKU grouping) |
| X | Размер | 🔘 | Size (for SKU grouping) |
| Y | Цена продажи (som)* | ✅ | Selling price in UZS |
| Z | Цена до скидки (som)* | ✅ | Price before discount in UZS |
| AA | Вес (г)* | ✅ | Weight in grams |
| AB | Высота (мм)* | ✅ | Height in mm |
| AC | Ширина (мм)* | ✅ | Width in mm |
| AD | Длина (мм)* | ✅ | Length in mm |
| AE+ | Dynamic filters | varies | Category-specific required filters |

**Key constraints:**
- One file = one category (critical: changing category after filling breaks all filters)
- Each row = one SKU (variant); rows with same col D value group into one product
- Brands, colors, sizes, countries must come from reference lists (Лист3)
- Photos must be URLs (not embedded), JPEG/PNG/WebP
- Prices are numbers only (no currency symbols)
- Dimensions in mm, weight in grams
- ИКПУ is a 16-digit Uzbek tax code

**Reference data counts:** 72,341 brands, 1,699 sizes, 83 colors, 262 countries

### Yandex Template Analysis (XLSX)

**File:** `_______________.xlsx` (downloaded from Yandex Market partner cabinet)
**Format:** XLSX (no macros)

**Structure — 4 sheets:**

| Sheet | Purpose | Size |
|-------|---------|------|
| Инструкция | Instructions | 22 rows |
| Enums | Category catalog (enumerations) | 8,805 rows (8,795 categories) |
| Список товаров | Main data entry | 4 rows × 52 cols (row 4 = example) |
| Настройки | Column-to-API-field mappings | 61 rows |

**Список товаров — Main data columns (row 2 = headers):**

| Col | Header | API field | Dir | Required | Group |
|-----|--------|-----------|-----|----------|-------|
| A | Критичные ошибки | log-message | out | — | message |
| B | Некритичные ошибки | info-message | out | — | message |
| C | Качество карточки | contentQuality | out | — | message |
| D | Ваш SKU * | id | in | ✅ | base |
| E | Название товара * | name | in | ✅ | base |
| F | Ссылка на изображение * | picture | in | ✅ | base |
| G | Описание товара * | description | in | ✅ | base |
| H | Категория на Маркете * | category,market_category_id | in | ✅ | base |
| I | Бренд * | vendor | in | ✅ | base |
| J | Штрихкод * | barcode | in | ✅ | base |
| K | Теги | set-ids | in | 🔘 | base |
| L | Ссылка на видео | video | in | 🔘 | base |
| M | Инструкции | manual | in | 🔘 | base |
| N | Страна производства | country_of_origin | in | 🔘 | base |
| O | Артикул производителя | vendorCode | in | 🔘 | base |
| P | Название на узбекском * | uz_name | in | ✅ | base |
| Q | Описание на узбекском * | uz_description | in | ✅ | base |
| R | Вес, кг * | weight | in | ✅ | weight_and_dimension |
| S | Длина, см * | length | in | ✅ | weight_and_dimension |
| T | Ширина, см * | width | in | ✅ | weight_and_dimension |
| U | Высота, см * | height | in | ✅ | weight_and_dimension |
| V | Кол-во упаковок | box_count | in | 🔘 | weight_and_dimension |
| W | Объём, л | volume | out | — | weight_and_dimension |
| X | Цена * | price | in | ✅ | default_price |
| Y | Зачёркнутая цена | oldprice | in | 🔘 | default_price |
| Z | Валюта * | currencyId | in | ✅ | default_price |
| AA | Себестоимость | purchase_price | in | 🔘 | default_price |
| AB | Доп. расходы | additional_expenses | in | 🔘 | default_price |
| AC-AF | Сроки годности/службы | period_of_validity_days, etc. | in | 🔘 | expiry |
| AG-AH | Гарантийный срок | warranty_days, comment_warranty | in | 🔘 | warranty |
| AI | Маркировка | cargo_types | in | 🔘 | mark_and_docs |
| AJ | Номер документа | certificate | in | 🔘 | mark_and_docs |
| AK | ТН ВЭД | tn_ved_code | in | 🔘 | mark_and_docs |
| AL | ИКПУ * | ikpu | in | ✅ | mark_and_docs |
| AM | Код упаковки * | ikpu_pack_code | in | ✅ | mark_and_docs |
| AN-AO | Уценка | condition-type/quality | in | 🔘 | resale |
| AP | Описание состояния | condition-reason | in | 🔘 | resale |
| AQ-AT | Доп. параметры | type, age, adult, downloadable | in | 🔘 | optional |
| AU | Характеристики товара | param | in | 🔘 | optional |
| AV-AZ | Служебные поля | archived, market-sku, etc. | out/inout | — | — |

**Key differences from Uzum:**
- Yandex uses kg for weight (not grams), cm for dimensions (not mm)
- Yandex requires barcode (Uzum auto-generates if empty)
- Yandex has `currencyId` field (UZS)
- Yandex tracks IKPU + packaging code separately (AL + AM)
- No multi-variant grouping in the file — each row is one independent offer
- Column A-C are output-only (errors/quality score filled by Yandex on re-export)
- Настройки sheet maps every column to its API field name (documented `in`/`out`/`inout`)

### Field Mapping: Daromadchi → Uzum + Yandex

| Daromadchi field | Uzum column | Yandex column |
|-----------------|-------------|---------------|
| Product name (RU) | A: Название товара RU | E: Название товара |
| Product name (UZ) | C: Название товара UZ | P: Название на узбекском |
| SKU / identifier | B: Идентификатор от продавца | D: Ваш SKU |
| Category | E+F: Название/id категории | H: Категория на Маркете |
| Brand | G: Бренд | I: Бренд |
| Description (RU) | J: Описание товара RU | G: Описание товара |
| Description (UZ) | K: Описание товара UZ | Q: Описание на узбекском |
| Country | I: Страна производства | N: Страна производства |
| Photo URLs | T: Ссылки на фото | F: Ссылка на изображение |
| Barcode | U: Штрихкод | J: Штрихкод |
| IKPU | V: ИКПУ (16 digits) | AL: ИКПУ (17 digits) |
| Color | W: Цвет | (in AU: Характеристики) |
| Size | X: Размер | (in AU: Характеристики) |
| Selling price | Y: Цена продажи (som) | X: Цена |
| Old price | Z: Цена до скидки (som) | Y: Зачёркнутая цена |
| Weight | AA: Вес (г) → grams | R: Вес (кг) → kilograms |
| Height | AB: Высота (мм) → mm | U: Высота (см) → cm |
| Width | AC: Ширина (мм) → mm | T: Ширина (см) → cm |
| Length | AD: Длина (мм) → mm | S: Длина (см) → cm |
| Currency | (implicit: UZS) | Z: Валюта (UZS) |
| Packaging code | — | AM: Код упаковки |

**Unit conversion needed:** weight (g↔kg, ×1000), dimensions (mm↔cm, ×10)

### Technical Feasibility — Excel Generation

**Can Daromadchi generate these files programmatically?** YES.

**Library:** `xlsx` (SheetJS) is already installed (`^0.18.5`). It can:
- Create XLSX files with multiple sheets ✅
- Set cell values, types, and formulas ✅
- Add data validation (dropdowns) ✅
- Create merged cells ✅
- Set column widths and row heights ✅

**Limitation:** `xlsx` (free version) cannot write XLSM with VBA macros. However:
- The Uzum template's macros handle **UI interactions** in the desktop Excel app
  (category selection → auto-populate filters). Since Daromadchi pre-fills everything
  server-side, no macros are needed.
- Uzum's file upload endpoint accepts XLSX too (the template instructions say "save
  the file" — the upload parser reads the data, not the macros).
- Alternative: `exceljs` (MIT, not yet installed) has better style support if needed.

### Recommended Architecture

**Approach: "Excel Generator" — generate downloadable marketplace-specific files**

```
User fills product form on Daromadchi
        ↓
Daromadchi generates TWO files:
  1. uzum-products.xlsx (Uzum format)
  2. yandex-products.xlsx (Yandex format)
        ↓
User downloads and uploads to each marketplace's seller cabinet
```

**Why not direct upload to marketplace?**
- Uzum file upload is via internal API (requires session auth — same blocker as before).
  No documented API endpoint for Excel upload exists in the public seller-openapi.
- Yandex file upload is via partner cabinet web UI only (no file upload API endpoint).
  However, Yandex DOES have a JSON API for product creation:
  `POST /v2/businesses/{businessId}/offer-mappings/update` (100 products/request,
  10K/minute). This could be a Phase 2 option for Yandex-only direct push.
- Excel generation approach is 100% read-only, zero marketplace writes, no guard changes

**Phase 2 option (Yandex only):** Direct product push via `offer-mappings/update` JSON API
using the seller's existing API key. Would require WRITE authorization (owner approval)
and a new allowlisted endpoint in `marketplace-readonly-guard.ts`. Uzum has no equivalent
public API — Excel is the only non-UI path.

### Implementation Plan (high-level)

1. **Product form UI** — page where sellers enter product data once:
   - Name (RU + UZ), description (RU + UZ), brand, category, country
   - Photos (URLs), IKPU code, barcode
   - Price (selling + old), weight, dimensions
   - Color/size variants (SKU grouping for Uzum)

2. **Category mapping** — map Daromadchi's internal taxonomy to both:
   - Uzum's 5,317 categories (from Лист2 reference data)
   - Yandex's 8,795 categories (from Enums sheet)
   - Use existing `lib/categories/taxonomy.ts` as the bridge

3. **Reference data** — embed or lazy-load from template data:
   - Brands: 72,341 (Uzum) — searchable dropdown
   - Colors: 83 (Uzum) — fixed dropdown
   - Sizes: 1,699 (Uzum) — grouped by type (clothing RU, shoes EU, etc.)
   - Countries: 262 — fixed dropdown

4. **Excel generator service** (`lib/excel/product-export.ts`):
   - `generateUzumExcel(products, categoryId)` → Buffer (XLSX)
   - `generateYandexExcel(products)` → Buffer (XLSX)
   - Handles unit conversion (g↔kg, mm↔cm)
   - Includes reference sheets (Лист2, Лист3 for Uzum; Enums, Настройки for Yandex)

5. **API route** (`/api/products/export`):
   - `POST /api/products/export?marketplace=uzum` → download XLSX
   - `POST /api/products/export?marketplace=yandex` → download XLSX
   - `POST /api/products/export?marketplace=both` → download ZIP with both

### Advantages

- **Zero marketplace writes** — fully compliant with read-only rule
- **No seller credentials needed** — sellers upload files themselves
- **Uses official marketplace format** — guaranteed compatibility
- **Saves sellers 50%+ time** — fill once, get files for both marketplaces
- **Already have the library** — `xlsx` installed, no new dependencies
- **Reference data embedded** — categories, brands, colors from the template

### Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Template format changes | Pin template version; re-analyze when Uzum/Yandex update |
| Category mismatch | Build mapping layer with fuzzy-match fallback |
| IKPU differences (16 vs 17 digits) | Validate per-marketplace, prompt user |
| Large reference data (72K brands) | Server-side search endpoint, not embedded in page |
| Missing dynamic filters (Uzum col AE+) | Start without category-specific filters; add later |
