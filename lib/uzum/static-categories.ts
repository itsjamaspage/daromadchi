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
    const wb = XLSX.readFile(templatePath)
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
  } catch {
    return []
  }
}

// Backward-compat export — now returns real IDs from the template
export const UZUM_STATIC_CATEGORIES: StaticCategory[] = []
