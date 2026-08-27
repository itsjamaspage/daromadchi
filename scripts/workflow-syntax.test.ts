/**
 * Every shell script inside .github/workflows must actually parse.
 *
 * This exists because a quoting bug shipped to main and broke THREE consecutive
 * deploys before anyone looked:
 *
 *     bash: line 79: unexpected EOF while looking for matching `"'
 *
 * The line was a `tr -d` with an unbalanced quote, written by generating shell
 * through another language's string escaping and never running the result. YAML
 * is valid, the workflow lints, the job starts — and then dies partway through,
 * after the app has already restarted, so the deploy is half-applied and red.
 *
 * `bash -n` parses without executing, which is exactly the check that was
 * missing. It cannot catch a script that is syntactically fine and wrong, but
 * it catches every unbalanced quote, unterminated heredoc and missing `fi`.
 *
 * ── Heredocs are checked too, and that is the whole point here ──────────────
 *
 * The deploy step is `ssh … 'bash -s' <<'DEPLOY' … DEPLOY`. To the OUTER shell
 * a quoted heredoc is one opaque string, so `bash -n` on the run: block alone
 * parses happily — the broken line lives in the body, and only the REMOTE bash
 * ever tries to read it. A guard that stopped at the outer script would have
 * missed the exact bug it was written for, which is why the bodies are pulled
 * out and parsed as scripts in their own right.
 *
 * Run: npm run test:workflows
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const WORKFLOWS = join(import.meta.dirname, '..', '.github', 'workflows')

interface Block { file: string; line: number; script: string; via?: string }

/**
 * Heredoc bodies inside a script, as scripts themselves.
 *
 * Only QUOTED delimiters (<<'EOF' / <<"EOF") are taken. An unquoted heredoc is
 * interpolated by the outer shell first, so its literal text is not what runs
 * and flagging it would produce false failures.
 */
function heredocs(script: string, file: string, startLine: number): Block[] {
  const out: Block[] = []
  const lines = script.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const open = /<<-?\s*'([A-Za-z_][A-Za-z0-9_]*)'|<<-?\s*"([A-Za-z_][A-Za-z0-9_]*)"/.exec(lines[i])
    if (!open) continue
    const delim = open[1] ?? open[2]
    const body: string[] = []
    let j = i + 1
    for (; j < lines.length; j++) {
      if (lines[j].trim() === delim) break
      body.push(lines[j])
    }
    if (j < lines.length) {
      out.push({ file, line: startLine + i, script: body.join('\n'), via: `heredoc <<'${delim}'` })
    }
    i = j
  }
  return out
}

/**
 * Pull every `run:` script out of a workflow.
 *
 * Done textually rather than with a YAML parser because the repo has no YAML
 * dependency and adding one for a syntax check is not worth it. Block scalars
 * (`run: |`) are defined by indentation, so collecting the more-indented lines
 * that follow is exact for well-formed YAML — and malformed YAML fails the
 * workflow anyway, well before this.
 */
function runBlocks(file: string): Block[] {
  const lines = readFileSync(join(WORKFLOWS, file), 'utf8').split('\n')
  const out: Block[] = []

  for (let i = 0; i < lines.length; i++) {
    const m = /^(\s*)(?:- )?run:\s*(\|-?|>-?)?\s*(.*)$/.exec(lines[i])
    if (!m) continue
    const [, indent, blockMarker, inline] = m

    if (!blockMarker) {
      // `run: some command` on one line.
      if (inline.trim()) out.push({ file, line: i + 1, script: inline })
      continue
    }

    const body: string[] = []
    const baseIndent = indent.length
    for (let j = i + 1; j < lines.length; j++) {
      const l = lines[j]
      if (l.trim() === '') { body.push(''); continue }
      const thisIndent = l.length - l.trimStart().length
      if (thisIndent <= baseIndent) break
      body.push(l)
      i = j
    }
    // Dedent by the smallest indentation present, so bash sees the script as
    // the runner does.
    const widths = body.filter(l => l.trim()).map(l => l.length - l.trimStart().length)
    const strip = widths.length ? Math.min(...widths) : 0
    out.push({ file, line: i + 1, script: body.map(l => l.slice(strip)).join('\n') })
  }
  return out
}

test('every workflow run: block is valid shell', () => {
  assert.ok(existsSync(WORKFLOWS), '.github/workflows should exist')
  const files = readdirSync(WORKFLOWS).filter(f => /\.ya?ml$/.test(f))
  assert.ok(files.length > 0, 'no workflow files found — the check would pass vacuously')

  const failures: string[] = []
  let checked = 0

  for (const file of files) {
    const blocks = runBlocks(file)
    // …plus every quoted heredoc inside them, which is where the deploy script
    // actually lives.
    for (const b of [...blocks]) blocks.push(...heredocs(b.script, file, b.line))
    for (const block of blocks) {
      // GitHub expression syntax is substituted before the shell ever sees it;
      // leaving `${{ … }}` in would be a bash parse error about `{{`.
      const script = block.script.replace(/\$\{\{[^}]*\}\}/g, 'X')
      const path = join(tmpdir(), `wf-${file}-${block.line}.sh`)
      writeFileSync(path, script)
      checked++
      try {
        execFileSync('bash', ['-n', path], { stdio: 'pipe' })
      } catch (err) {
        const stderr = (err as { stderr?: Buffer }).stderr?.toString().replace(path, '<block>') ?? String(err)
        failures.push(`${file}:${block.line}${block.via ? ` (${block.via})` : ''}\n      ${stderr.trim()}`)
      } finally {
        unlinkSync(path)
      }
    }
  }

  assert.ok(checked > 0, 'no run: blocks were extracted — the parser is broken, not the workflows')
  assert.deepEqual(failures, [],
    `${checked} run: blocks checked, ${failures.length} do not parse:\n\n  ` +
    failures.join('\n\n  ') + '\n')
})

// The cron runner is deploy-installed shell that runs unattended in production
// every five minutes. It has been tracked at scripts/cron-runner.sh since #249 —
// and deploy.yml spent months OVERWRITING it with an inline heredoc duplicate, so
// the reviewed script was dead code and the box ran a copy nobody could diff.
//
// That duplicate is why the 27 Aug outage was silent: it used `curl -sf`, which
// exits non-zero with NO output on an HTTP error, so six failing cron ticks wrote
// nothing but blank lines.
test('the deploy-installed cron runner is valid shell', () => {
  const runner = join(__dirname, 'cron-runner.sh')
  assert.ok(existsSync(runner), 'scripts/cron-runner.sh should exist — deploy.yml installs it')
  execFileSync('bash', ['-n', runner], { stdio: 'pipe' })

  // Comments are stripped first: the file may legitimately DOCUMENT why -sf is
  // wrong, and a check that reads its own explanation as a violation fails the
  // very file that got it right.
  const code = readFileSync(runner, 'utf8').split('\n').filter(l => !/^\s*#/.test(l)).join('\n')
  assert.doesNotMatch(code, /curl\s+-sf\b/,
    'curl -sf fails silently on an HTTP error — the cron log must record the status')
})

// The trap this exists for: the crontab said `digest`, the tracked script's job
// is `telegram-digest`. Installing the script without fixing the schedule would
// have turned the digest into "unknown job" and exit 2 — a job that silently
// stops running, which is the exact failure class we are here to end.
test('every job the crontab schedules exists in the cron runner', () => {
  const deploy = readFileSync(join(WORKFLOWS, 'deploy.yml'), 'utf8')
  // Horizontal whitespace only: `\s+` crosses newlines and would read the next
  // line's first word as a job name.
  const scheduled = [...deploy.matchAll(/cron-runner\.sh[^\S\n]+([a-z][a-z-]*)/g)].map(m => m[1])
  assert.ok(scheduled.length >= 5, `expected the scheduled jobs, found ${scheduled.length}`)

  const runner = readFileSync(join(__dirname, 'cron-runner.sh'), 'utf8')
  const known = [...runner.matchAll(/^([a-z][a-z-]*)\|\//gm)].map(m => m[1])
  assert.ok(known.length > 0, "could not parse the runner's JOBS table")

  for (const job of new Set(scheduled)) {
    assert.ok(known.includes(job),
      `crontab schedules '${job}' but the runner only knows: ${known.join(', ')}`)
  }
})

// deploy.yml must verify the build it just started. pm2 restart returns 0 when
// pm2 ACCEPTS the command, not when the app serves a request: on 27 Aug the
// deploy reported success while production had been dead for 40 minutes.
test('the deploy verifies the build it started', () => {
  const deploy = readFileSync(join(WORKFLOWS, 'deploy.yml'), 'utf8')
  assert.match(deploy, /api\/health/, 'deploy must probe /api/health')
  assert.match(deploy, /TARGET_SHA/,
    'probing /api/health is not enough — it must compare the reported commit against the deployed SHA')
  assert.match(deploy, /SMOKE FAIL/, 'a failed probe must abort the deploy')
  const restartAt = deploy.indexOf('pm2 restart daromadchi')
  const smokeAt = deploy.indexOf('Verifying the running build')
  assert.ok(restartAt > 0 && smokeAt > restartAt,
    'the smoke check must run AFTER the restart, or it verifies the old process')
})

// scripts/crontab.example documents the schedule; deploy.yml installs a
// SEPARATE inline crontab, and that inline list is what actually runs. They had
// already drifted: #395 added the freshness watchdog to the example and not to
// deploy.yml, so the work-liveness alarm built after the 27 Aug outage had never
// once fired in production.
//
// Two sources of truth for the same schedule is the same defect as the two cron
// runners. This pins them together.
test('every job the example crontab documents is actually installed', () => {
  const example = readFileSync(join(__dirname, 'crontab.example'), 'utf8')
  const deploy = readFileSync(join(WORKFLOWS, 'deploy.yml'), 'utf8')

  // The script each active (non-comment) schedule line invokes.
  const invoked = (src: string) =>
    new Set(
      [...src.matchAll(/(?:^|['"\s])(?:\/var\/www\/daromadchi\/)([\w./-]+\.(?:sh|mjs))\s+([a-z][a-z-]*)?/gm)]
        .map(m => `${m[1]}${m[2] ? ' ' + m[2] : ''}`),
    )

  const documented = invoked(
    example.split('\n').filter(l => !/^\s*#/.test(l)).join('\n'),
  )
  const installed = invoked(deploy)

  assert.ok(documented.size > 0, 'could not parse crontab.example — the check would pass vacuously')
  for (const job of documented) {
    assert.ok(installed.has(job),
      `crontab.example documents "${job}" but deploy.yml never installs it — ` +
      `the example is documentation, the deploy list is what runs`)
  }
})
