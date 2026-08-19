import Link from 'next/link'
import { Lock } from 'lucide-react'
import { lockT, lockedFeatureT } from '@/lib/lockT'
import { tiersT } from '@/lib/tiersT'
import type { Feature } from '@/lib/billing/features'
import type { Lang } from '@/lib/i18n'

interface Props {
  lang: Lang
  feature: Feature
  /**
   * True when the account once had this on a trial that has since ended. It
   * changes the heading only — "you lost this" reads very differently from
   * "you never had this", and getting it backwards is how an upgrade prompt
   * starts feeling like a bug report.
   */
  hadTrial?: boolean
  /** Extra line under the body, e.g. the Stocks page's write-back warning. */
  note?: string
}

/**
 * The locked state for a gated section.
 *
 * Deliberately NOT a frozen snapshot of the data: stale stock numbers that look
 * live could have a seller restock against a wrong figure. An honest lock beats
 * a trap. Rendered on the server, so nothing gated is ever shipped to the
 * browser and then hidden with CSS.
 */
export default function FeatureLock({ lang, feature, hadTrial = false, note }: Props) {
  const name = lockedFeatureT[feature]?.[lang]

  return (
    <div className="rounded-2xl border p-8 sm:p-10 text-center"
      style={{ background: 'var(--bg-card2)', borderColor: 'var(--border)' }}>
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--c1)' }}>
        <Lock className="h-6 w-6" />
      </div>

      <h2 className="text-lg font-bold" style={{ color: 'var(--text-base)' }}>
        {hadTrial ? lockT.trialOver[lang] : lockT.paidOnly[lang]}
      </h2>
      {name && (
        <p className="mt-1 text-sm font-semibold" style={{ color: 'var(--c1)' }}>{name}</p>
      )}

      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        {lockT.body[lang]}
      </p>
      {note && (
        <p className="mx-auto mt-2 max-w-md text-xs" style={{ color: 'var(--text-muted)' }}>{note}</p>
      )}

      <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Link href="/dashboard/billing"
          className="btn-primary rounded-xl px-6 py-2.5 text-sm font-semibold">
          {lockT.cta[lang]}
        </Link>
        <Link href="/pricing" className="rounded-xl border px-6 py-2.5 text-sm font-semibold"
          style={{ borderColor: 'var(--border2)', color: 'var(--text-base)' }}>
          {tiersT.seeAll[lang]}
        </Link>
      </div>
    </div>
  )
}
