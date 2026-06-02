import { getT } from '@/lib/server-i18n'
import SearchPhrasesView from '@/components/dashboard/SearchPhrasesView'
import { getSearchPhrases } from '@/lib/db/search-phrases'
import HelpTooltip from '@/components/dashboard/HelpTooltip'

export default async function SearchPhrasesPage() {
  const [t, phrases] = await Promise.all([getT(), getSearchPhrases()])
  const d = t.dashboard

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <h1 className="text-2xl font-bold text-white">{d.searchPhrasesTitle}</h1>
          <HelpTooltip section="searchPhrases" />
        </div>
        <p className="text-slate-400 text-sm">{d.searchPhrasesSubtitle}</p>
      </div>
      <SearchPhrasesView phrases={phrases} />
    </div>
  )
}
