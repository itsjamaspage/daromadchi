import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { withErrorHandler } from '@/lib/api-handler'
import {
  generateUzumExcel,
  generateYandexExcel,
  type ProductRow,
  type UzumCategory,
  type YandexCategoryParam,
} from '@/lib/excel/product-export'

interface ExportBody {
  marketplace: 'uzum' | 'yandex'
  products: ProductRow[]
  uzumCategory?: UzumCategory
  yandexCategoryName?: string
  yandexParams?: YandexCategoryParam[]
}

export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await req.json()) as ExportBody
  const { marketplace, products } = body

  if (!products?.length) {
    return NextResponse.json({ error: 'No products provided' }, { status: 400 })
  }

  if (marketplace === 'uzum') {
    if (!body.uzumCategory?.id || !body.uzumCategory?.name) {
      return NextResponse.json({ error: 'Uzum category required' }, { status: 400 })
    }
    const buf = generateUzumExcel(products, body.uzumCategory)
    return new Response(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="uzum-products.xlsx"`,
      },
    })
  }

  if (marketplace === 'yandex') {
    if (!body.yandexCategoryName) {
      return NextResponse.json({ error: 'Yandex category name required' }, { status: 400 })
    }
    const buf = generateYandexExcel(products, body.yandexCategoryName, body.yandexParams)
    return new Response(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="yandex-products.xlsx"`,
      },
    })
  }

  return NextResponse.json({ error: 'Invalid marketplace' }, { status: 400 })
})
