import { unzipSync, zipSync } from 'fflate'
import { readFileSync } from 'fs'
import { join } from 'path'
import { validateEnum, validateSize } from '@/lib/uzum/list3-enums'

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

export interface UzumValidationError {
  row: number
  field: string
  value: string
}

export function validateProductRows(products: ProductRow[]): UzumValidationError[] {
  const errors: UzumValidationError[] = []

  for (let i = 0; i < products.length; i++) {
    const p = products[i]
    const rowNum = i + 1

    if (p.color) {
      const r = validateEnum('color', p.color)
      if (!r.valid) errors.push({ row: rowNum, field: 'Цвет', value: r.value })
    }

    if (p.size) {
      const r = validateSize(p.size)
      if (!r.valid) errors.push({ row: rowNum, field: 'Размер', value: r.value })
    }

    if (p.country) {
      const r = validateEnum('country', p.country)
      if (!r.valid) errors.push({ row: rowNum, field: 'Страна производства', value: r.value })
    }

    if (p.brand) {
      const r = validateEnum('brand', p.brand)
      if (!r.valid) errors.push({ row: rowNum, field: 'Бренд', value: r.value })
    }
  }

  return errors
}

function normalizeProduct(p: ProductRow): ProductRow {
  const result = { ...p }

  if (result.color) {
    const r = validateEnum('color', result.color)
    if (r.valid) result.color = r.canonical || result.color
  }

  if (result.size) {
    const r = validateSize(result.size)
    if (r.valid) result.size = r.canonical || result.size
  }

  if (result.country) {
    const r = validateEnum('country', result.country)
    if (r.valid) result.country = r.canonical || result.country
  }

  if (result.brand) {
    const r = validateEnum('brand', result.brand)
    if (r.valid) result.brand = r.canonical || result.brand
  }

  return result
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

  const strCell = (col: string, row: number, val: string, style?: string) => {
    const sAttr = style ? ` s="${style}"` : ''
    return `<c r="${col}${row}"${sAttr} t="inlineStr"><is><t>${escXml(val)}</t></is></c>`
  }

  const numCell = (col: string, row: number, val: number, style?: string) => {
    const sAttr = style ? ` s="${style}"` : ''
    return `<c r="${col}${row}"${sAttr}><v>${val}</v></c>`
  }

  const allTemplateRows = sheetXml.match(/<row r="\d+"[\s\S]*?<\/row>/g)
  if (!allTemplateRows || allTemplateRows.length < 3) {
    throw new Error('Uzum template: cannot find header rows')
  }

  // Keep rows 1-3 exactly as in the template — only replace C1 value
  const c1Value = category.id ? `${category.fullPath} | ${category.id}` : category.fullPath
  const row1 = allTemplateRows[0].replace(
    /<c r="C1"[^>]*>[\s\S]*?<\/c>/,
    `<c r="C1" s="4" t="inlineStr"><is><t>${escXml(c1Value)}</t></is></c>`,
  )

  // Build data rows (row 4+) using inline strings — no SST modification
  const dataRows = products.map((rawP, i) => {
    const p = normalizeProduct(rawP)
    const r = 4 + i
    const cells = [
      strCell('A', r, p.nameRu),
      strCell('B', r, p.sku || ''),
      strCell('C', r, p.nameUz),
      strCell('D', r, p.skuGroup),
      strCell('E', r, category.name),
      numCell('F', r, Number(category.id)),
      strCell('G', r, p.brand, '1'),
      ...(p.model ? [strCell('H', r, p.model)] : []),
      strCell('I', r, p.country, '1'),
      strCell('J', r, p.descriptionRu, '1'),
      strCell('K', r, p.descriptionUz, '1'),
      strCell('L', r, p.shortDescRu, '1'),
      strCell('M', r, p.shortDescUz, '1'),
      ...(p.compositionRu ? [strCell('N', r, p.compositionRu)] : []),
      ...(p.compositionUz ? [strCell('O', r, p.compositionUz)] : []),
      ...(p.careRu ? [strCell('P', r, p.careRu)] : []),
      ...(p.careUz ? [strCell('Q', r, p.careUz)] : []),
      ...(p.sizeChartRu ? [strCell('R', r, p.sizeChartRu)] : []),
      ...(p.sizeChartUz ? [strCell('S', r, p.sizeChartUz)] : []),
      strCell('T', r, p.photoUrls),
      ...(p.barcode ? [strCell('U', r, p.barcode)] : []),
      strCell('V', r, p.ikpu, '29'),
      ...(p.color ? [strCell('W', r, p.color)] : []),
      ...(p.size ? [strCell('X', r, p.size, '2')] : []),
      numCell('Y', r, Math.round(p.sellingPrice / 1000) * 1000),
      numCell('Z', r, Math.round(p.oldPrice / 1000) * 1000),
      numCell('AA', r, p.weightGrams),
      numCell('AB', r, p.heightMm),
      numCell('AC', r, p.widthMm),
      numCell('AD', r, p.lengthMm),
    ]
    return `<row r="${r}" spans="1:37">${cells.join('')}</row>`
  })

  // Preserve the template's empty styled rows AFTER our data rows
  const emptyTemplateRows = allTemplateRows.slice(3 + products.length)

  // Reassemble sheetData: row1 (with C1 updated) + rows 2-3 unchanged + data + remaining
  const newSheetData = [row1, allTemplateRows[1], allTemplateRows[2], ...dataRows, ...emptyTemplateRows].join('')

  const newXml = sheetXml.replace(
    /<sheetData>[\s\S]*<\/sheetData>/,
    `<sheetData>${newSheetData}</sheetData>`,
  )

  zip[sheetKey] = new TextEncoder().encode(newXml)

  const result = zipSync(zip, { level: 6 })
  return Buffer.from(result)
}
