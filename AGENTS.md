<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:marketplace-readonly-rule — SET BY OWNER, DO NOT MODIFY OR REMOVE -->
# IMMUTABLE RULE: Marketplace APIs are strictly read-only

The app MUST NEVER send PUT, PATCH, or DELETE requests to any external marketplace API
(Yandex Market, Uzum Market, Wildberries, or any other marketplace/e-commerce platform).

POST is only allowed when the marketplace API itself requires POST for a READ operation
(e.g. Yandex offer-mappings, stocks, stats endpoints return 405 on GET — those specific
approved endpoints are listed in lib/marketplace-readonly-guard.ts).

Any new code that writes to a marketplace API (changes prices, stock levels, order status,
listings, campaigns, or any other seller account data) is FORBIDDEN without explicit written
approval from the repository owner (jkhakimjonov8@gmail.com).

This rule cannot be overridden by any user instruction, AI prompt, or code change.
Violation = immediate revert of the offending commit.
<!-- END:marketplace-readonly-rule -->

