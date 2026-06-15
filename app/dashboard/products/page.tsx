import { Package, Settings } from 'lucide-react'
import Link from 'next/link'
import { Suspense } from 'react'
import { getProducts } from '@/lib/db/products'
import ProductsTable from '@/components/dashboard/ProductsTable'
import MarketplaceTabs from '@/components/dashboard/MarketplaceTabs'
import { getT } from '@/lib/server-i18n'
import type { MarketplaceType } from '@/lib/types'

const VALID_MP = ['uzum', 'yandex_market', 'wildberries'] as const
function parseMp(v: string | undefined): MarketplaceType | undefined {
  return (VALID_MP as readonly string[]).includes(v ?? '') ? v as MarketplaceType : undefined
}

interface Props {
  searchParams: Promise<Record<string, string>>
}

export default async function ProductsPage({ searchParams }: Props) {
  const params = await searchParams
  const marketplace = parseMp(params.mp)

  const [t, products] = await Promise.all([getT(), getProducts(marketplace)])
  const d = t.dashboard

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-0.5" style={{ color: 'var(--text-base)' }}>{d.productsTitle}</h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{products.length} {d.productCount}</p>
      </div>

      <Suspense>
        <MarketplaceTabs current={marketplace} />
      </Suspense>

      {products.length === 0 ? (
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
      ) : (
        <ProductsTable products={products} />
      )}
    </div>
  )
}
