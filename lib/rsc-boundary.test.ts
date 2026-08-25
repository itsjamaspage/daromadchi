import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

/**
 * Server code must not import a plain VALUE out of a 'use client' module.
 *
 * Next.js replaces every export of a client module with a client reference, so
 * a server component that does this is not calling a function — it is calling
 * a proxy, and the page dies at request time with "Attempted to call X() from
 * the server". Nothing catches it earlier: it type-checks, it lints, it
 * BUILDS, and unit tests import the module directly with no RSC boundary in
 * play. The analytics page shipped broken to production exactly this way.
 *
 * Default imports are fine — that is how you render a client component from a
 * server one. It is the NAMED value imports that break.
 */

const ROOT = resolve(import.meta.dirname, '..')
const SCAN = ['app', 'lib', 'components']

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.tsx?$/.test(full) && !/\.test\.tsx?$/.test(full)) out.push(full)
  }
  return out
}

const files = SCAN.flatMap(d => walk(join(ROOT, d)))
/**
 * True when the file carries the 'use client' directive.
 *
 * The directive only has to precede all STATEMENTS, not all text — many files
 * here open with `/* eslint-disable … *\/`. A naive anchor at position 0 reads
 * those as server modules and floods this test with false positives, so strip
 * leading comments and blank lines first.
 */
function isClient(f: string): boolean {
  let src = readFileSync(f, 'utf8')
  // Strip a BOM, then leading block comments, line comments and blank lines.
  src = src.replace(/^\uFEFF/, '')
  for (;;) {
    const next = src.replace(/^\s+/, '').replace(/^\/\*[\s\S]*?\*\//, '').replace(/^\/\/[^\n]*\n/, '')
    if (next === src) break
    src = next
  }
  return /^['"]use client['"]/.test(src.trimStart())
}

/** Resolve an `@/...` specifier to a file on disk, trying the usual endings. */
function resolveAlias(spec: string): string | null {
  if (!spec.startsWith('@/')) return null
  const base = join(ROOT, spec.slice(2))
  for (const cand of [`${base}.tsx`, `${base}.ts`, join(base, 'index.tsx'), join(base, 'index.ts')]) {
    if (existsSync(cand)) return cand
  }
  return null
}

test('no server module imports a named value from a "use client" module', () => {
  const violations: string[] = []

  for (const file of files) {
    if (isClient(file)) continue                       // client → client is fine
    const src = readFileSync(file, 'utf8')
    // `import Default, { a, b } from '@/x'` and `import { a } from '@/x'`.
    // Only the braced part matters; a bare default import is legitimate.
    const re = /import\s+(?:[\w$]+\s*,\s*)?\{([^}]+)\}\s*from\s*['"](@\/[^'"]+)['"]/g
    for (const m of src.matchAll(re)) {
      const named = m[1]
      // `import { type Foo }` / `import type { … }` erase at compile time and
      // never reach the runtime boundary.
      if (/^\s*import\s+type\s/.test(m[0])) continue
      const target = resolveAlias(m[2])
      if (!target || !isClient(target)) continue
      const values = named.split(',')
        .map(s => s.trim())
        .filter(s => s && !s.startsWith('type '))
      if (values.length === 0) continue
      violations.push(
        `${file.replace(ROOT + '/', '')} imports { ${values.join(', ')} } from ${m[2]} ('use client')`,
      )
    }
  }

  assert.deepEqual(violations, [], violations.length
    ? `\nThese will throw at request time, not at build:\n  ${violations.join('\n  ')}\n` +
      `Move the shared value into a plain module (no 'use client') that both sides import.\n`
    : undefined)
})

test('the scan actually found files — a silent zero would make this test useless', () => {
  assert.ok(files.length > 100, `only scanned ${files.length} files`)
  assert.ok(files.some(isClient), 'no client components found; the check would be vacuous')
})
