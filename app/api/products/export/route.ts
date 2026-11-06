import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { withErrorHandler } from '@/lib/api-handler'
import {
  generateUzumExcel,
  validateProductRows,
  type ProductRow,
  type UzumCategory,
} from '@/lib/excel/product-export'

interface ExportBody {
  marketplace: 'uzum'
  products: ProductRow[]
  uzumCategory?: UzumCategory
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
    const validationErrors = validateProductRows(products)
    if (validationErrors.length > 0) {
      return NextResponse.json({
        error: 'Ошибки валидации Uzum',
        details: validationErrors.map(e =>
          `Строка ${e.row}: ${e.field} — "${e.value}" не найдено в списке допустимых значений`
        ),
      }, { status: 400 })
    }

    const cat = body.uzumCategory ?? { id: '', name: '', fullPath: '' }
    const buf = generateUzumExcel(products, cat)
    return new Response(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/vnd.ms-excel.sheet.macroEnabled.12',
        'Content-Disposition': `attachment; filename="uzum-products.xlsm"`,
      },
    })
  }

  return NextResponse.json({ error: 'Invalid marketplace' }, { status: 400 })
})
