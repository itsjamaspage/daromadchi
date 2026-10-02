import { readFileSync } from 'fs'
import { join } from 'path'
import * as XLSX from 'xlsx'

export interface List3Enums {
  colors: string[]
  sizes: string[]
  brands: string[]
  countries: string[]
}

let cached: List3Enums | null = null

export function getList3Enums(): List3Enums {
  if (cached) return cached

  const templatePath = join(process.cwd(), 'lib/excel/templates/uzum-template.xlsm')
  const buf = readFileSync(templatePath)
  const wb = XLSX.read(buf, { type: 'buffer' })
  const ws = wb.Sheets['Лист3']
  if (!ws) throw new Error('Лист3 not found in Uzum template')

  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

  const colors: string[] = []
  const sizes: string[] = []
  const brands: string[] = []
  const countries: string[] = []

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    const size = String(row[0] || '').trim()
    const color = String(row[1] || '').trim()
    const brand = String(row[2] || '').trim()
    const country = String(row[3] || '').trim()
    if (size) sizes.push(size)
    if (color) colors.push(color)
    if (brand) brands.push(brand)
    if (country) countries.push(country)
  }

  cached = { colors, sizes, brands, countries }
  return cached
}

const NORMALIZE_MAP: Record<string, string> = {
  'ё': 'е', // ё → е
  'Ё': 'Е', // Ё → Е
}

function normalizeString(s: string): string {
  let result = s.trim()
  for (const [from, to] of Object.entries(NORMALIZE_MAP)) {
    result = result.split(from).join(to)
  }
  return result.toLowerCase()
}

let normalizedMaps: {
  colors: Map<string, string>
  sizes: Map<string, string>
  brands: Map<string, string>
  countries: Map<string, string>
} | null = null

function getNormalizedMaps() {
  if (normalizedMaps) return normalizedMaps

  const enums = getList3Enums()

  function buildMap(list: string[]): Map<string, string> {
    const map = new Map<string, string>()
    for (const item of list) {
      map.set(normalizeString(item), item)
    }
    return map
  }

  normalizedMaps = {
    colors: buildMap(enums.colors),
    sizes: buildMap(enums.sizes),
    brands: buildMap(enums.brands),
    countries: buildMap(enums.countries),
  }
  return normalizedMaps
}

export type ValidationResult = {
  valid: true
  canonical: string
} | {
  valid: false
  field: string
  value: string
}

export function validateEnum(field: 'color' | 'size' | 'brand' | 'country', value: string): ValidationResult {
  if (!value.trim()) return { valid: true, canonical: '' }

  const maps = getNormalizedMaps()
  const mapKey = field === 'color' ? 'colors'
    : field === 'size' ? 'sizes'
    : field === 'brand' ? 'brands'
    : 'countries'
  const map = maps[mapKey]

  const normalized = normalizeString(value)
  const canonical = map.get(normalized)

  if (canonical !== undefined) {
    return { valid: true, canonical }
  }

  return { valid: false, field, value }
}

export function validateSize(value: string): ValidationResult {
  if (!value.trim()) return { valid: true, canonical: '' }

  const rangePattern = /^\d+\s*[-–]\s*\d+$/
  if (rangePattern.test(value.trim())) {
    return { valid: false, field: 'size', value: `${value} (размерный диапазон недопустим — создайте отдельный вариант для каждого размера)` }
  }

  if (/^\d+([.,]\d+)?$/.test(value.trim())) {
    return { valid: false, field: 'size', value: `${value} (укажите размер в формате из списка, например: "Мужской размер обуви EUR:42")` }
  }

  return validateEnum('size', value)
}
