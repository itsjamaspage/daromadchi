import { NextResponse } from 'next/server'
import { existsSync } from 'fs'
import { join } from 'path'
import { getCurrentUser } from '@/lib/auth/session'
import { withErrorHandler } from '@/lib/api-handler'
import { getRootCategories } from '@/lib/uzum/public'
import { getUzumTemplateCategories } from '@/lib/uzum/static-categories'

export const runtime = 'nodejs'

export const GET = withErrorHandler(async () => {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tree = await getRootCategories()
  if (tree.length > 0) {
    return NextResponse.json({ categories: tree })
  }

  const templateTree = getUzumTemplateCategories()
  if (templateTree.length > 0) {
    return NextResponse.json({ categories: templateTree, fallback: true })
  }

  const templatePath = join(process.cwd(), 'lib/excel/templates/uzum-template.xlsm')
  let sheetNames: string[] = []
  let rowCount = 0
  let parseError: string | null = null
  try {
    const XLSX = await import('xlsx')
    const wb = XLSX.readFile(templatePath)
    sheetNames = wb.SheetNames
    const ws = wb.Sheets['Лист2']
    if (ws) {
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][]
      rowCount = rows.length
    }
  } catch (e) {
    parseError = String(e).slice(0, 300)
  }
  const debug = {
    cwd: process.cwd(),
    templateExists: existsSync(templatePath),
    sheetNames,
    rowCount,
    parseError,
  }
  console.error('[uzum-categories] Both sources empty. Debug:', debug)
  return NextResponse.json({ categories: [], fallback: true, debug })
})
