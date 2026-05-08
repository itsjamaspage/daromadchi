import { getT } from '@/lib/server-i18n'
import SearchPhrasesView from '@/components/dashboard/SearchPhrasesView'
import { getSearchPhrases } from '@/lib/db/search-phrases'

export default async function SearchPhrasesPage() {
  const [t, phrases] = await Promise.all([getT(), getSearchPhrases()])
  const d = t.dashboard

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">{d.searchPhrasesTitle}</h1>
        <p className="text-slate-400 text-sm mt-1">{d.searchPhrasesSubtitle}</p>
      </div>
      <SearchPhrasesView phrases={phrases} />
    </div>
  )
}
