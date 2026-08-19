#!/usr/bin/env node
/**
 * Is there work sitting on a branch that main never received?
 *
 * Three times in this repository a commit was left behind — a PR merged while
 * more work was still being pushed, or a stacked PR merged into its parent.
 * Twice that put a real bug on production (wrong prices; contact links pointing
 * at the wrong bot) and both were found by luck rather than by looking.
 *
 * ── What this checks, and what it deliberately does not ─────────────────────
 *
 * Comparing a branch's file list against main is useless: every stale branch
 * "differs" simply because main has moved on. Comparing commit counts is worse,
 * because a squash merge always leaves the originals looking unmerged.
 *
 * So the test is at line level, and in one direction only: for each commit a
 * branch has that main does not, take the lines that commit ADDED, and ask
 * whether main contains them today. Lines main never received are the signal.
 * Lines main has since changed or removed are not — that is main moving
 * forward, which is the normal case this check has to stay quiet about.
 *
 * Reads local refs only, so `git fetch --all --prune` first for a current view.
 * Exits non-zero when anything is flagged, so it can run in CI.
 *
 *   npm run audit:merges
 */
import { execFileSync } from 'node:child_process'

const sh = (args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 << 20 }).trim()
const shq = (args) => {
  try { return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'ignore'] }).trim() }
  catch { return '' }
}

const MAIN = process.env.AUDIT_BASE ?? 'origin/main'

/** Lines a commit added, per file, ignoring pure whitespace and diff noise. */
function addedLines(sha) {
  const out = new Map()
  let file = null
  for (const line of shq(['show', '--format=', '--unified=0', sha]).split('\n')) {
    const m = line.match(/^\+\+\+ b\/(.+)$/)
    if (m) { file = m[1]; continue }
    if (!file || !line.startsWith('+') || line.startsWith('+++')) continue
    const text = line.slice(1).trim()
    // Very short lines ("}", ")") appear everywhere and would match by accident.
    if (text.length < 12) continue
    if (!out.has(file)) out.set(file, [])
    out.get(file).push(text)
  }
  return out
}

const branches = shq(['for-each-ref', '--format=%(refname:short)', 'refs/remotes/origin'])
  .split('\n').filter(b => b && b !== 'origin/HEAD' && b !== MAIN)

const findings = []

for (const branch of branches) {
  const ahead = shq(['rev-list', `${MAIN}..${branch}`]).split('\n').filter(Boolean)
  if (ahead.length === 0) continue

  const orphaned = []
  for (const sha of ahead) {
    // Merge commits add nothing of their own; their content arrives via parents.
    if (shq(['rev-list', '--parents', '-n', '1', sha]).split(' ').length > 2) continue

    for (const [file, lines] of addedLines(sha)) {
      const onMain = shq(['show', `${MAIN}:${file}`])
      if (!onMain) {
        // The file does not exist on main at all. Either genuinely new work, or
        // a whole file left behind.
        orphaned.push({ sha, file, missing: lines.length, total: lines.length })
        continue
      }
      const missing = lines.filter(l => !onMain.includes(l))
      if (missing.length > 0) orphaned.push({ sha, file, missing: missing.length, total: lines.length })
    }
  }

  if (orphaned.length > 0) {
    findings.push({
      branch, orphaned,
      when: shq(['log', '--format=%ad', '--date=short', '-1', branch]),
      subjects: ahead.map(s => shq(['log', '--format=%h %s', '-1', s])),
    })
  }
}

if (findings.length === 0) {
  console.log(`✓ ${MAIN}: no branch holds a line that main never received.`)
  process.exit(0)
}

console.log(`${findings.length} branch(es) hold content ${MAIN} does not have.\n`)
console.log('This is EXPECTED for open work, and expected for old branches whose work')
console.log('was later superseded. It is a PROBLEM when the branch\'s pull request is')
console.log('already closed and the lines below are simply gone — an orphaned commit.\n')
console.log('This check is only as sharp as the branch list: turn on GitHub\'s')
console.log('"Automatically delete head branches" and every branch that still exists is')
console.log('either open work or an orphan, with nothing else to sift through.\n')

findings.sort((a, b) => (b.when ?? '').localeCompare(a.when ?? ''))
for (const f of findings) {
  console.log(`  ${f.branch}   (last commit ${f.when})`)
  for (const s of f.subjects.slice(0, 6)) console.log(`    · ${s}`)
  for (const o of f.orphaned.slice(0, 10)) {
    console.log(`      ${o.file}: ${o.missing}/${o.total} added lines not on ${MAIN}`)
  }
  console.log('')
}
process.exit(1)
