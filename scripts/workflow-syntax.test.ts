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
