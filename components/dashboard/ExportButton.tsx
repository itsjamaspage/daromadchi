'use client'

import { useState, useRef, useEffect, RefObject } from 'react'
import { Download, ChevronDown, FileSpreadsheet, FileText, FileDown } from 'lucide-react'
import { useLang } from '@/app/providers'
import { dashT } from '@/lib/dashT'

export type ExportRow = Record<string, string | number>

interface ExportButtonProps {
  data?: ExportRow[]
  filename?: string
  targetRef?: RefObject<HTMLElement | null>
  label?: string
}

function exportCsv(data: ExportRow[], filename: string) {
  const sep = ','
  const headers = Object.keys(data[0])
  const rows = data.map(row =>
    headers.map(h => {
      const v = row[h]
      const s = String(v ?? '')
      return s.includes(sep) || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"` : s
    }).join(sep)
  )
  // sep= hint tells Excel which delimiter to use, fixing locale issues
  const csv = [`sep=${sep}`, headers.join(sep), ...rows].join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

async function exportXlsx(data: ExportRow[], filename: string) {
  const XLSX = await import('xlsx')
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Hisobot')
  // Auto-size columns
  const colWidths = Object.keys(data[0]).map(key => ({
    wch: Math.max(key.length, ...data.map(r => String(r[key] ?? '').length)) + 2
  }))
  ws['!cols'] = colWidths
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

function fmtPdfVal(v: string | number): string {
  if (typeof v === 'number') return new Intl.NumberFormat('uz-UZ').format(Math.round(v))
  return String(v ?? '')
}

function exportPdf(data: ExportRow[], filename: string) {
  const headers = Object.keys(data[0])
  const tableRows = data.map(row =>
    `<tr>${headers.map(h => `<td>${fmtPdfVal(row[h])}</td>`).join('')}</tr>`
  ).join('')

  const html = `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<title>${filename}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 11px; margin: 10mm; }
  h1 { font-size: 14px; margin-bottom: 4px; }
  p  { font-size: 10px; color: #666; margin-bottom: 10px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #5b21b6; color: #fff; padding: 5px 6px; text-align: left; font-size: 10px; white-space: nowrap; }
  td { padding: 4px 6px; border-bottom: 1px solid #e5e7eb; font-size: 10px; }
  tr:nth-child(even) td { background: #f8f8fc; }
  @media print { @page { size: A4 landscape; margin: 10mm; } }
</style>
</head><body>
<h1>${filename}</h1>
<p>${new Date().toLocaleDateString('ru-RU')}</p>
<table>
  <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
  <tbody>${tableRows}</tbody>
</table>
<script>window.onload=function(){window.print();}<\/script>
</body></html>`

  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function ExportButton({ data, filename = 'hisobot', targetRef: _targetRef, label }: ExportButtonProps) {
  const { lang } = useLang()
  const t = dashT[lang].export
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState<'xlsx' | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  async function handleXlsx() {
    if (!data?.length) return
    setOpen(false)
    setLoading('xlsx')
    try { await exportXlsx(data, filename) } finally { setLoading(null) }
  }

  function handlePdf() {
    if (!data?.length) return
    setOpen(false)
    exportPdf(data, filename)
  }

  function handleCsv() {
    if (!data?.length) return
    setOpen(false)
    exportCsv(data, filename)
  }

  const hasCsv = !!data?.length
  const hasXlsx = !!data?.length
  const hasPdf = !!data?.length

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(v => !v)}
        disabled={!!loading}
        className="flex items-center gap-2 bg-[var(--bg-input)] hover:bg-[var(--bg-input)] border border-[var(--border2)] text-[var(--text-dim)] text-sm font-medium px-4 py-2.5 rounded-xl transition-colors disabled:opacity-60"
      >
        {loading ? (
          <span className="w-4 h-4 border-2 border-[rgba(131,192,249,0.4)] border-t-[#83c0f9] rounded-full animate-spin" />
        ) : (
          <Download className="w-4 h-4" />
        )}
        {label ?? t.download}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-50 bg-[var(--bg-card2)] border border-[var(--border2)] rounded-xl shadow-2xl shadow-black/60 overflow-hidden min-w-[170px]">
          {hasXlsx && (
            <button
              onClick={handleXlsx}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-[var(--text-dim)] hover:bg-[var(--bg-card2)] hover:text-[var(--text-base)] transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              Excel (.xlsx)
            </button>
          )}
          {hasPdf && (
            <button
              onClick={handlePdf}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-[var(--text-dim)] hover:bg-[var(--bg-card2)] hover:text-[var(--text-base)] transition-colors"
            >
              <FileText className="w-4 h-4 text-red-400" />
              PDF
            </button>
          )}
          {hasCsv && (
            <button
              onClick={handleCsv}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-[var(--text-dim)] hover:bg-[var(--bg-card2)] hover:text-[var(--text-base)] transition-colors"
            >
              <FileDown className="w-4 h-4 text-sky-400" />
              CSV
            </button>
          )}
        </div>
      )}
    </div>
  )
}
