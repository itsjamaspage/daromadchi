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
]);

export default eslintConfig;
