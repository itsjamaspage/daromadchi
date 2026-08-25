import { NextResponse } from 'next/server'
import { withErrorHandler } from '@/lib/api-handler'

/**
 * Liveness AND identity.
 *
 * This used to return a bare `{ status: 'ok' }`, which meant a 200 from any
 * build — including one from hours earlier. The deploy pipeline had no way to
 * tell "the merged code is live" from "an old process is still serving an old
 * build", and on 25 Aug it reported healthy through both.
 *
 * `commit` closes that hole. It is inlined at BUILD time (see buildSha() in
 * next.config.ts), so it names the commit of the bundle actually being served.
 * Compare it against the deployed tree to detect a stale process:
 *
 *   curl -s https://daromadchi.uz/api/health | jq -r .commit
 *   git -C /var/www/daromadchi rev-parse HEAD
 *
 * Equal means the running process is serving the checked-out commit. Different
 * means the build did not reach the process, which is the failure this exists
 * to make visible.
 *
 * `uptimeSeconds` is here for the restart-loop work: polling it shows a process
 * being recycled without needing shell access to the box. A value that keeps
 * resetting to near-zero is a crash loop.
 *
 * Deliberately touches no filesystem and no database. A health endpoint that
 * can fail for its own reasons is worse than none — during a deploy `.next` is
 * briefly absent, and reading it here would turn that window into a red alert
 * about the wrong thing.
 */
export const dynamic = 'force-dynamic'

export const GET = withErrorHandler(async () => {
  return NextResponse.json({
    status: 'ok',
    env: process.env.NEXT_PUBLIC_ENV ?? 'production',
    commit: process.env.BUILD_SHA ?? 'unknown',
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  })
})
