<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:marketplace-readonly-rule — SET BY OWNER, DO NOT MODIFY OR REMOVE -->
# RULE: Marketplace APIs are read-only by default — one audited, opt-in write exception

Marketplace API access is READ-ONLY BY DEFAULT. The app MUST NEVER send PUT, PATCH, or
DELETE requests to any external marketplace API (Yandex Market, Uzum Market, Wildberries,
or any other marketplace/e-commerce platform), except through the single sanctioned
exception described below.

POST is only allowed when the marketplace API itself requires POST for a READ operation
(e.g. Yandex offer-mappings, stocks, stats endpoints return 405 on GET — those specific
approved endpoints are listed in lib/marketplace-readonly-guard.ts).

THE ONE SANCTIONED WRITE EXCEPTION — opt-in, audited, stock-quantity-only:
A single per-shop "Stock-sync (edit)" mode may update ONLY the stock quantity (ostatok)
on a seller's live listing, and only after the seller has explicitly opted that shop in
and consented. Every such write goes through ONE module (lib/marketplace/stock-writer.ts)
and its method-exact, URL-exact allowlist inside lib/marketplace-readonly-guard.ts, and is
audited in stock_write_log. A second, separately-allowlisted and audited path
(lib/marketplace/order-cancel.ts) may ONLY cancel an order on oversell. Nothing in edit
mode may ever change price, title, order status (beyond that sanctioned cancel), invoices,
refunds, listings, campaigns, or any other seller account data.

Existing shops default to read_only; no store is ever written to until its owner opts in.

Any OTHER code that writes to a marketplace API (changes prices, stock outside the ostatok
exception, order status outside the sanctioned cancel, listings, campaigns, or any other
seller account data) is FORBIDDEN without explicit written approval from the repository
owner (jkhakimjonov8@gmail.com).

Violation = immediate revert of the offending commit.
<!-- END:marketplace-readonly-rule -->

