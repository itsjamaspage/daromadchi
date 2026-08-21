import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// ─── IMMUTABLE RULE (owner: jkhakimjonov8@gmail.com) ─────────────────────────
// All marketplace API calls must go through marketplaceFetch() from
// lib/marketplace-readonly-guard.ts. Raw fetch() is banned in marketplace
// files to prevent accidental write calls to seller accounts.
// DO NOT remove or weaken this rule without owner approval.
const MARKETPLACE_FILES = [
  "lib/yandex/**",
  "lib/uzum/**",
  "lib/wildberries/**",
  "lib/validate-token.ts",
];

// ─── Seller-notification language guard ──────────────────────────────────────
// sendTelegramMessage(chatId, text) takes a finished string, so a caller had to
// REMEMBER to resolve the seller's notif_lang. Four senders forgot, and one
// seller received two different languages in the same chat. Localising those
// four fixed four bugs and prevented none; this rule removes the way to make
// the mistake.
//
// Every seller-facing message must go through sendSellerMessage /
// sendSellerMessageTo in lib/telegram-seller.ts, which resolves the language
// and takes a BUILDER — there is no way to hand it a hardcoded string.
//
// The allowlist below is only for messages that are NOT to a seller in their
// stored language: admin/ops chats, and the bot webhook which replies in the
// language of the chat it is already in. Adding a file here means asserting
// that. Do not add a notification path to it.
const TELEGRAM_RAW_SEND_ALLOWED = [
  "lib/telegram.ts",              // the primitive itself
  "lib/telegram-seller.ts",       // the guarded wrapper — the only seller path
  "lib/telegram-admin.ts",        // ops alerts to admin chats
  "app/api/feedback/**",          // seller feedback → admin chat
  "app/api/account/request-deletion/**", // deletion request → admin chat
  "app/api/telegram/webhook/**",  // replies in the chat's own language
  // Both of these DO message sellers, and each is here for a stated reason —
  // not because it predates the rule. Re-check the reason before trusting it.
  //
  //   nudge.ts     — resolves notif_lang per recipient and builds every text
  //                  through pickLang(u.lang) before calling its local tell().
  //                  Correct today; migrating it to sendSellerMessageTo would
  //                  be tidier but changes nothing a seller sees.
  //   lifecycle.ts — sends dormancy and deletion warnings BILINGUALLY, Uzbek
  //                  and Russian in one message, on purpose. These are legally
  //                  significant and go to accounts that have been inactive for
  //                  months, whose stored language preference is the least
  //                  trustworthy thing about them. Do not "fix" it to one
  //                  language.
  "lib/billing/nudge.ts",
  "lib/billing/lifecycle.ts",
  "**/*.test.ts",
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",

    // Vendored agent skills (.claude/skills/**) are third-party tooling, not
    // app source: they ship their own CommonJS helper scripts and Python, and
    // are never bundled or executed by the app. Linting them fails CI's `lint`
    // job, and `build` depends on `lint` — so without this, adding a skill
    // blocks every deploy.
    ".claude/**",
  ]),

  // Marketplace read-only enforcement: ban raw fetch() in marketplace files.
  // The guard itself (marketplace-readonly-guard.ts) is intentionally excluded.
  {
    files: MARKETPLACE_FILES,
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.name='fetch']",
          message:
            "[READONLY GUARD] Use marketplaceFetch() from lib/marketplace-readonly-guard instead of fetch(). " +
            "Raw fetch() is banned in marketplace files to prevent write calls to seller accounts.",
        },
        {
          selector: "MemberExpression[property.name='fetch']",
          message:
            "[READONLY GUARD] Use marketplaceFetch() from lib/marketplace-readonly-guard instead of fetch(). " +
            "Raw fetch() is banned in marketplace files to prevent write calls to seller accounts.",
        },
      ],
    },
  },
  // Seller notifications must carry the seller's language — see the note above.
  {
    files: ["app/**/*.ts", "app/**/*.tsx", "lib/**/*.ts"],
    ignores: TELEGRAM_RAW_SEND_ALLOWED,
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/telegram",
              importNames: ["sendTelegramMessage"],
              message:
                "[NOTIF LANG GUARD] Use sendSellerMessage / sendSellerMessageTo from " +
                "lib/telegram-seller instead. sendTelegramMessage takes a finished string, " +
                "so the seller's notif_lang can be forgotten — which is how sellers received " +
                "alerts in a language they never chose. The seller path resolves the language " +
                "and takes a builder, so a hardcoded message cannot be passed.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
