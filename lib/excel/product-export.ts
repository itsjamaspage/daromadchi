import * as XLSX from 'xlsx'

// ── Types ────────────────────────────────────────────────────────────────────

export interface ProductRow {
  nameRu: string
  nameUz: string
  sku?: string
  skuGroup: string
  categoryName: string
  categoryId: string
  brand: string
  model?: string
  country: string
  descriptionRu: string
  descriptionUz: string
  shortDescRu: string
  shortDescUz: string
  compositionRu?: string
  compositionUz?: string
  careRu?: string
  careUz?: string
  sizeChartRu?: string
  sizeChartUz?: string
  photoUrls: string
  barcode?: string
  ikpu: string
  color?: string
  size?: string
  sellingPrice: number
  oldPrice: number
  weightGrams: number
  heightMm: number
  widthMm: number
  lengthMm: number
  characteristics?: Record<string, string>
}

export interface UzumCategory {
  id: string
  name: string
  fullPath: string
}

// ── Uzum Excel ───────────────────────────────────────────────────────────────

const UZUM_HEADERS = [
  'Название товара RU*',
  'Идентификатор от продавца',
  'Название товара UZ*',
  'Группировка SKU*',
  'Название категории*',
  'id категории*',
  'Бренд*',
  'Модель',
  'Страна производства*',
  'Описание товара RU*',
  'Описание товара UZ*',
  'Краткое описание RU*',
  'Краткое описание UZ*',
  'Состав RU',
  'Состав UZ',
  'Инструкция по уходу RU',
  'Инструкция по уходу UZ',
  'Размерная сетка RU',
  'Размерная сетка UZ',
  'Ссылки на фото*',
  'Штрихкод',
  'ИКПУ*',
  'Цвет',
  'Размер',
  'Цена продажи (som)*',
  'Цена до скидки (som)*',
  'Вес (г)*',
  'Высота (мм)*',
  'Ширина (мм)*',
  'Длина (мм)*',
]

const UZUM_DESC_ROW = [
  'Обязательное поле. Название товара на русском языке',
  'Необязательное поле. Ваш внутренний код товара',
  'Обязательное поле. Название товара на узбекском языке',
  'Обязательное поле. Используйте для группировки SKU (до 100 символов)',
  'Обязательное поле. Заполняется автоматически',
  'Обязательное поле. Заполняется автоматически',
  'Обязательное поле. Выберите бренд из справочника',
  'Необязательное поле. Модель товара',
  'Обязательное поле. Страна производства из справочника',
  'Обязательное поле. Описание товара на русском',
  'Обязательное поле. Описание товара на узбекском',
  'Обязательное поле. Краткое описание на русском',
  'Обязательное поле. Краткое описание на узбекском',
  'Состав товара на русском',
  'Состав товара на узбекском',
  'Инструкция по уходу на русском',
  'Инструкция по уходу на узбекском',
  'Размерная сетка на русском',
  'Размерная сетка на узбекском',
  'Обязательное поле. Ссылки через запятую. JPEG/PNG/WebP, 1080×1440',
  'EAN-13 или UPC-A. Если не заполнено, присвоится автоматически',
  'Обязательное поле. 16-значный код ИКПУ',
  'Цвет товара (для группировки SKU)',
  'Размер товара (для группировки SKU)',
  'Обязательное поле. Цена продажи в сумах',
  'Обязательное поле. Цена до скидки в сумах',
  'Обязательное поле. Вес в граммах',
  'Обязательное поле. Высота в миллиметрах',
  'Обязательное поле. Ширина в миллиметрах',
  'Обязательное поле. Длина в миллиметрах',
]

export function generateUzumExcel(
  products: ProductRow[],
  category: UzumCategory,
): Buffer {
  const wb = XLSX.utils.book_new()

  // ── Лист1: Product data ──
  const headerRow = ['', ...UZUM_HEADERS]
  const descRow = ['', ...UZUM_DESC_ROW]

  const dataRows = products.map((p, i) => [
    i + 1,
    p.nameRu,
    p.sku || '',
    p.nameUz,
    p.skuGroup,
    category.name,
    category.id,
    p.brand,
    p.model || '',
    p.country,
    p.descriptionRu,
    p.descriptionUz,
    p.shortDescRu,
    p.shortDescUz,
    p.compositionRu || '',
    p.compositionUz || '',
    p.careRu || '',
    p.careUz || '',
    p.sizeChartRu || '',
    p.sizeChartUz || '',
    p.photoUrls,
    p.barcode || '',
    p.ikpu,
    p.color || '',
    p.size || '',
    p.sellingPrice,
    p.oldPrice,
    p.weightGrams,
    p.heightMm,
    p.widthMm,
    p.lengthMm,
  ])

  const wsData = [headerRow, descRow, ...dataRows]
  const ws = XLSX.utils.aoa_to_sheet(wsData)

  const colWidths = UZUM_HEADERS.map((h, i) => {
    const maxData = Math.max(h.length, ...dataRows.map(r => String(r[i + 1] ?? '').length))
    return { wch: Math.min(Math.max(maxData + 2, 12), 50) }
  })
  ws['!cols'] = [{ wch: 4 }, ...colWidths]

  XLSX.utils.book_append_sheet(wb, ws, 'Лист1')

  // ── Instructions sheet ──
  const instrData = [
    ['Инструкция по заполнению файла'],
    [''],
    ['1. Один файл = одна категория товаров'],
    [`2. Выбранная категория: ${category.name} (ID: ${category.id})`],
    ['3. Каждая строка = один SKU (вариант товара)'],
    ['4. Строки с одинаковым значением в "Группировка SKU" объединяются в один товар'],
    ['5. Фотографии указываются ссылками через запятую (JPEG/PNG/WebP, 1080×1440, до 5МБ)'],
    ['6. Цены — только числа, без символов валюты'],
    ['7. Вес в граммах, размеры в миллиметрах'],
    ['8. ИКПУ — 16-значный код из tasnif.soliq.uz'],
    [''],
    ['Откройте этот файл в Excel для заполнения фильтров категории.'],
    ['Фильтры (столбцы после "Длина") зависят от категории и заполняются вручную.'],
    [''],
    ['Файл создан с помощью Daromadchi — daromadchi.uz'],
  ]
  const wsInstr = XLSX.utils.aoa_to_sheet(instrData)
  wsInstr['!cols'] = [{ wch: 80 }]
  XLSX.utils.book_append_sheet(wb, wsInstr, 'Инструкция')

  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
}

// ── Yandex Excel ─────────────────────────────────────────────────────────────

const YANDEX_HEADERS = [
  'Ваш SKU *',
  'Название товара *',
  'Ссылка на изображение *',
  'Описание товара *',
  'Категория на Маркете *',
  'Бренд *',
  'Штрихкод *',
  'Страна производства',
  'Название на узбекском *',
  'Описание на узбекском *',
  'Вес, кг *',
  'Длина, см *',
  'Ширина, см *',
  'Высота, см *',
  'Цена *',
  'Зачёркнутая цена',
  'Валюта *',
  'ИКПУ *',
  'Код упаковки *',
  'Характеристики товара',
]

export interface YandexCategoryParam {
  parameterId: number
  name: string
  type: 'ENUM' | 'TEXT' | 'NUMERIC' | 'BOOLEAN'
  required: boolean
  values?: { id: number; value: string }[]
  unit?: string
}

function formatCharacteristics(
  chars: Record<string, string> | undefined,
  params?: YandexCategoryParam[],
): string {
  if (!chars || Object.keys(chars).length === 0) return ''
  return Object.entries(chars)
    .map(([key, val]) => {
      const param = params?.find(p => p.name === key)
      if (param?.unit) return `${key}|${val}|${param.unit}`
      return `${key}|${val}`
    })
    .join(';')
}

export function generateYandexExcel(
  products: ProductRow[],
  yandexCategoryName: string,
  params?: YandexCategoryParam[],
): Buffer {
  const wb = XLSX.utils.book_new()

  const headerRow = YANDEX_HEADERS
  const descRow = [
    'Обязательное. Ваш уникальный код товара',
    'Обязательное. Название товара',
    'Обязательное. URL изображения',
    'Обязательное. Описание товара',
    'Обязательное. Категория на Яндекс Маркете',
    'Обязательное. Бренд/производитель',
    'Обязательное. Штрихкод (EAN-13)',
    'Страна производства',
    'Обязательное. Название на узбекском',
    'Обязательное. Описание на узбекском',
    'Обязательное. Вес в килограммах',
    'Обязательное. Длина в сантиметрах',
    'Обязательное. Ширина в сантиметрах',
    'Обязательное. Высота в сантиметрах',
    'Обязательное. Цена в UZS',
    'Зачёркнутая цена (до скидки)',
    'Обязательное. Валюта (UZS)',
    'Обязательное. 17-значный код ИКПУ',
    'Обязательное. Код упаковки',
    'Характеристики: Ключ|Значение;Ключ2|Значение2|Единица',
  ]

  const dataRows = products.map(p => [
    p.sku || '',
    p.nameRu,
    p.photoUrls.split(',')[0]?.trim() || '',
    p.descriptionRu,
    yandexCategoryName,
    p.brand,
    p.barcode || '',
    p.country,
    p.nameUz,
    p.descriptionUz,
    Math.round(p.weightGrams / 10) / 100,
    Math.round(p.lengthMm / 10) / 10,
    Math.round(p.widthMm / 10) / 10,
    Math.round(p.heightMm / 10) / 10,
    p.sellingPrice,
    p.oldPrice || '',
    'UZS',
    p.ikpu,
    '',
    formatCharacteristics(p.characteristics, params),
  ])

  const wsData = [headerRow, descRow, ...dataRows]
  const ws = XLSX.utils.aoa_to_sheet(wsData)

  ws['!cols'] = YANDEX_HEADERS.map((h, i) => {
    const maxData = Math.max(h.length, ...dataRows.map(r => String(r[i] ?? '').length))
    return { wch: Math.min(Math.max(maxData + 2, 12), 50) }
  })

  XLSX.utils.book_append_sheet(wb, ws, 'Список товаров')

  // ── Required parameters reference ──
  if (params && params.length > 0) {
    const paramRows: (string | number | boolean)[][] = [
      ['Параметр', 'Тип', 'Обязательный', 'Допустимые значения'],
    ]
    for (const p of params) {
      const valuesPreview = p.values
        ? p.values.slice(0, 20).map(v => v.value).join(', ')
          + (p.values.length > 20 ? `... (+${p.values.length - 20})` : '')
        : ''
      paramRows.push([
        p.name,
        p.type,
        p.required ? 'Да' : 'Нет',
        valuesPreview,
      ])
    }
    const wsParams = XLSX.utils.aoa_to_sheet(paramRows)
    wsParams['!cols'] = [
      { wch: 30 }, { wch: 10 }, { wch: 14 }, { wch: 80 },
    ]
    XLSX.utils.book_append_sheet(wb, wsParams, 'Параметры категории')
  }

  // ── Instructions ──
  const instrData = [
    ['Инструкция по заполнению файла для Яндекс Маркет'],
    [''],
    ['1. Каждая строка = один товар (SKU)'],
    [`2. Категория: ${yandexCategoryName}`],
    ['3. Вес указывается в килограммах, размеры в сантиметрах'],
    ['4. ИКПУ — 17-значный код из tasnif.soliq.uz'],
    ['5. Характеристики: формат Ключ|Значение;Ключ2|Значение2|Единица'],
    [''],
    ...(params
      ? [
          ['Обязательные характеристики для выбранной категории:'],
          ...params.filter(p => p.required).map(p => [`  • ${p.name} (${p.type})`]),
        ]
      : [['Характеристики зависят от категории. Проверьте в личном кабинете Яндекс Маркет.']]),
    [''],
    ['Файл создан с помощью Daromadchi — daromadchi.uz'],
  ]
  const wsInstr = XLSX.utils.aoa_to_sheet(instrData)
  wsInstr['!cols'] = [{ wch: 80 }]
  XLSX.utils.book_append_sheet(wb, wsInstr, 'Инструкция')

  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
}
