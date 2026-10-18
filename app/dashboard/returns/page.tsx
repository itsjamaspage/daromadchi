import { RotateCcw } from 'lucide-react'
import { getT, getLang } from '@/lib/server-i18n'
import { currentUserAccess } from '@/lib/billing/current-user-access'
import FeatureLock from '@/components/dashboard/FeatureLock'
import ReturnsClient from './ReturnsClient'

export default async function ReturnsPage() {
  const [lang, access] = await Promise.all([getLang(), currentUserAccess('analytics')])
  if (!access.allowed) return <FeatureLock lang={lang} feature="analytics" hadTrial={access.trialEnded} />

  const t = await getT()
  const d = t.dashboard

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--bg-card2)] border border-[var(--border)] flex items-center justify-center">
          <RotateCcw className="w-5 h-5 text-[var(--c1)]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-base)]">{d.returnsTitle}</h1>
          <p className="text-[var(--text-muted)] text-sm">{d.returnsSubtitle}</p>
        </div>
      </div>
      <ReturnsClient />
    </div>
  )
}
