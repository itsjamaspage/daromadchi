'use client'

import { useState, useRef, useEffect, RefObject } from 'react'
import { Download, ChevronDown, FileSpreadsheet, FileText, FileDown } from 'lucide-react'

export type ExportRow = Record<string, string | number>

interface ExportButtonProps {
  data?: ExportRow[]
  filename?: string
  targetRef?: RefObject<HTMLElement | null>
  label?: string
}

function exportCsv(data: ExportRow[], filename: string) {
  const headers = Object.keys(data[0])
  const rows = data.map(row =>
    headers.map(h => {
      const v = row[h]
      const s = String(v ?? '')
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"` : s
    }).join(';')  // semicolon separator for better Excel compatibility
  )
  const csv = [headers.join(';'), ...rows].join('\n')
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
  // Build worksheet with header styling
  const headers = Object.keys(data[0])
  const wsData = [headers, ...data.map(row => headers.map(h => row[h] ?? ''))]
  const ws = XLSX.utils.aoa_to_sheet(wsData)

  // Column widths
  ws['!cols'] = headers.map(h => ({
    wch: Math.max(h.length + 2, ...data.map(r => String(r[h] ?? '').length)) + 2,
  }))

  // Bold header row
  headers.forEach((_, ci) => {
    const cell = XLSX.utils.encode_cell({ r: 0, c: ci })
    if (ws[cell]) {
      ws[cell].s = {
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '5B21B6' } },
        alignment: { horizontal: 'center' },
      }
    }
  })

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Hisobot')
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

function exportPdf(data: ExportRow[], filename: string) {
  // Use browser print — handles Cyrillic/Unicode perfectly, no font embedding needed
  const headers = Object.keys(data[0])
  const date = new Date().toLocaleDateString('ru-RU')

  const rows = data.map((row, ri) => `
    <tr style="background:${ri % 2 === 0 ? '#f8f7ff' : '#ffffff'}">
      ${headers.map(h => {
        const v = row[h]
        const s = String(v ?? '')
        const isNum = typeof v === 'number'
        const isNeg = isNum && v < 0
        const isProfit = h === 'Foyda' || h === 'ROI' || h === 'Marja'
        let color = '#1a1a2e'
        if (isProfit && isNum && v > 0) color = '#059669'
        if (isProfit && isNum && v <= 0) color = '#dc2626'
        if (!isProfit && isNeg) color = '#dc2626'
        return `<td style="padding:7px 10px;font-size:11px;color:${color};text-align:${isNum ? 'right' : 'left'};white-space:nowrap">${s}</td>`
      }).join('')}
    </tr>`).join('')

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${filename}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; padding: 20px; color: #1a1a2e; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; }
    .title { font-size: 18px; font-weight: 700; color: #4c1d95; }
    .date { font-size: 12px; color: #6b7280; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    thead tr { background: #5b21b6; }
    thead th { padding: 9px 10px; color: #fff; font-weight: 600; text-align: left; font-size: 11px; white-space: nowrap; }
    tbody tr:hover { background: #ede9fe !important; }
    td, th { border-bottom: 1px solid #e5e7eb; }
    .footer { margin-top: 14px; font-size: 10px; color: #9ca3af; text-align: center; }
    @media print {
      body { padding: 10px; }
      @page { margin: 10mm; size: landscape; }
    }
  </style>
</head>
<body>
  <div class="header">
    <span class="title">Daromadchi — ${filename}</span>
    <span class="date">${date}</span>
  </div>
  <table>
    <thead>
      <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="footer">Daromadchi · unit-ekonomika hisoboti · ${date}</div>
  <script>window.onload = () => { window.print(); }<\/script>
</body>
</html>`

  const win = window.open('', '_blank')
  if (win) {
    win.document.write(html)
    win.document.close()
  }
}

export default function ExportButton({ data, filename = 'hisobot', targetRef, label }: ExportButtonProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState<'xlsx' | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false)
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

  const has = !!data?.length

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(v => !v)}
        disabled={!!loading}
        className="flex items-center gap-2 bg-[var(--bg-input)] hover:bg-[var(--bg-input)] border border-[var(--border2)] text-[var(--text-dim)] text-sm font-medium px-4 py-2.5 rounded-xl transition-colors disabled:opacity-60"
      >
        {loading ? (
          <span className="w-4 h-4 border-2 border-violet-400/40 border-t-violet-400 rounded-full animate-spin" />
        ) : (
          <Download className="w-4 h-4" />
        )}
        {label ?? 'Yuklab olish'}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-50 bg-[var(--bg-card2)] border border-[var(--border2)] rounded-xl shadow-2xl shadow-black/60 overflow-hidden min-w-[170px]">
          {has && (
            <button onClick={handleXlsx}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-[var(--text-dim)] hover:bg-[var(--bg-card2)] hover:text-[var(--text-base)] transition-colors">
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              Excel (.xlsx)
            </button>
          )}
          {has && (
            <button onClick={handlePdf}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-[var(--text-dim)] hover:bg-[var(--bg-card2)] hover:text-[var(--text-base)] transition-colors">
              <FileText className="w-4 h-4 text-red-400" />
              PDF (chop etish)
            </button>
          )}
          {has && (
            <button onClick={handleCsv}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-[var(--text-dim)] hover:bg-[var(--bg-card2)] hover:text-[var(--text-base)] transition-colors">
              <FileDown className="w-4 h-4 text-sky-400" />
              CSV
            </button>
          )}
        </div>
      )}
    </div>
  )
}
