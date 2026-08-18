<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

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


<!-- BEGIN:skills-guidance -->
# Skills available in this repo (.claude/skills/)
Five skills are installed. Use each for its purpose — match skill to task, do not run all on everything.
- brainstorming: before implementing any non-trivial feature/change, turn the idea into an approved design first. Skip for trivial or fully-specified fixes.
- grill-me: user-invoked only (/grill-me). Use when asked to pressure-test a plan or design. Do not self-invoke.
- frontend-design: whenever building or reshaping UI (pages, components, tables).
- skill-creator: only when explicitly asked to create or edit a skill.
- find-skills: when a task might need a skill we don't have, search the ecosystem and suggest before hand-rolling.
For quick one-line changes, skip the process skills entirely.
<!-- END:skills-guidance -->
