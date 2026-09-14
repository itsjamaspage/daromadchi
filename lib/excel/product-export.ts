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

// Matches the real Yandex Market seller cabinet template structure exactly.
// Row 1 = section group headers (sparse), Row 2 = column headers, Row 3 = descriptions, Row 4+ = data.

const YANDEX_SECTION_GROUPS: { col: number; label: string }[] = [
  { col: 4, label: 'Основные параметры' },
  { col: 18, label: 'Вес и габариты с упаковкой' },
  { col: 23, label: 'Цена' },
  { col: 28, label: 'Срок годности и службы' },
  { col: 32, label: 'Гарантийный срок' },
  { col: 34, label: 'Маркировка и документы' },
  { col: 39, label: 'Уценка' },
  { col: 42, label: 'Дополнительно' },
]

interface YandexCol {
  header: string
  key: string
  direction: 'in' | 'out' | 'inout'
  group: string
  frontKey: string
  desc: string
}

const YANDEX_COLUMNS: YandexCol[] = [
  { header: 'Критичные ошибки', key: 'log-message', direction: 'out', group: 'message', frontKey: 'log-message', desc: '' },
  { header: 'Некритичные ошибки', key: 'info-message', direction: 'out', group: 'message', frontKey: 'info-message', desc: '' },
  { header: 'Качество карточки', key: 'contentQuality', direction: 'out', group: 'message', frontKey: 'contentQuality', desc: '' },
  { header: 'Ваш SKU *', key: 'id', direction: 'in', group: 'base', frontKey: 'id', desc: 'Уникальный идентификатор товара, для которого будет передана цена' },
  { header: 'Название товара *', key: 'name', direction: 'in', group: 'base', frontKey: 'name', desc: 'По схеме: тип товара + бренд или производитель + модель + отличительные характеристики' },
  { header: 'Ссылка на изображение *', key: 'picture', direction: 'in', group: 'base', frontKey: 'picture', desc: 'Cсылка на изображение товара. Можно указать до 30 ссылок через запятую.' },
  { header: 'Описание товара *', key: 'description', direction: 'in', group: 'base', frontKey: 'description', desc: 'Не более 6000 символов (включая знаки препинания)' },
  { header: 'Категория на Маркете *', key: 'category,market_category_id', direction: 'in', group: 'base', frontKey: 'category', desc: 'Она помогает точнее определить категорию в каталоге Маркета.' },
  { header: 'Бренд *', key: 'vendor', direction: 'in', group: 'base', frontKey: 'vendor', desc: 'Название торговой марки, бренд или производитель товара.' },
  { header: 'Штрихкод *', key: 'barcode', direction: 'in', group: 'base', frontKey: 'barcode', desc: 'Если штрихкодов несколько, перечислите через запятую' },
  { header: 'Теги', key: 'set-ids', direction: 'in', group: 'base', frontKey: 'tags', desc: 'Можно указать до 10 тегов через запятую.' },
  { header: 'Ссылка на видео', key: 'video', direction: 'in', group: 'base', frontKey: 'video', desc: 'Прямые ссылки на видео (MP4, WebM, MOV, QT, FLV, AVI)' },
  { header: 'Инструкции', key: 'manual', direction: 'in', group: 'base', frontKey: 'manual', desc: 'Прямая ссылка на инструкцию (PDF, JPG, PNG)' },
  { header: 'Страна производства', key: 'country_of_origin', direction: 'in', group: 'base', frontKey: 'country_of_origin', desc: 'Название на русском языке.' },
  { header: 'Артикул производителя', key: 'vendorCode', direction: 'in', group: 'base', frontKey: 'vendorCode', desc: 'Код товара, который ему присваивает производитель.' },
  { header: 'Название на узбекском языке латиницей *', key: 'uz_name', direction: 'in', group: 'base', frontKey: 'uz_name', desc: '' },
  { header: 'Описание на узбекском языке латиницей *', key: 'uz_description', direction: 'in', group: 'base', frontKey: 'uz_description', desc: '' },
  { header: 'Вес, кг *', key: 'weight', direction: 'in', group: 'weight_and_dimension', frontKey: 'weight_and_dimensions', desc: 'Вес товара в транспортной упаковке, можно с точностью до тысячных.' },
  { header: 'Длина, см *', key: 'length', direction: 'in', group: 'weight_and_dimension', frontKey: 'weight_and_dimensions', desc: 'Длина упаковки в сантиметрах.' },
  { header: 'Ширина, см *', key: 'width', direction: 'in', group: 'weight_and_dimension', frontKey: 'weight_and_dimensions', desc: 'Ширина упаковки в сантиметрах.' },
  { header: 'Высота, см *', key: 'height', direction: 'in', group: 'weight_and_dimension', frontKey: 'weight_and_dimensions', desc: 'Высота упаковки в сантиметрах.' },
  { header: 'Товар доставляется в нескольких упаковках', key: 'box_count', direction: 'in', group: 'weight_and_dimension', frontKey: 'box-count', desc: '' },
  { header: 'Цена *', key: 'price', direction: 'in', group: 'default_price', frontKey: 'default_price', desc: 'Цена в валюте кабинета, по которой вы хотите продавать товар.' },
  { header: 'Зачёркнутая цена', key: 'oldprice', direction: 'in', group: 'default_price', frontKey: 'default_price', desc: 'Цена до скидки в валюте кабинета.' },
  { header: 'Валюта *', key: 'currencyId', direction: 'in', group: 'default_price', frontKey: 'currencyId', desc: 'Валюта, в которой указаны цены' },
  { header: 'Себестоимость', key: 'purchase_price', direction: 'in', group: 'default_price', frontKey: 'purchase_price', desc: '' },
  { header: 'Дополнительные расходы', key: 'additional_expenses', direction: 'in', group: 'default_price', frontKey: 'additional_expenses', desc: '' },
  { header: 'Срок годности', key: 'period_of_validity_days', direction: 'in', group: 'expiry', frontKey: 'period_of_validity_days', desc: 'В годах, месяцах, днях, неделях или часах' },
  { header: 'Комментарий к сроку годности', key: 'comment_validity_days', direction: 'in', group: 'expiry', frontKey: 'comment_validity_days', desc: '' },
  { header: 'Срок службы', key: 'service_life_days', direction: 'in', group: 'expiry', frontKey: 'service_life_days', desc: '' },
  { header: 'Комментарий к сроку службы', key: 'comment_life_days', direction: 'in', group: 'expiry', frontKey: 'comment_life_days', desc: '' },
  { header: 'Гарантийный срок', key: 'warranty_days', direction: 'in', group: 'warranty', frontKey: 'warranty_days', desc: '' },
  { header: 'Комментарий к гарантийному сроку', key: 'comment_warranty', direction: 'in', group: 'warranty', frontKey: 'comment_warranty', desc: '' },
  { header: 'Буду маркировать', key: 'cargo_types', direction: 'in', group: 'mark_and_docs', frontKey: 'cargo_types', desc: '' },
  { header: 'Номер документа на товар', key: 'certificate', direction: 'in', group: 'mark_and_docs', frontKey: 'certificate', desc: '' },
  { header: 'Код ТН ВЭД', key: 'tn_ved_code', direction: 'in', group: 'mark_and_docs', frontKey: 'tn_ved_code', desc: '' },
  { header: 'ИКПУ *', key: 'ikpu', direction: 'in', group: 'mark_and_docs', frontKey: 'ikpu', desc: 'Идентификационный код продукции и услуг для Узбекистана. 17 цифр.' },
  { header: 'Код упаковки *', key: 'ikpu_pack_code', direction: 'in', group: 'mark_and_docs', frontKey: 'ikpu_pack_code', desc: 'Обычно привязан к ИКПУ, состоит из цифр.' },
  { header: 'Тип уценки', key: 'condition-type', direction: 'in', group: 'resale', frontKey: 'condition', desc: '' },
  { header: 'Внешний вид товара', key: 'condition-quality', direction: 'in', group: 'resale', frontKey: 'condition', desc: '' },
  { header: 'Описание состояния товара', key: 'condition-reason', direction: 'in', group: 'resale', frontKey: 'condition', desc: '' },
  { header: 'Особый тип товара', key: 'type', direction: 'in', group: 'optional', frontKey: 'type', desc: '' },
  { header: 'С какого возраста пользоваться', key: 'age,age_unit', direction: 'in', group: 'optional', frontKey: 'age', desc: '' },
  { header: 'Товар для взрослых', key: 'adult', direction: 'in', group: 'optional', frontKey: 'adult', desc: '' },
  { header: 'Цифровой товар', key: 'downloadable', direction: 'in', group: 'optional', frontKey: 'downloadable', desc: '' },
  { header: 'Характеристики товара', key: 'param', direction: 'in', group: 'optional', frontKey: 'param', desc: 'Все важные характеристики товара — цвет, размер, объем, материал, возраст, пол, и т. д.' },
  { header: 'В архиве', key: 'archived', direction: 'in', group: 'optional', frontKey: 'archived', desc: '' },
  { header: 'Артикул товара (SKU)', key: 'market-sku', direction: 'inout', group: 'optional', frontKey: 'market_sku', desc: '' },
  { header: 'Артикул Маркета', key: 'suggested-sku', direction: 'out', group: 'optional', frontKey: 'suggested_sku', desc: '' },
  { header: 'Категория на Маркете', key: 'market_category', direction: 'out', group: 'out', frontKey: 'market_category', desc: '' },
  { header: 'Дата дополнения карточки', key: 'max_replicator_timestamp', direction: 'in', group: 'tech', frontKey: 'max_replicator_timestamp', desc: '' },
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

  // ── Инструкция sheet (first, matches real template order) ──
  const instrData = [
    ['', ''],
    ['Инструкция\t', ''],
    ['Шаг 1. Заполните шаблон\t', ''],
    ['Перейдите на лист Список товаров, изучите пример заполненного товара, но не забудьте удалить его перед загрузкой каталога.', ''],
    ['Добавьте ваши товары. Обязательные для заполнения поля помечены звездочкой (*).', ''],
    ['Наведите на название поля, чтобы узнать, как его правильно заполнить.', ''],
    ['', ''],
    ['Шаг 2. Загрузите шаблон в систему\t', ''],
    ['Перейдите в раздел Товары → Каталог.', ''],
    ['Выберите Загрузить товары и загрузите этот шаблон в появившемся окне.', ''],
    ['', ''],
    [`Категория: ${yandexCategoryName}`, ''],
    ['Файл создан с помощью Daromadchi — daromadchi.uz', ''],
  ]
  const wsInstr = XLSX.utils.aoa_to_sheet(instrData)
  wsInstr['!cols'] = [{ wch: 80 }, { wch: 20 }]
  XLSX.utils.book_append_sheet(wb, wsInstr, 'Инструкция')

  // ── Enums sheet (minimal — required for template recognition) ──
  const wsEnums = XLSX.utils.aoa_to_sheet([['createMap', '', 'market_category_id', 'category']])
  XLSX.utils.book_append_sheet(wb, wsEnums, 'Enums')

  // ── Список товаров sheet ──
  const totalCols = YANDEX_COLUMNS.length

  // Row 1: section group headers (sparse, matching real template)
  const groupRow: (string | null)[] = new Array(totalCols).fill(null)
  for (const g of YANDEX_SECTION_GROUPS) {
    groupRow[g.col - 1] = g.label
  }

  // Row 2: column headers
  const headerRow = YANDEX_COLUMNS.map(c => c.header)

  // Row 3: descriptions
  const descRow = YANDEX_COLUMNS.map(c => c.desc)

  // Data rows (columns 1-3 empty for error/quality, then data from col 4)
  const colIndex = (key: string) => YANDEX_COLUMNS.findIndex(c => c.header === key)
  const dataRows = products.map(p => {
    const row: (string | number | null)[] = new Array(totalCols).fill('')
    row[colIndex('Ваш SKU *')] = p.sku || ''
    row[colIndex('Название товара *')] = p.nameRu
    row[colIndex('Ссылка на изображение *')] = p.photoUrls
    row[colIndex('Описание товара *')] = p.descriptionRu
    row[colIndex('Категория на Маркете *')] = yandexCategoryName
    row[colIndex('Бренд *')] = p.brand
    row[colIndex('Штрихкод *')] = p.barcode || ''
    row[colIndex('Страна производства')] = p.country
    row[colIndex('Название на узбекском языке латиницей *')] = p.nameUz
    row[colIndex('Описание на узбекском языке латиницей *')] = p.descriptionUz
    row[colIndex('Вес, кг *')] = Math.round(p.weightGrams / 10) / 100
    row[colIndex('Длина, см *')] = Math.round(p.lengthMm / 10) / 10
    row[colIndex('Ширина, см *')] = Math.round(p.widthMm / 10) / 10
    row[colIndex('Высота, см *')] = Math.round(p.heightMm / 10) / 10
    row[colIndex('Цена *')] = p.sellingPrice
    row[colIndex('Зачёркнутая цена')] = p.oldPrice || ''
    row[colIndex('Валюта *')] = 'UZS'
    row[colIndex('ИКПУ *')] = p.ikpu
    row[colIndex('Код упаковки *')] = ''
    row[colIndex('Характеристики товара')] = formatCharacteristics(p.characteristics, params)
    return row
  })

  const wsData = [groupRow, headerRow, descRow, ...dataRows]
  const ws = XLSX.utils.aoa_to_sheet(wsData)

  ws['!cols'] = YANDEX_COLUMNS.map((c, i) => {
    if (i < 3) return { wch: 20 }
    const maxData = Math.max(c.header.length, ...dataRows.map(r => String(r[i] ?? '').length))
    return { wch: Math.min(Math.max(maxData + 2, 12), 50) }
  })

  XLSX.utils.book_append_sheet(wb, ws, 'Список товаров')

  // ── Настройки sheet (column mappings — critical for Yandex import) ──
  const settingsRows: (string | number | boolean)[][] = [
    ['sheetName', 'Список товаров', '', '', '', ''],
    ['headerAddress', 'A2', '', '', '', ''],
    ['skipRows', '1', '', '', '', ''],
  ]
  for (const c of YANDEX_COLUMNS) {
    settingsRows.push(['columnMapping', c.header, c.key, c.direction, '', c.group, c.frontKey])
  }
  settingsRows.push(['errorFormatting', 'FALSE'])
  const wsSettings = XLSX.utils.aoa_to_sheet(settingsRows)
  wsSettings['!cols'] = [{ wch: 16 }, { wch: 45 }, { wch: 30 }, { wch: 6 }, { wch: 4 }, { wch: 22 }, { wch: 30 }]
  XLSX.utils.book_append_sheet(wb, wsSettings, 'Настройки')

  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
}
