// Uzum category fallback: reads real category IDs from the Uzum seller-cabinet
// template (Лист2) so exported Excel files pass Uzum's validation.
// Cached in memory after first load.

import { readFileSync } from 'fs'
import { join } from 'path'
import * as XLSX from 'xlsx'

export interface StaticCategory {
  id: number
  title: string
  children?: StaticCategory[]
}

let cached: StaticCategory[] | null = null

export function getUzumTemplateCategories(): StaticCategory[] {
  if (cached) return cached

  try {
    const templatePath = join(process.cwd(), 'lib/excel/templates/uzum-template.xlsm')
    const buf = readFileSync(templatePath)
    const wb = XLSX.read(buf, { type: 'buffer' })
    const ws = wb.Sheets['Лист2']
    if (!ws) return []

    const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
    // Row 0 is header: category_id, category_title, full_path_ru, ...
    // Row 1+ is data

    const tree: StaticCategory[] = []
    const nodeMap = new Map<string, StaticCategory>()

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]
      const id = Number(row[0])
      const title = String(row[1] || '').trim()
      const fullPath = String(row[2] || '').trim()
      if (!id || !title || !fullPath) continue

      const parts = fullPath.split(' > ').map(p => p.trim())
      const node: StaticCategory = { id, title }

      if (parts.length === 1) {
        tree.push(node)
      } else {
        const parentPath = parts.slice(0, -1).join(' > ')
        const parent = nodeMap.get(parentPath)
        if (parent) {
          if (!parent.children) parent.children = []
          parent.children.push(node)
        } else {
          tree.push(node)
        }
      }

      nodeMap.set(fullPath, node)
    }

    cached = tree
    return tree
  } catch (err) {
    console.error('[getUzumTemplateCategories] Failed to parse template:', err)
    return []
  }
}

export interface UzumCategoryFilter {
  filterId: number
  name: string
  type: 'SINGLE_CHOICE' | 'MULTI_CHOICE' | 'TEXT'
  values: string[]
}

let filterCache: Map<number, UzumCategoryFilter[]> | null = null

export function getUzumTemplateFilters(categoryId: number): UzumCategoryFilter[] {
  if (!filterCache) {
    filterCache = new Map()
    try {
      const templatePath = join(process.cwd(), 'lib/excel/templates/uzum-template.xlsm')
      const buf = readFileSync(templatePath)
      const wb = XLSX.read(buf, { type: 'buffer' })
      const ws = wb.Sheets['Лист2']
      if (!ws) return []

      const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i]
        const catId = Number(row[0])
        const filterId = Number(row[3])
        const filterName = String(row[4] || '').trim()
        const filterValues = String(row[5] || '').trim()
        const customerType = String(row[6] || '').trim()
        if (!catId || !filterId || !filterName) continue

        const type = customerType === 'MULTI_CHOICE' ? 'MULTI_CHOICE'
          : customerType === 'SINGLE_CHOICE' ? 'SINGLE_CHOICE' : 'TEXT'
        const values = filterValues ? filterValues.split(';').map(v => v.trim()).filter(Boolean) : []

        if (!filterCache.has(catId)) filterCache.set(catId, [])
        filterCache.get(catId)!.push({ filterId, name: filterName, type, values })
      }
    } catch (err) {
      console.error('[getUzumTemplateFilters] Failed to parse:', err)
    }
  }
  return filterCache.get(categoryId) ?? []
}

// Backward-compat export — now returns real IDs from the template
export const UZUM_STATIC_CATEGORIES: StaticCategory[] = []
