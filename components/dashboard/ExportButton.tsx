'use client'

import { Download } from 'lucide-react'

interface ExportButtonProps {
  data: Record<string, string | number>[]
  filename: string
}

export default function ExportButton({ data, filename }: ExportButtonProps) {
  function handleExport() {
    if (!data.length) return
    const headers = Object.keys(data[0])
    const rows    = data.map(row =>
      headers.map(h => {
        const v = row[h]
        const s = String(v ?? '')
        return s.includes(',') || s.includes('"') || s.includes('\n')
          ? `"${s.replace(/"/g, '""')}"` : s
      }).join(',')
    )
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `${filename}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button
      onClick={handleExport}
      className="flex items-center gap-2 bg-[var(--bg-input)] hover:bg-white/[0.06] border border-[var(--border2)] text-slate-300 text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
    >
      <Download className="w-4 h-4" />
      CSV
    </button>
  )
}
