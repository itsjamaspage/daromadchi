import * as XLSX from 'xlsx'
import { unzipSync, zipSync } from 'fflate'
import { readFileSync } from 'fs'
import { join } from 'path'

function convertToInlineStrings(xlsxBuffer: Buffer): Buffer {
  const unzipped = unzipSync(new Uint8Array(xlsxBuffer))

  const sstData = unzipped['xl/sharedStrings.xml']
  if (!sstData) return xlsxBuffer

  const sstXml = new TextDecoder().decode(sstData)
  const strings: string[] = []
  const siRegex = /<si><t(?:\s[^>]*)?>([^<]*)<\/t><\/si>/g
  let m
  while ((m = siRegex.exec(sstXml)) !== null) {
    strings.push(m[1])
  }

  for (const [path, data] of Object.entries(unzipped)) {
    if (!path.startsWith('xl/worksheets/sheet') || !path.endsWith('.xml')) continue
    let xml = new TextDecoder().decode(data as Uint8Array)
    xml = xml.replace(
      /<c r="([^"]+)"((?:\s+s="[^"]*")?) t="s"><v>(\d+)<\/v><\/c>/g,
      (_, cellRef, styleAttr, idx) => {
        const text = strings[parseInt(idx)] || ''
        const spaceAttr = /^\s|\s$|\n/.test(text) ? ' xml:space="preserve"' : ''
        return `<c r="${cellRef}"${styleAttr} t="inlineStr"><is><t${spaceAttr}>${text}</t></is></c>`
      },
    )
    unzipped[path] = new TextEncoder().encode(xml)
  }

  delete unzipped['xl/sharedStrings.xml']

  let contentTypes = new TextDecoder().decode(unzipped['[Content_Types].xml'])
  contentTypes = contentTypes.replace(/<Override[^>]*sharedStrings[^>]*\/>/g, '')
  unzipped['[Content_Types].xml'] = new TextEncoder().encode(contentTypes)

  let rels = new TextDecoder().decode(unzipped['xl/_rels/workbook.xml.rels'])
  rels = rels.replace(/<Relationship[^>]*sharedStrings[^>]*\/>/g, '')
  unzipped['xl/_rels/workbook.xml.rels'] = new TextEncoder().encode(rels)

  return Buffer.from(zipSync(unzipped))
}

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

  return convertToInlineStrings(Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', bookSST: true })))
}

// ── Yandex Excel ─────────────────────────────────────────────────────────────

// Matches the real Yandex Market seller cabinet template structure exactly.
// Row 1 = section group headers (sparse), Row 2 = column headers, Row 3 = descriptions, Row 4+ = data.


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
  const templatePath = join(process.cwd(), 'lib/excel/templates/yandex-template.xlsx')
  const templateBuf = readFileSync(templatePath)
  const zip = unzipSync(new Uint8Array(templateBuf))

  const sheet3Key = 'xl/worksheets/sheet3.xml'
  const sheet3Xml = new TextDecoder().decode(zip[sheet3Key])

  const escXml = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/[^\x20-\x7E]/g, ch => '&#' + ch.charCodeAt(0) + ';')

  const inlineCell = (col: string, row: number, val: string, style = '63') =>
    `<c r="${col}${row}" s="${style}" t="inlineStr"><is><t>${escXml(val)}</t></is></c>`

  const numCell = (col: string, row: number, val: number, style = '63') =>
    `<c r="${col}${row}" s="${style}" t="n"><v>${val}</v></c>`

  const productRows = products.map((p, i) => {
    const r = 4 + i
    const chars = formatCharacteristics(p.characteristics, params)
    const cells = [
      inlineCell('D', r, p.sku || ''),
      inlineCell('E', r, p.nameRu),
      inlineCell('F', r, p.photoUrls, '75'),
      inlineCell('G', r, p.descriptionRu),
      inlineCell('H', r, yandexCategoryName),
      inlineCell('I', r, p.brand),
      inlineCell('J', r, p.barcode || ''),
      inlineCell('N', r, p.country),
      inlineCell('P', r, p.nameUz),
      inlineCell('Q', r, p.descriptionUz),
      numCell('R', r, Math.round(p.weightGrams / 10) / 100),
      numCell('S', r, Math.round(p.lengthMm / 10) / 10),
      numCell('T', r, Math.round(p.widthMm / 10) / 10),
      numCell('U', r, Math.round(p.heightMm / 10) / 10),
      numCell('W', r, p.sellingPrice),
      ...(p.oldPrice ? [numCell('X', r, p.oldPrice)] : []),
      inlineCell('Y', r, 'UZS'),
      inlineCell('AK', r, p.ikpu),
      ...(chars ? [inlineCell('AT', r, chars)] : []),
    ]
    return `<row r="${r}" ht="37.5" customHeight="1" s="38">${cells.join('')}</row>`
  })

  const lastRow = 3 + products.length
  let newXml = sheet3Xml.replace(/<dimension ref="[^"]*"/, `<dimension ref="A1:AY${lastRow}"`)
  newXml = newXml.replace(/<row r="4"[^]*?<\/row>/, productRows.join(''))

  zip[sheet3Key] = new TextEncoder().encode(newXml)

  const result = zipSync(zip, { level: 6 })
  return Buffer.from(result)
}
