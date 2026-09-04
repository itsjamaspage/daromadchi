import { notFound } from 'next/navigation'
import { getSharedProducts } from '@/lib/db/share'
import SharedStockView from './SharedStockView'

interface Props {
  params: Promise<{ token: string }>
}

export default async function SharePage({ params }: Props) {
  const { token } = await params

  if (!token || token.length < 20) notFound()

  const products = await getSharedProducts(token)
  if (products === null) notFound()

  return <SharedStockView products={products} />
}
