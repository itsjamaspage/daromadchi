import { Package, Settings } from 'lucide-react'
import Link from 'next/link'
import { getProducts } from '@/lib/db/products'
import { getUserShops } from '@/lib/db/shop-context'
import ProductsTable from '@/components/dashboard/ProductsTable'
import { getT } from '@/lib/server-i18n'
import type { MarketplaceType } from '@/lib/types'

const MP_LABELS: Record<string, string> = {
  uzum:          'Uzum',
  yandex_market: 'YM',
  wildberries:   'WB',
}

const VALID: MarketplaceType[] = ['uzum', 'yandex_market', 'wildberries']

interface Props {
  searchParams: Promise<Record<string, string>>
}

export default async function ProductsPage({ searchParams }: Props) {
  const params = await searchParams
  const mpParam = params?.mp as MarketplaceType | undefined
  const activeMp: MarketplaceType | undefined = VALID.includes(mpParam as MarketplaceType) ? mpParam : undefined

  const [t, products, allShops] = await Promise.all([
    getT(),
    getProducts(activeMp),
    getUserShops(),
  ])
  const d = t.dashboard

  const availableMps = VALID.filter(mp => allShops.some(s => s.marketplace === mp))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-0.5" style={{ color: 'var(--text-base)' }}>{d.productsTitle}</h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{products.length} {d.productCount}</p>
      </div>

      {/* Marketplace tabs — only shown when shops are connected */}
      {availableMps.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <Link
            href="/dashboard/products"
            className="px-4 py-1.5 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: !activeMp ? 'var(--c1)' : 'var(--bg-card2)',
              color: !activeMp ? 'white' : 'var(--text-muted)',
              border: !activeMp ? 'none' : '1px solid var(--border)',
            }}
          >
            {d.all ?? 'Barchasi'}
          </Link>
          {availableMps.map(mp => (
            <Link
              key={mp}
              href={`/dashboard/products?mp=${mp}`}
              className="px-4 py-1.5 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: activeMp === mp ? 'var(--c1)' : 'var(--bg-card2)',
                color: activeMp === mp ? 'white' : 'var(--text-muted)',
                border: activeMp === mp ? 'none' : '1px solid var(--border)',
              }}
            >
              {MP_LABELS[mp]}
            </Link>
          ))}
        </div>
      )}

      {products.length === 0 ? (
        <div className="border border-dashed rounded-2xl p-10 text-center" style={{ background: 'var(--bg-card2)', borderColor: 'rgba(131, 192, 249, 0.3)' }}>
          <div className="w-14 h-14 rounded-2xl border flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(131, 192, 249, 0.1)', borderColor: 'rgba(131, 192, 249, 0.2)', color: 'var(--c1)' }}>
            <Package className="w-7 h-7" />
          </div>
          <h2 className="font-bold text-lg mb-2" style={{ color: 'var(--text-base)' }}>{d.noProductsTitle}</h2>
          <p className="text-sm mb-6 max-w-sm mx-auto" style={{ color: 'var(--text-muted)' }}>
            {d.noProductsDesc}
          </p>
          <Link href="/dashboard/settings"
            className="inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
            style={{ background: 'var(--c1)', color: 'white' }}>
            <Settings className="w-4 h-4" /> {d.goToSettings}
          </Link>
        </div>
      ) : (
        <ProductsTable products={products} />
      )}
    </div>
  )
}
