/**
 * THE POINT OF THIS FILE
 *
 * Every profit bug this project has shipped had the same shape: a money column
 * that the marketplace had not reported yet, coerced to zero, then subtracted
 * as though it were a fact. `coalesce(marketplace_fee, 0)` says "Yandex charged
 * nothing". `coalesce(cost_price, 0)` says "these goods were free". Neither is
 * true, and both produce a number that looks plausible enough to trust —
 * a 100% margin, a weekly profit larger than that week's sales.
 *
 * Fixing the call sites is not enough, because the next query written against
 * these tables will reach for the same coalesce. So this test scans the
 * repository's own source and FAILS if the pattern reappears outside the one
 * module allowed to make that decision.
 *
 * lib/money is allowed it because that is where the decision is made once and
 * made properly: load-order-economics.ts pairs its `coalesce(sum(...), 0)` with
 * a `count(*) filter (where cost_price is null)` and throws the sum away when
 * that count is non-zero. The coalesce is safe there BECAUSE something is
 * watching it. Nowhere else is anything watching it.
 *
 * If this test fails on code you just wrote: don't add your file to the
 * allowlist. Load the period through `loadOrderInputs` and price it through
 * `sumEconomics`, or — if your query genuinely cannot — carry a `missing`
 * count beside the sum and surface it, the way lib/money does.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = join(import.meta.dirname, '..', '..')

/** Money columns whose NULL means "not known", never "zero". */
const MONEY_COLUMNS = [
  'cost_price',
  'cost_per_unit',
  'marketplace_fee',
  'delivery_cost',
]

/** JS-side spellings of the same columns. */
const MONEY_FIELDS = [
  ...MONEY_COLUMNS,
  'costPrice',
  'costPerUnit',
  'marketplaceFee',
  'deliveryCost',
]

/**
 * lib/money owns this decision — see the header. Nothing else is exempt.
 */
const ALLOWED = [
  'lib/money/',
]

/**
 * The escape hatch, and why it is a comment rather than a file allowlist.
 *
 * A handful of these expressions are genuinely not the bug. `(p.cost_price ?? 0) > 0`
 * is a filter asking "does this product HAVE a cost" — the zero is never read as
 * money. Summing the fees already recorded in our own rows to decide whether to
 * backfill is a sum of what we recorded, and zero is the right answer for a row
 * we recorded nothing on. A file allowlist would exempt those files entirely,
 * including the next money bug written into them. So the opt-out is per line:
 *
 *     // money-guard-ok: <why this zero is not a coerced unknown>
 *
 * on the line before, or trailing the line itself. The reason is mandatory and
 * has to be a sentence, not a shrug — it shows up in the diff, where a reviewer
 * reads it. That does mean anyone can silence this test by typing a sentence.
 * The test can't stop that and doesn't pretend to; what it stops is the pattern
 * going in unnoticed.
 */
const OPT_OUT = /(?:\/\/|\/\*|\{\/\*)\s*money-guard-ok:\s*(\S.*)/

/**
 * True when `line`, or the comment block directly above it, carries a reasoned
 * opt-out.
 *
 * It searches `comments` — the source with all CODE blanked out — rather than
 * the raw lines. That does two things at once: the marker cannot be smuggled in
 * inside a string literal, and the walk upward can use "is this line blank?" as
 * its contiguity test, which works identically for `//` runs, multi-line
 * `/* … *\/` blocks and JSX `{/* … *\/}`. Checking `startsWith('//')` did not:
 * the second line of a wrapped block comment starts with neither.
 */
function optedOut(comments: string[], lineNo: number): boolean {
  const check = (l: string | undefined) => {
    const m = l != null ? OPT_OUT.exec(l) : null
    // A bare `// money-guard-ok:` explains nothing; require an actual reason.
    return !!m && m[1].trim().length >= 20
  }
  if (check(comments[lineNo - 1])) return true
  for (let i = lineNo - 2; i >= 0 && comments[i].trim() !== ''; i--) {
    if (check(comments[i])) return true
  }
  return false
}

/**
 * Split the source into "code with comments blanked" and "comments with code
 * blanked", in ONE pass.
 *
 * It has to be one pass, because the two questions are circular: a comment can
 * contain a quote (`// reads a zero as "nothing"`) and a string can contain a
 * comment opener (`const s = "// money-guard-ok: …"`). Blanking strings first
 * mangles the comments; stripping comments first lets a string masquerade as
 * one. Only a scanner that tracks both states at once gets both right — and it
 * has to, or the opt-out is bypassable by typing the marker inside a string.
 *
 * Backtick templates stay VERBATIM in `code`: every SQL fragment here is a
 * drizzle template literal, and blanking those would blank the expressions the
 * coalesce scan exists to read. Newlines are preserved on both sides so a
 * character offset still maps to the same line number.
 */
function scan(src: string): { code: string; comments: string } {
  const code: string[] = []
  const comments: string[] = []
  const push = (ch: string, isComment: boolean) => {
    const blank = ch === '\n' ? '\n' : ' '
    code.push(isComment ? blank : ch)
    comments.push(isComment ? ch : blank)
  }

  let i = 0
  while (i < src.length) {
    const ch = src[i], next = src[i + 1]

    if (ch === '/' && next === '/') {
      while (i < src.length && src[i] !== '\n') push(src[i++], true)
      continue
    }
    if (ch === '/' && next === '*') {
      push(src[i++], true); push(src[i++], true)
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) push(src[i++], true)
      if (i < src.length) { push(src[i++], true); push(src[i++], true) }
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch
      push(src[i++], false)
      while (i < src.length && src[i] !== quote) {
        if (src[i] === '\\') push(src[i++], false)
        if (i < src.length) push(src[i++], false)
      }
      if (i < src.length) push(src[i++], false)
      continue
    }
    push(src[i++], false)
  }
  return { code: code.join(''), comments: comments.join('') }
}

const SKIP_DIRS = new Set([
  'node_modules', '.next', '.git', 'dist', 'build', '.turbo', 'coverage', 'drizzle',
])

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) sourceFiles(full, out)
    else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full)
  }
  return out
}

/**
 * Extract the argument text of every `coalesce(...)` in `src`, matching
 * parentheses so nested calls come out whole. A regex cannot do this:
 * `coalesce(sum(a * b), 0)` stops at the first `)` and loses the `, 0`.
 */
function coalesceArgs(src: string): { args: string; index: number }[] {
  const out: { args: string; index: number }[] = []
  const re = /\bcoalesce\s*\(/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(src))) {
    let depth = 1
    let i = m.index + m[0].length
    const start = i
    while (i < src.length && depth > 0) {
      if (src[i] === '(') depth++
      else if (src[i] === ')') depth--
      i++
    }
    if (depth === 0) out.push({ args: src.slice(start, i - 1), index: m.index })
  }
  return out
}

function lineOf(src: string, index: number): number {
  return src.slice(0, index).split('\n').length
}

function isAllowed(rel: string): boolean {
  return ALLOWED.some(a => rel.startsWith(a))
}

test('no SQL coalesce turns an unreported fee or an unset cost into zero', () => {
  const violations: string[] = []

  for (const file of sourceFiles(ROOT)) {
    const rel = relative(ROOT, file).replaceAll('\\', '/')
    if (isAllowed(rel)) continue
    const { code: src, comments } = scan(readFileSync(file, 'utf8'))
    const lines = comments.split('\n')

    for (const { args, index } of coalesceArgs(src)) {
      // Only the LAST argument is the fallback value. `coalesce(a, b, 0)`
      // defaults to zero; `coalesce(a, 0::numeric + x)` does not, and neither
      // does a coalesce whose default is another column.
      const parts = splitTopLevel(args)
      const fallback = parts.at(-1)?.trim() ?? ''
      if (!/^0(\s*::\s*\w+)?$/.test(fallback)) continue

      const mentions = MONEY_COLUMNS.filter(c => new RegExp(`\\b${c}\\b`).test(args))
      if (mentions.length === 0) continue

      // `coalesce(sum(qty * cost_price) filter (where cost_price is not null), 0)`
      // is the CORRECT shape, not the banned one: the sum is restricted to rows
      // whose cost is known, so the outer zero means "no such rows", not "the
      // cost was nothing". The banned shape coerces per row — coalesce(cost, 0)
      // INSIDE the sum — and has no filter. Requiring the filter to name a money
      // column keeps this from excusing an unrelated `filter (where status = …)`.
      // Bounded [\s\S] rather than [^)] because the filter's own predicate may
      // contain parentheses — `filter (where coalesce(cost_per_unit, cost_price)
      // is not null)` is the real shape in lib/db/products.ts.
      const guarded = MONEY_COLUMNS.some(c => new RegExp(
        `filter\\s*\\(\\s*where[\\s\\S]{0,200}?\\b${c}\\b[\\s\\S]{0,200}?is\\s+not\\s+null`, 'i',
      ).test(args))
      if (guarded) continue

      const line = lineOf(src, index)
      if (optedOut(lines, line)) continue
      violations.push(`${rel}:${line} — coalesce(… ${mentions.join(', ')} …, 0)`)
    }
  }

  assert.deepEqual(
    violations, [],
    'A NULL fee is not a fee of zero, and a NULL cost is not free goods.\n' +
    'Coercing them makes profit look better than it is — the exact bug this\n' +
    'module exists to prevent. Load the period through lib/money\n' +
    '(loadOrderInputs + sumEconomics) instead of coalescing here:\n\n' +
    violations.map(v => '  ' + v).join('\n') + '\n',
  )
})

test('no JS ?? 0 turns an unreported fee or an unset cost into zero', () => {
  const violations: string[] = []
  // `x.cost_price ?? 0`, `Number(p.cost_price ?? 0)`, `costPrice ?? 0` — the
  // same coercion, moved from SQL to TypeScript, with the same consequence.
  const patterns = MONEY_FIELDS.map(f => new RegExp(`\\b${f}\\s*\\?\\?\\s*0\\b`, 'g'))

  for (const file of sourceFiles(ROOT)) {
    const rel = relative(ROOT, file).replaceAll('\\', '/')
    if (isAllowed(rel)) continue
    const { code: src, comments } = scan(readFileSync(file, 'utf8'))
    const lines = comments.split('\n')
    for (const re of patterns) {
      let m: RegExpExecArray | null
      re.lastIndex = 0
      while ((m = re.exec(src))) {
        const line = lineOf(src, m.index)
        if (optedOut(lines, line)) continue
        violations.push(`${rel}:${line} — ${m[0]}`)
      }
    }
  }

  assert.deepEqual(
    violations, [],
    'An absent cost is unknown, not zero — a product with no cost_price is not\n' +
    'a product with 100% margin. Keep the null and let the UI say "not set":\n\n' +
    violations.map(v => '  ' + v).join('\n') + '\n',
  )
})

/** Split `a, sum(b, c), 0` into ['a', 'sum(b, c)', '0'] — top-level commas only. */
function splitTopLevel(args: string): string[] {
  const out: string[] = []
  let depth = 0, last = 0
  for (let i = 0; i < args.length; i++) {
    const ch = args[i]
    if (ch === '(') depth++
    else if (ch === ')') depth--
    else if (ch === ',' && depth === 0) { out.push(args.slice(last, i)); last = i + 1 }
  }
  out.push(args.slice(last))
  return out
}
