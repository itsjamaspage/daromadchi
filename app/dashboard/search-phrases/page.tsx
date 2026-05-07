import SearchPhrasesView from '@/components/dashboard/SearchPhrasesView'
import { getSearchPhrases } from '@/lib/db/search-phrases'

export default async function SearchPhrasesPage() {
  const phrases = await getSearchPhrases()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Qidiruv iboralari</h1>
        <p className="text-slate-400 text-sm mt-1">Reklama qidiruv iboralari bo&apos;yicha ko&apos;rsatuvlar, kliklar va CTR</p>
      </div>
      <SearchPhrasesView phrases={phrases} />
    </div>
  )
}
