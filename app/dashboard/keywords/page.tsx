import { getT } from '@/lib/server-i18n'
import { Search } from 'lucide-react'
import { getSearchPhrases } from '@/lib/db/search-phrases'
import KeywordsView from '@/components/dashboard/KeywordsView'
import HelpTooltip from '@/components/dashboard/HelpTooltip'

export default async function KeywordsPage() {
  const [t, phrases] = await Promise.all([getT(), getSearchPhrases()])
  const d = t.dashboard

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <h1 className="text-2xl font-bold text-[var(--text-base)]">{d.keywordsTitle}</h1>
          <HelpTooltip section="keywords" />
        </div>
        <p className="text-[var(--text-muted)] text-sm">{d.keywordsSubtitle}</p>
      </div>

      {phrases.length === 0 ? (
        <div className="border border-dashed rounded-2xl p-10 text-center" style={{ background: 'var(--bg-card2)', borderColor: 'rgba(124, 58, 237, 0.3)' }}>
          <div className="w-14 h-14 rounded-2xl border flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(124, 58, 237, 0.1)', borderColor: 'rgba(124, 58, 237, 0.2)', color: '#7c3aed' }}>
            <Search className="w-7 h-7" />
          </div>
          <h2 className="font-bold text-lg mb-2" style={{ color: 'var(--text-base)' }}>{d.noDataYet}</h2>
          <p className="text-sm max-w-sm mx-auto" style={{ color: 'var(--text-muted)' }}>{d.noDataDesc}</p>
        </div>
      ) : (
        <KeywordsView phrases={phrases} />
      )}
    </div>
  )
}
