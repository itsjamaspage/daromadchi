import { getT } from '@/lib/server-i18n'
import ProductCreateForm from '@/components/dashboard/ProductCreateForm'

export default async function NewProductPage() {
  const t = await getT()
  const d = t.dashboard

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-0.5" style={{ color: 'var(--text-base)' }}>
          {d.createProduct}
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {d.createProductDesc}
        </p>
      </div>
      <ProductCreateForm />
    </div>
  )
}
