import { getProductsPaginated } from '@/lib/db/products'
import IkpuTable from '@/components/dashboard/IkpuTable'
import { getT } from '@/lib/server-i18n'

export default async function IkpuPage() {
  const [t, { rows: products }] = await Promise.all([
    getT(),
    getProductsPaginated(1, 5000),
  ])
  const d = t.dashboard

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-0.5" style={{ color: 'var(--text-base)' }}>
          {d.ikpuPage.title}
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {d.ikpuPage.subtitle}
        </p>
      </div>
      <IkpuTable products={products} />
    </div>
  )
}
