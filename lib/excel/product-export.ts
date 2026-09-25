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
  ikpuPackCode?: string
  characteristics?: Record<string, string>
}

export interface UzumCategory {
  id: string
  name: string
  fullPath: string
}

// ── Uzum Excel ───────────────────────────────────────────────────────────────
// Uses the real Uzum seller-cabinet template (.xlsm) as a base so the uploaded
// file passes Uzum's structural validation. Data is injected starting at row 4
// (row 1 = section groups, row 2 = column headers, row 3 = descriptions).
//
// Column mapping (1-indexed, matching template):
//   A=nameRu  B=sku  C=nameUz  D=skuGroup  E=categoryName  F=categoryId
//   G=brand  H=model  I=country  J=descRu  K=descUz  L=shortDescRu  M=shortDescUz
//   N=compositionRu  O=compositionUz  P=careRu  Q=careUz  R=sizeChartRu
//   S=sizeChartUz  T=photoUrls  U=barcode  V=ikpu  W=color  X=size
//   Y=sellingPrice  Z=oldPrice  AA=weight  AB=height  AC=width  AD=length
//   AE+=characteristics

function colLetter(n: number): string {
  let s = ''
  let v = n
  while (v > 0) {
    v--
    s = String.fromCharCode(65 + (v % 26)) + s
    v = Math.floor(v / 26)
  }
  return s
}

export function generateUzumExcel(
  products: ProductRow[],
  category: UzumCategory,
): Buffer {
  const templatePath = join(process.cwd(), 'lib/excel/templates/uzum-template.xlsm')
  const templateBuf = readFileSync(templatePath)
  const zip = unzipSync(new Uint8Array(templateBuf))

  const sheetKey = 'xl/worksheets/sheet1.xml'
  const sheetXml = new TextDecoder().decode(zip[sheetKey])

  const escXml = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')

  const inlineCell = (col: string, row: number, val: string, style?: string) => {
    const sAttr = style ? ` s="${style}"` : ''
    return `<c r="${col}${row}"${sAttr} t="inlineStr"><is><t>${escXml(val)}</t></is></c>`
  }

  const numCell = (col: string, row: number, val: number, style?: string) => {
    const sAttr = style ? ` s="${style}"` : ''
    return `<c r="${col}${row}"${sAttr} t="n"><v>${val}</v></c>`
  }

  const charKeys: string[] = []
  for (const p of products) {
    if (p.characteristics) {
      for (const key of Object.keys(p.characteristics)) {
        if (!charKeys.includes(key)) charKeys.push(key)
      }
    }
  }

  const productRows = products.map((p, i) => {
    const r = 4 + i
    const cells = [
      inlineCell('A', r, p.nameRu),
      inlineCell('B', r, p.sku || ''),
      inlineCell('C', r, p.nameUz),
      inlineCell('D', r, p.skuGroup),
      inlineCell('E', r, category.name),
      inlineCell('F', r, category.id),
      inlineCell('G', r, p.brand, '1'),
      ...(p.model ? [inlineCell('H', r, p.model)] : []),
      inlineCell('I', r, p.country, '1'),
      inlineCell('J', r, p.descriptionRu, '1'),
      inlineCell('K', r, p.descriptionUz, '1'),
      inlineCell('L', r, p.shortDescRu, '1'),
      inlineCell('M', r, p.shortDescUz, '1'),
      ...(p.compositionRu ? [inlineCell('N', r, p.compositionRu)] : []),
      ...(p.compositionUz ? [inlineCell('O', r, p.compositionUz)] : []),
      ...(p.careRu ? [inlineCell('P', r, p.careRu)] : []),
      ...(p.careUz ? [inlineCell('Q', r, p.careUz)] : []),
      ...(p.sizeChartRu ? [inlineCell('R', r, p.sizeChartRu)] : []),
      ...(p.sizeChartUz ? [inlineCell('S', r, p.sizeChartUz)] : []),
      inlineCell('T', r, p.photoUrls),
      ...(p.barcode ? [inlineCell('U', r, p.barcode)] : []),
      inlineCell('V', r, p.ikpu, '29'),
      ...(p.color ? [inlineCell('W', r, p.color)] : []),
      ...(p.size ? [inlineCell('X', r, p.size, '2')] : []),
      numCell('Y', r, p.sellingPrice),
      numCell('Z', r, p.oldPrice),
      numCell('AA', r, p.weightGrams),
      numCell('AB', r, p.heightMm),
      numCell('AC', r, p.widthMm),
      numCell('AD', r, p.lengthMm),
      ...charKeys.map((k, ci) => {
        const val = p.characteristics?.[k]
        if (!val) return ''
        return inlineCell(colLetter(31 + ci), r, val)
      }).filter(Boolean),
    ]
    const spanEnd = Math.max(37, 30 + charKeys.length)
    return `<row r="${r}" spans="1:${spanEnd}">${cells.join('')}</row>`
  })

  // Extract rows 1-3 from the template (group headers, column headers, descriptions)
  const headerRowsMatch = sheetXml.match(/<row r="[123]"[\s\S]*?<\/row>/g)
  if (!headerRowsMatch) throw new Error('Uzum template: cannot find header rows')

  // Update category path in C1 (row 1, column 3)
  // Template format is "fullPath | categoryId" — the CategoryList data validation requires this exact format
  let row1 = headerRowsMatch[0]
  const c1Value = category.id ? `${category.fullPath} | ${category.id}` : category.fullPath
  row1 = row1.replace(
    /<c r="C1"[^>]*>[\s\S]*?<\/c>/,
    `<c r="C1" s="4" t="inlineStr"><is><t>${escXml(c1Value)}</t></is></c>`,
  )

  // Inject characteristic names as column headers in row 2 (AE+ columns)
  let row2 = headerRowsMatch[1]
  if (charKeys.length > 0) {
    const charHeaderCells = charKeys.map((k, ci) =>
      `<c r="${colLetter(31 + ci)}2" t="inlineStr"><is><t>${escXml(k)}</t></is></c>`
    ).join('')
    row2 = row2.replace(/<\/row>$/, charHeaderCells + '</row>')
  }

  const headerXml = row1 + row2 + headerRowsMatch[2]

  const lastDataRow = 3 + products.length
  const lastCol = colLetter(Math.max(37, 30 + charKeys.length))
  let newXml = sheetXml.replace(
    /<sheetData>[\s\S]*<\/sheetData>/,
    `<sheetData>${headerXml}${productRows.join('')}</sheetData>`,
  )
  newXml = newXml.replace(/<dimension ref="[^"]*"/, `<dimension ref="A1:${lastCol}${lastDataRow}"`)

  zip[sheetKey] = new TextEncoder().encode(newXml)

  const result = zipSync(zip, { level: 6 })
  return Buffer.from(result)
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

  const inlineCell = (col: string, row: number, val: string, style = '63') =>
    `<c r="${col}${row}" s="${style}" t="inlineStr"><is><t>${escXml(val)}</t></is></c>`

  const numCell = (col: string, row: number, val: number, style = '63') =>
    `<c r="${col}${row}" s="${style}" t="n"><v>${val}</v></c>`

  const productRows = products.map((p, i) => {
    const r = 4 + i
    let chars = formatCharacteristics(p.characteristics, params)
    if (p.size) {
      const sizeEntry = `Размер|${p.size}`
      chars = chars ? `${sizeEntry};${chars}` : sizeEntry
    }
    if (p.color) {
      const colorEntry = `Цвет|${p.color}`
      chars = chars ? `${colorEntry};${chars}` : colorEntry
    }
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
      ...(p.ikpuPackCode ? [inlineCell('AL', r, p.ikpuPackCode)] : []),
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
