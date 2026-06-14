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
    }).join(',')
  )
  const csv = [headers.join(','), ...rows].join('\n')
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

async function exportPdf(filename: string, targetRef?: RefObject<HTMLElement | null>) {
  const el = targetRef?.current
  if (!el) return

  const html2canvas = (await import('html2canvas')).default
  const { jsPDF } = await import('jspdf')

  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
  })

  const imgData = canvas.toDataURL('image/png')
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const imgW = pageW
  const imgH = (canvas.height * imgW) / canvas.width

  let posY = 0
  while (posY < imgH) {
    if (posY > 0) pdf.addPage()
    pdf.addImage(imgData, 'PNG', 0, -posY, imgW, imgH)
    posY += pageH
  }

  pdf.save(`${filename}.pdf`)
}

export default function ExportButton({ data, filename = 'hisobot', targetRef, label }: ExportButtonProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState<'xlsx' | 'pdf' | null>(null)
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

  async function handlePdf() {
    if (!data?.length) return
    setOpen(false)
    setLoading('pdf')
    try { await exportPdf(filename, targetRef) } finally { setLoading(null) }
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
          <span className="w-4 h-4 border-2 border-violet-400/40 border-t-violet-400 rounded-full animate-spin" />
        ) : (
          <Download className="w-4 h-4" />
        )}
        {label ?? 'Yuklab olish'}
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
