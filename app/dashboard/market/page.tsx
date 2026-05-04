import { Globe2 } from 'lucide-react'
import Link from 'next/link'
import { getRootCategories } from '@/lib/uzum/public'
import { getProducts } from '@/lib/db/products'
import MarketClient from './MarketClient'

export default async function MarketPage() {
  const [categories, myProducts] = await Promise.all([
    getRootCategories(),
    getProducts(),
  ])

  const userCategories = [...new Set(myProducts.map(p => p.category).filter(Boolean))] as string[]

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Globe2 className="w-6 h-6 text-cyan-400" />
              Bozor tadqiqoti
            </h1>
            <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/25 text-cyan-400">
              Ommaviy ma&apos;lumot
            </span>
          </div>
          <p className="text-slate-400 text-sm">
            Uzum.uz barcha sotuvchilarining ommaviy narx va savdo statistikasi
          </p>
        </div>
        {userCategories.length > 0 && (
          <div className="shrink-0 flex flex-wrap gap-1.5">
            {userCategories.slice(0, 3).map(c => (
              <span key={c} className="text-[10px] bg-violet-500/10 border border-violet-500/20 text-violet-400 px-2 py-1 rounded-full">
                {c}
              </span>
            ))}
            {userCategories.length > 3 && (
              <span className="text-[10px] bg-white/[0.04] text-slate-500 px-2 py-1 rounded-full">
                +{userCategories.length - 3}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Hint banner */}
      <div className="flex items-start gap-3 bg-violet-500/[0.06] border border-violet-500/20 rounded-xl px-4 py-3 text-xs text-violet-300/80">
        <Globe2 className="w-4 h-4 mt-0.5 shrink-0 text-violet-400" />
        <span>
          {"Bu sahifa Uzum.uz ommaviy API'sidan foydalanadi — hech qanday token shart emas. "}
          {userCategories.length > 0
            ? "Sizning kategoriyalaringizdagi mahsulotlar yashil belgi bilan ko'rsatiladi."
            : "Do'koningizni ulasangiz, o'z kategoriyalaringiz avtomatik belgilanadi."}
          {userCategories.length === 0 && (
            <Link href="/dashboard/settings" className="ml-1 underline text-violet-400">Ulash →</Link>
          )}
        </span>
      </div>

      <MarketClient initialCategories={categories} userCategories={userCategories} />
    </div>
  )
}
