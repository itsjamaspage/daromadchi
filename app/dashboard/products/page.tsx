import { Package } from 'lucide-react'
import { getProducts } from '@/lib/db/products'
import ProductsTable from '@/components/dashboard/ProductsTable'

export default async function ProductsPage() {
  const products = await getProducts()
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Mahsulotlar</h1>
          <p className="text-slate-400 text-sm mt-1">{products.length} ta mahsulot</p>
        </div>
        <button className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors shadow-lg shadow-violet-500/20">
          <Package className="w-4 h-4" />
          Mahsulot qo&apos;shish
        </button>
      </div>
      <ProductsTable products={products} />
    </div>
  )
}
