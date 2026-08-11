import { Suspense } from 'react'
import { Package, Settings } from 'lucide-react'
import Link from 'next/link'
import { getProductsPaginated } from '@/lib/db/products'
import ProductsTable from '@/components/dashboard/ProductsTable'
import MarketplaceTabs from '@/components/dashboard/MarketplaceTabs'
import ArchivedTabs from '@/components/dashboard/ArchivedTabs'
import Pagination from '@/components/dashboard/Pagination'
import LastSyncedServer from '@/components/dashboard/LastSyncedServer'
import { getT } from '@/lib/server-i18n'
import type { MarketplaceType } from '@/lib/types'

const PAGE_SIZE = 50
const VALID_MARKETPLACES = ['uzum', 'yandex_market'] as const

interface Props {
  searchParams: Promise<Record<string, string>>
}

export default async function ProductsPage({ searchParams }: Props) {
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1)
  const mp = (VALID_MARKETPLACES as readonly string[]).includes(params.mp ?? '')
    ? (params.mp as MarketplaceType)
    : undefined
  const archived = params.archived === '1'

  const [t, { rows: products, total, archivedTotal }] = await Promise.all([
    getT(),
    getProductsPaginated(page, PAGE_SIZE, mp, archived),
  ])
  const d = t.dashboard
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-0.5" style={{ color: 'var(--text-base)' }}>{d.productsTitle}</h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{total} {d.productCount}</p>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <Suspense>
            <MarketplaceTabs current={mp} />
          </Suspense>
          <ArchivedTabs archived={archived} archivedTotal={archivedTotal} mp={mp} />
        </div>
        <Suspense>
          <LastSyncedServer />
        </Suspense>
      </div>

      {total === 0 ? (
        <div className="border border-dashed rounded-2xl p-10 text-center" style={{ background: 'var(--bg-card2)', borderColor: 'rgba(131, 192, 249, 0.3)' }}>
          <div className="w-14 h-14 rounded-2xl border flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(131, 192, 249, 0.1)', borderColor: 'rgba(131, 192, 249, 0.2)', color: 'var(--c1)' }}>
            <Package className="w-7 h-7" />
          </div>
          <h2 className="font-bold text-lg mb-2" style={{ color: 'var(--text-base)' }}>{d.noProductsTitle}</h2>
          <p className="text-sm mb-6 max-w-sm mx-auto" style={{ color: 'var(--text-muted)' }}>
            {d.noProductsDesc}
          </p>
          <Link href="/dashboard/settings"
            className="inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors btn-primary">
            <Settings className="w-4 h-4" /> {d.goToSettings}
          </Link>
        </div>
      ) : (
        <>
          <ProductsTable products={products} />
          <Pagination page={page} totalPages={totalPages} basePath="/dashboard/products" />
        </>
      )}
    </div>
  )
}
