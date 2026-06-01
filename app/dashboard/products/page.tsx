import { Package, Settings } from 'lucide-react'
import Link from 'next/link'
import { getProducts } from '@/lib/db/products'
import ProductsTable from '@/components/dashboard/ProductsTable'
import { getT } from '@/lib/server-i18n'

export default async function ProductsPage() {
  const t = await getT()
  const d = t.dashboard
  const products = await getProducts()

  if (products.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">{d.productsTitle}</h1>
          <p className="text-slate-400 text-sm mt-1">0 {d.productCount}</p>
        </div>
        <div className="bg-[#13131f] border border-dashed border-violet-500/30 rounded-2xl p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mx-auto mb-4">
            <Package className="w-7 h-7 text-violet-400" />
          </div>
          <h2 className="text-white font-bold text-lg mb-2">{d.noProductsTitle}</h2>
          <p className="text-slate-400 text-sm mb-6 max-w-sm mx-auto">
            {d.noProductsDesc}
          </p>
          <Link href="/dashboard/settings"
            className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors shadow-lg shadow-violet-500/20">
            <Settings className="w-4 h-4" /> {d.goToSettings}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">{d.productsTitle}</h1>
        <p className="text-slate-400 text-sm mt-1">{products.length} {d.productCount}</p>
      </div>
      <ProductsTable products={products} />
    </div>
  )
}
