# Uzum seller-openapi — the finance surface, verbatim

Point-in-time evidence for §9.5 of `docs/plans/payouts-settlement-accuracy.md`, the
final word on why Daromadchi cannot show a Uzum payout status.

**Source:** `GET https://api-seller.uzum.uz/api/seller-openapi/swagger/api-docs`
(`info.title: "Uzum market seller openapi"`, `openapi: 3.0.0`), read with the
seller token on **2026-08-20**. Excerpts below are copied verbatim from that
response. To re-read the whole document at any time:

```
set -a; . ./.env; set +a
npm run probe:uzum-payout > /tmp/uzum-probe.json    # check1.allPaths / check1.financePaths
```

Only the decisive parts are reproduced here. A full copy would go stale silently
and invite someone to trust this file over the live spec; the probe is the way to
re-check.

---

## 1. The whole API is 35 paths, in 8 tags. None of them is payouts.

`tags`, in full:

```
FBO Invoice · Return Invoice · Product · Finance
Работа с заказами FBS/DBS · FBS Invoice · Stocks · Shop
```

There is no payouts, payments, settlements, balance or transfers tag. The
**Finance** tag — "Получение списка продаж/заказов" ("obtaining the list of
sales/orders") — carries exactly two paths:

| Path | Summary (verbatim) |
|---|---|
| `GET /v1/finance/orders` | Получение списка заказов. |
| `GET /v1/finance/expenses` | Получение списка расходов продавца. |

Sales, and expenses. Nothing reports money Uzum transferred to the seller.

> **Reconciling this with the probe's "14 finance-shaped paths".** The probe
> matches path names against a deliberately wide keyword regex that includes
> `invoice`. Those 14 are these 2 plus 12 delivery-note paths (`/v1/invoice`,
> `/v1/fbs/invoice/…`, `/v1/shop/{id}/invoice`, …), which are shipping paperwork,
> not money. The two numbers agree; 2 is the one that matters.

## 2. `/v1/finance/expenses` cannot represent a payout batch

It returns `SellerPaymentInfoDtoList` → `payments[]` of `SellerPaymentDto`:

```
type    : OUTCOME | INCOME                            "OUTCOME - исходящий платеж, INCOME - входящий платеж"
status  : CREATED | REFUNDED | CONFIRMED | CANCELED
fields  : id, dateCreated, dateUpdated, name, source, shopId, sellerId,
          paymentPrice, amount, externalId, code, dateService
```

Two independent reasons this is not the payout feed:

1. **It returned 0 rows** for this seller across a full year — after both payouts
   had landed in the bank. That is the empirical answer, and it is on its own
   sufficient.
2. **The DTO has no payout shape even if it were populated.** There is no batch
   identifier, no bank reference, no covered-orders list, and — decisively — no
   *failed* state. Batch №5000360785 **failed** and its money was re-issued
   across two later batches. A record type whose only terminal states are
   CONFIRMED, REFUNDED and CANCELED cannot express that, and a settlement signal
   that cannot see a failure cannot certify a payment.

The endpoint is named "расходов" (expenses) and filters by `sources` — it is the
seller's service charges (ads, fees), which is also why the ad-spend work found
zero OUTCOME rows in it earlier.

## 3. `withdrawnProfit` is an accounting field on the order, not a bank signal

Both places the spec defines it:

| Schema | Field | Description (verbatim) |
|---|---|---|
| `SellerOrderItemDto` | `sellerProfit` | Прибыль продавца |
| `SellerOrderItemDto` | `withdrawnProfit` | **Прибыль после вычета** |
| `SkuGroupedSellerItemDto` | `withdrawnProfit` | **Сумма изъятой прибыли** |

"Profit after deduction" / "amount of profit taken". It is a per-order figure in
the same block as `commission`, `logisticDeliveryFee` and `purchasePrice` — a
line in the order's economics, never a statement that money reached a bank. It
reads `0.00` on this seller's orders, and §9.2 records that it stayed `0.00`
after both payouts landed. The spec explains why: it was never that field.

## 4. The finance order status enum is closed at four values

`GET /v1/finance/orders`, parameter `statuses` (verbatim):

```
"Статусы заказов (к выводу средств (TO_WITHDRAW), в обработке (PROCESSING),
 отменен (CANCELED), частично отменен (PARTIALLY_CANCELLED))"

enum: [TO_WITHDRAW, PROCESSING, CANCELED, PARTIALLY_CANCELLED]
```

The same four appear on `SellerOrderItemDto.status`. This is what the probe's
`missingFromOurs: []` meant: the four statuses `lib/uzum/client.ts` sends are the
complete set. **`TO_WITHDRAW` — "к выводу средств", *for* withdrawal — is the
last state the API defines.** There is no WITHDRAWN, PAID or COMPLETED to wait
for. An order stays TO_WITHDRAW whether the money is still with Uzum or already
in the seller's bank.

## 5. Where scopes exist, the spec names them — and none is financial

Uzum does document permission-gated endpoints. `/v3/fbs/sku/stocks`:

```
403: "fbs-2-seller-access-denied: У селлера нет доступа, необходимы права 'SKU_READ'"
```

`SKU_READ` and `SKU_UPDATE` are the only named permissions in the document, both
on stock endpoints. `securitySchemes` is a single `TokenAuth` API key with no
scope list. **No finance or payout permission is named anywhere**, because there
is no finance or payout resource for one to gate.

---

## What this changes

The earlier reading of the probe — endpoints answering `403` while absent from
the spec, therefore "an access grant we do not hold" — was wrong. There is no
role-scoped API surface here: this document *is* the seller API, and it contains
no payout resource at all. The `403` on `/v1/finance/payments`, `/payouts`,
`/withdrawals` and the rest is the gateway's answer for a route that does not
exist, not a permission boundary.

So the ask is not "grant our token a scope". It is "do you plan to expose payout
data by API at all", and today's answer is that they do not have it to expose.
The «История выплат» in the seller panel comes from a system this API does not
publish.
