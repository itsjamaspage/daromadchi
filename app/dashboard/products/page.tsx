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
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-base)' }}>{d.productsTitle}</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>0 {d.productCount}</p>
        </div>
        <div className="border border-dashed rounded-2xl p-10 text-center" style={{ background: 'var(--bg-card2)', borderColor: 'rgba(124, 58, 237, 0.3)' }}>
          <div className="w-14 h-14 rounded-2xl border flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(124, 58, 237, 0.1)', borderColor: 'rgba(124, 58, 237, 0.2)', color: '#7c3aed' }}>
            <Package className="w-7 h-7" />
          </div>
          <h2 className="font-bold text-lg mb-2" style={{ color: 'var(--text-base)' }}>{d.noProductsTitle}</h2>
          <p className="text-sm mb-6 max-w-sm mx-auto" style={{ color: 'var(--text-muted)' }}>
            {d.noProductsDesc}
          </p>
          <Link href="/dashboard/settings"
            className="inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
            style={{ background: '#7c3aed', color: 'white' }}>
            <Settings className="w-4 h-4" /> {d.goToSettings}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-base)' }}>{d.productsTitle}</h1>
        </div>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{products.length} {d.productCount}</p>
      </div>
      <ProductsTable products={products} />
    </div>
  )
}
