'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import {
  Plus, Trash2, Download, FileSpreadsheet, Upload,
  ChevronDown, ChevronUp, ArrowLeft, Check, AlertCircle, Search,
  RefreshCw,
} from 'lucide-react'
import Link from 'next/link'
import { useLang } from '@/app/providers'
import { translations } from '@/lib/i18n'
import { useAutoTranslate } from '@/hooks/useAutoTranslate'
import type { IkpuResult } from '@/lib/ikpu/client'
import { searchIkpu } from '@/lib/ikpu/browser-client'
interface CatNode {
  id: number
  name: string
  children?: CatNode[]
}

interface Variant {
  id: string
  color: string
  size: string
  sku: string
  barcode: string
  sellingPrice: string
  oldPrice: string
  photoUrl: string
}

const uid = () => Math.random().toString(36).slice(2, 9)

function resolveIdPath(tree: CatNode[], ids: number[]): CatNode[] {
  const path: CatNode[] = []
  let nodes = tree
  for (const id of ids) {
    const found = nodes.find(n => n.id === id)
    if (!found) break
    path.push(found)
    nodes = found.children ?? []
  }
  return path
}

const FORM_SAVED_KEY = 'product-create-form-saved'

interface FormDraft {
  nameRu: string; nameUz: string; sku: string; brand: string; model: string; country: string
  brandSkipped: boolean; modelSkipped: boolean; countrySkipped: boolean
  descRu: string; descUz: string; shortDescRu: string; shortDescUz: string
  photoUrls: string; sellingPrice: string; oldPrice: string
  weightG: string; heightMm: string; widthMm: string; lengthMm: string
  ikpu: string; ikpuPackCode: string; barcode: string; skuGroup: string
  variants: Variant[]
  uzumCatPathIds: number[]
  savedAt?: number
}

function loadSavedDraft(): Partial<FormDraft> | null {
  try {
    const saved = localStorage.getItem(FORM_SAVED_KEY)
    if (saved) return JSON.parse(saved)
    return null
  } catch { return null }
}

function saveDraftToLocal(draft: FormDraft) {
  try { localStorage.setItem(FORM_SAVED_KEY, JSON.stringify({ ...draft, savedAt: Date.now() })) } catch {}
}

function generateEAN13(): string {
  const prefix = '200'
  const body = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10)).join('')
  const digits = prefix + body
  let sum = 0
  for (let i = 0; i < 12; i++) {
    sum += Number(digits[i]) * (i % 2 === 0 ? 1 : 3)
  }
  return digits + ((10 - (sum % 10)) % 10)
}

const EMPTY_VARIANT = (): Variant => ({
  id: uid(),
  color: '',
  size: '',
  sku: '',
  barcode: '',
  sellingPrice: '',
  oldPrice: '',
  photoUrl: '',
})

// ── Cascading category picker ────────────────────────────────────────────────

function CascadingCatPicker({
  tree,
  loading,
  error,
  selectedPath,
  onSelect,
  label,
  badge,
  accentColor,
}: {
  tree: CatNode[]
  loading: boolean
  error: string
  selectedPath: CatNode[]
  onSelect: (path: CatNode[]) => void
  label: string
  badge: React.ReactNode
  accentColor: string
}) {
  const levels: { items: CatNode[]; selected: CatNode | null }[] = []

  levels.push({ items: tree, selected: selectedPath[0] ?? null })
  for (let i = 0; i < selectedPath.length; i++) {
    const node = selectedPath[i]
    if (node.children?.length) {
      levels.push({ items: node.children, selected: selectedPath[i + 1] ?? null })
    }
  }

  const [filterTexts, setFilterTexts] = useState<string[]>([])
  const [openLevel, setOpenLevel] = useState<number | null>(null)
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setOpenLevel(null)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const getName = (node: CatNode) => node.name

  if (loading) {
    return (
      <div>
        <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-dim)' }}>
          {label} {badge}
        </label>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl border text-sm"
          style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
          <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: accentColor }} />
          Загрузка категорий...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-dim)' }}>
          {label} {badge}
        </label>
        <p className="text-xs" style={{ color: accentColor }}>{error}</p>
      </div>
    )
  }

  if (tree.length === 0) {
    return (
      <div>
        <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-dim)' }}>
          {label} {badge}
        </label>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl border text-sm"
          style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
          <AlertCircle className="w-4 h-4 flex-shrink-0" style={{ color: accentColor }} />
          Категории недоступны
        </div>
      </div>
    )
  }

  return (
    <div ref={pickerRef}>
      <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-dim)' }}>
        {label} {badge}
      </label>
      <div className="space-y-2">
        {levels.map((level, li) => {
          const filter = (filterTexts[li] ?? '').toLowerCase()
          const filtered = filter
            ? level.items.filter(c => getName(c).toLowerCase().includes(filter))
            : level.items
          const isOpen = openLevel === li

          return (
            <div key={li} className="relative">
              <button
                type="button"
                onClick={() => setOpenLevel(isOpen ? null : li)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl border text-sm transition-colors"
                style={{
                  background: 'var(--bg-input)',
                  borderColor: level.selected ? accentColor : 'var(--border)',
                  color: level.selected ? 'var(--text-base)' : 'var(--text-muted)',
                }}
              >
                <span className={level.selected ? 'font-medium' : ''}>
                  {level.selected ? getName(level.selected) : (li === 0 ? 'Выберите категорию' : 'Выберите подкатегорию')}
                </span>
                <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
              </button>
              {isOpen && (
                <div
                  className="absolute z-30 left-0 right-0 mt-1 rounded-xl border shadow-lg"
                  style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
                >
                  {level.items.length > 8 && (
                    <div className="p-2 border-b" style={{ borderColor: 'var(--border)' }}>
                      <div className="relative">
                        <input
                          type="text"
                          value={filterTexts[li] ?? ''}
                          onChange={e => {
                            const next = [...filterTexts]
                            next[li] = e.target.value
                            setFilterTexts(next)
                          }}
                          placeholder="Поиск..."
                          className="w-full px-3 py-1.5 pr-8 rounded-lg border text-sm focus:outline-none focus:ring-1"
                          style={{
                            background: 'var(--bg-input)',
                            borderColor: 'var(--border)',
                            color: 'var(--text-base)',
                          }}
                          autoFocus
                        />
                        <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                      </div>
                    </div>
                  )}
                  <div className="max-h-60 overflow-y-auto">
                    {filtered.length === 0 && (
                      <p className="px-3 py-2 text-sm" style={{ color: 'var(--text-muted)' }}>Не найдено</p>
                    )}
                    {filtered.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          const newPath = [...selectedPath.slice(0, li), c]
                          onSelect(newPath)
                          setOpenLevel(null)
                          setFilterTexts(prev => prev.slice(0, li))
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:opacity-80 transition-colors border-b last:border-b-0 flex items-center justify-between"
                        style={{
                          color: 'var(--text-base)',
                          borderColor: 'var(--border)',
                          background: level.selected?.id === c.id ? `${accentColor}15` : undefined,
                        }}
                      >
                        <span className={level.selected?.id === c.id ? 'font-medium' : ''}>{getName(c)}</span>
                        {c.children && c.children.length > 0 && (
                          <ChevronDown className="w-3 h-3 -rotate-90 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
      {selectedPath.length > 0 && (
        <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
          {selectedPath.map(n => getName(n)).join(' → ')}
        </p>
      )}
    </div>
  )
}

// ── Uzum Лист3 enum picker (autocomplete dropdown) ──────────────────────────

function validateSizeClient(v: string): string | null {
  const trimmed = v.trim()
  if (!trimmed) return null
  if (/^\d+\s*[-–]\s*\d+$/.test(trimmed)) {
    return 'Размерный диапазон недопустим — создайте отдельный вариант для каждого размера'
  }
  if (/^\d+([.,]\d+)?$/.test(trimmed)) {
    return 'Укажите размер в формате из списка, например: «Мужской размер обуви EUR:42»'
  }
  return null
}

function UzumEnumPicker({
  field,
  value,
  onChange,
  label,
  badges,
  placeholder,
  disabled,
}: {
  field: 'colors' | 'sizes' | 'brands' | 'countries'
  value: string
  onChange: (v: string) => void
  label: string
  badges?: React.ReactNode
  placeholder?: string
  disabled?: boolean
}) {
  const [query, setQuery] = useState('')
  const [options, setOptions] = useState<string[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const sizeError = useMemo(() => field === 'sizes' ? validateSizeClient(value) : null, [field, value])

  const fetchOptions = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ field, q })
        const res = await fetch(`/api/products/uzum-enums?${params}`)
        if (res.ok) {
          const data = await res.json()
          setOptions(data.values ?? [])
        }
      } catch { /* ignore */ }
      setLoading(false)
    }, 200)
  }, [field])

  useEffect(() => {
    if (open) fetchOptions(query)
  }, [open, query, fetchOptions])

  const error = field === 'sizes' ? sizeError : null

  return (
    <div ref={ref} className="relative">
      <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-dim)' }}>
        {label}{badges}
      </label>
      <div className="relative">
        <input
          type="text"
          value={open ? query : value}
          onChange={e => { setQuery(e.target.value); if (!open) setOpen(true) }}
          onFocus={() => { setOpen(true); setQuery(value) }}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full px-3 py-2 pr-8 rounded-xl border text-sm transition-colors focus:outline-none focus:ring-2 disabled:opacity-40"
          style={{
            background: 'var(--bg-input)',
            borderColor: error ? '#ef4444' : 'var(--border)',
            color: 'var(--text-base)',
            // @ts-expect-error CSS custom property
            '--tw-ring-color': 'var(--c1)',
          }}
        />
        {loading ? (
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 border-2 rounded-full animate-spin"
            style={{ borderColor: 'var(--border)', borderTopColor: 'var(--c1)' }} />
        ) : (
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
        )}
      </div>
      {error && <p className="text-xs mt-1" style={{ color: '#ef4444' }}>{error}</p>}
      {open && !disabled && (
        <div
          className="absolute z-30 left-0 right-0 mt-1 rounded-xl border shadow-lg max-h-60 overflow-y-auto"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
        >
          {options.length === 0 && !loading && (
            <p className="px-3 py-2 text-sm" style={{ color: 'var(--text-muted)' }}>
              {field === 'brands' && query.length < 2
                ? 'Введите минимум 2 символа'
                : 'Не найдено'}
            </p>
          )}
          {options.map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => { onChange(opt); setOpen(false); setQuery('') }}
              className="w-full text-left px-3 py-2 text-sm hover:opacity-80 transition-colors border-b last:border-b-0"
              style={{
                color: 'var(--text-base)',
                borderColor: 'var(--border)',
                background: value === opt ? 'var(--c1-alpha, rgba(99,102,241,0.08))' : undefined,
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Marketplace badge ────────────────────────────────────────────────────────

function MpBadge({ req }: { req?: boolean }) {
  return (
    <span
      className="inline-flex items-center text-[10px] font-bold leading-none px-1.5 py-[3px] rounded-[4px] uppercase tracking-wide select-none"
      style={{ background: '#7B68EE', color: '#fff' }}
    >
      {req && <span className="mr-[1px]">*</span>}
      UZ
    </span>
  )
}

function MpBadges({ uz, reqUz }: { uz?: boolean; reqUz?: boolean }) {
  return (
    <span className="inline-flex gap-1 ml-1.5 align-middle">
      {uz && <MpBadge req={reqUz} />}
    </span>
  )
}

// ── Reusable section card ────────────────────────────────────────────────────

function SectionCard({
  title,
  children,
  defaultOpen = true,
  badge,
  allowOverflow,
}: {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
  badge?: React.ReactNode
  allowOverflow?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div
      className={`rounded-2xl border ${allowOverflow ? 'overflow-visible' : 'overflow-hidden'}`}
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
    >
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 sm:px-5 py-4 text-left"
        style={{ color: 'var(--text-base)' }}
      >
        <span className="font-semibold text-[15px] flex items-center gap-2">
          {title}
          {badge}
        </span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {open && (
        <div className="px-4 sm:px-5 pb-5 space-y-4 border-t" style={{ borderColor: 'var(--border)' }}>
          <div className="pt-4">{children}</div>
        </div>
      )}
    </div>
  )
}

// ── Input components ─────────────────────────────────────────────────────────

function InputField({
  label,
  value,
  onChange,
  onBlur,
  placeholder,
  type = 'text',
  disabled,
  badges,
  hint,
  error,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  onBlur?: () => void
  placeholder?: string
  type?: string
  disabled?: boolean
  badges?: React.ReactNode
  hint?: string
  error?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-dim)' }}>
        {label}
        {badges}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full px-3 py-2 rounded-xl border text-sm transition-colors focus:outline-none focus:ring-2 disabled:opacity-40"
        style={{
          background: 'var(--bg-input)',
          borderColor: error ? '#ef4444' : 'var(--border)',
          color: 'var(--text-base)',
          // @ts-expect-error CSS custom property
          '--tw-ring-color': 'var(--c1)',
        }}
      />
      {error && <p className="text-xs mt-1" style={{ color: '#ef4444' }}>{error}</p>}
      {!error && hint && <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{hint}</p>}
    </div>
  )
}

function TextAreaField({
  label,
  value,
  onChange,
  onBlur,
  rows = 3,
  placeholder,
  disabled,
  badges,
  hint,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  onBlur?: () => void
  rows?: number
  placeholder?: string
  disabled?: boolean
  badges?: React.ReactNode
  hint?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-dim)' }}>
        {label}
        {badges}
      </label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={onBlur}
        rows={rows}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full px-3 py-2 rounded-xl border text-sm transition-colors focus:outline-none focus:ring-2 resize-y disabled:opacity-40"
        style={{
          background: 'var(--bg-input)',
          borderColor: 'var(--border)',
          color: 'var(--text-base)',
          // @ts-expect-error CSS custom property
          '--tw-ring-color': 'var(--c1)',
        }}
      />
      {hint && <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{hint}</p>}
    </div>
  )
}

function IkpuSearchField({
  value,
  onChange,
  badges,
  lang,
}: {
  value: string
  onChange: (v: string) => void
  badges?: React.ReactNode
  lang: string
}) {
  const [results, setResults] = useState<IkpuResult[]>([])
  const [matched, setMatched] = useState<IkpuResult | null>(null)
  const [searching, setSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const labels = {
    ru: { label: 'Код ИКПУ', placeholder: 'Введите код или название товара', group: 'Группа', cls: 'Класс', pos: 'Позиция', sub: 'Подпозиция', searching: 'Поиск...', noResults: 'Не найдено', pick: 'Выбрать' },
    uz: { label: 'IKPU kodi', placeholder: 'Kodni yoki mahsulot nomini kiriting', group: 'Guruh', cls: 'Sinf', pos: 'Pozitsiya', sub: 'Quyi pozitsiya', searching: 'Qidirilmoqda...', noResults: 'Topilmadi', pick: 'Tanlash' },
    en: { label: 'IKPU Code', placeholder: 'Enter code or product name', group: 'Group', cls: 'Class', pos: 'Position', sub: 'Sub-position', searching: 'Searching...', noResults: 'Not found', pick: 'Select' },
  }
  const l = labels[lang as keyof typeof labels] ?? labels.en

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); setMatched(null); return }
    setSearching(true)
    const searchLang = lang === 'en' ? 'ru' : lang
    const isBarcode = /^\d{13}$/.test(q.trim())
    try {
      const data = await searchIkpu(q.trim(), { lang: searchLang, barcode: isBarcode })
      setResults(data.results)
      const exact = data.results.find(r => r.mxikCode === q.trim())
      setMatched(exact ?? data.results[0] ?? null)
      if (!exact && data.results.length > 1) setShowDropdown(true)
      else setShowDropdown(false)
    } catch {
      setResults([])
      setMatched(null)
    } finally {
      setSearching(false)
    }
  }, [lang])

  function handleInput(val: string) {
    onChange(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(val), 500)
  }

  function pickResult(r: IkpuResult) {
    onChange(r.mxikCode)
    setMatched(r)
    setShowDropdown(false)
  }

  return (
    <div ref={wrapperRef} className="relative">
      <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-dim)' }}>
        {l.label}
        {badges}
      </label>
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={e => handleInput(e.target.value)}
          onFocus={() => { if (results.length > 1 && !matched) setShowDropdown(true) }}
          placeholder={l.placeholder}
          className="w-full px-3 py-2 pr-9 rounded-xl border text-sm transition-colors focus:outline-none focus:ring-2"
          style={{
            background: 'var(--bg-input)',
            borderColor: matched ? 'rgba(34,197,94,0.5)' : 'var(--border)',
            color: 'var(--text-base)',
            // @ts-expect-error CSS custom property
            '--tw-ring-color': 'var(--c1)',
          }}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {searching
            ? <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--text-muted)', borderTopColor: 'transparent' }} />
            : <Search className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          }
        </div>
      </div>

      {/* Matched category tree */}
      {matched && !showDropdown && (
        <div className="mt-2 px-3 py-2.5 rounded-xl text-xs space-y-0.5"
          style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)' }}>
          <p className="font-semibold mb-1" style={{ color: '#22c55e' }}>
            {matched.mxikCode} — {matched.name}
          </p>
          {matched.groupName && <HierarchyRow label={l.group} value={matched.groupName} indent={0} />}
          {matched.className && <HierarchyRow label={l.cls} value={matched.className} indent={1} />}
          {matched.positionName && <HierarchyRow label={l.pos} value={matched.positionName} indent={2} />}
          {matched.subPositionName && <HierarchyRow label={l.sub} value={matched.subPositionName} indent={3} />}
        </div>
      )}

      {/* Search results dropdown */}
      {showDropdown && results.length > 0 && (
        <div className="absolute z-20 w-full mt-1 max-h-64 overflow-y-auto rounded-xl border shadow-lg"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          {results.slice(0, 8).map(r => (
            <button
              key={r.mxikCode}
              type="button"
              onClick={() => pickResult(r)}
              className="w-full px-3 py-2.5 text-left text-xs hover:brightness-95 transition-colors border-b last:border-b-0"
              style={{ borderColor: 'var(--border)', color: 'var(--text-base)' }}
            >
              <span className="font-mono font-semibold">{r.mxikCode}</span>
              {' — '}
              <span>{r.name}</span>
              <span className="block mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {r.groupName} → {r.className}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function HierarchyRow({ label, value, indent }: { label: string; value: string; indent: number }) {
  return (
    <div className="flex items-start gap-1" style={{ paddingLeft: `${indent * 12}px`, color: 'var(--text-dim)' }}>
      <span style={{ color: 'var(--text-muted)' }}>{indent > 0 ? '└' : '├'}</span>
      <span className="font-medium" style={{ color: '#16a34a' }}>{label}:</span>
      <span style={{ color: '#16a34a' }}>{value}</span>
    </div>
  )
}

function SkipCheck({ checked, onChange, label }: {
  checked: boolean; onChange: (v: boolean) => void; label: string
}) {
  return (
    <label className="inline-flex items-center gap-1.5 cursor-pointer select-none mt-1">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="rounded border accent-[#7B68EE]"
        style={{ borderColor: 'var(--border)' }}
      />
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</span>
    </label>
  )
}

// ── Main form ────────────────────────────────────────────────────────────────

export default function ProductCreateForm() {
  const { lang } = useLang()
  const d = translations[lang].dashboard

  // Basic info
  const [nameRu, setNameRu] = useState('')
  const [nameUz, setNameUz] = useState('')
  const [sku, setSku] = useState('')
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [country, setCountry] = useState('')

  // Uzum skip toggles ("Отсутствует")
  const [brandSkipped, setBrandSkipped] = useState(false)
  const [modelSkipped, setModelSkipped] = useState(false)
  const [countrySkipped, setCountrySkipped] = useState(false)

  // Category — cascading tree pickers
  const [uzumTree, setUzumTree] = useState<CatNode[]>([])
  const [uzumTreeLoading, setUzumTreeLoading] = useState(true)
  const [uzumTreeError, setUzumTreeError] = useState('')
  const [uzumCatPath, setUzumCatPath] = useState<CatNode[]>([])

  const uzumCatName = uzumCatPath.length > 0 ? uzumCatPath[uzumCatPath.length - 1].name : ''

  // Uzum category ID (used for export)
  const uzumCatId = uzumCatPath.length > 0 ? uzumCatPath[uzumCatPath.length - 1].id : null

  // Descriptions
  const [descRu, setDescRu] = useState('')
  const [descUz, setDescUz] = useState('')
  const [shortDescRu, setShortDescRu] = useState('')
  const [shortDescUz, setShortDescUz] = useState('')

  // Media
  const [photoUrls, setPhotoUrls] = useState('')
  const [uploading, setUploading] = useState(false)
  const [variantUploading, setVariantUploading] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const variantFileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  // Pricing & dimensions
  const [sellingPrice, setSellingPrice] = useState('')
  const [oldPrice, setOldPrice] = useState('')

  const priceNotMultipleOf1000 = (val: string) => {
    const n = Number(val)
    return n > 0 && n % 1000 !== 0
  }
  const priceErrorMsg = lang === 'ru' ? 'Цена должна быть кратна 1000 сум' : lang === 'uz' ? "Narx 1000 so'mga karrali bo'lishi kerak" : 'Price must be a multiple of 1000 UZS'
  const sellingPriceError = priceNotMultipleOf1000(sellingPrice) ? priceErrorMsg : undefined
  const oldPriceError = priceNotMultipleOf1000(oldPrice) ? priceErrorMsg : undefined
  const [weightG, setWeightG] = useState('')
  const [heightMm, setHeightMm] = useState('')
  const [widthMm, setWidthMm] = useState('')
  const [lengthMm, setLengthMm] = useState('')
  const [ikpu, setIkpu] = useState('')
  const [ikpuPackCode, setIkpuPackCode] = useState('')
  const [barcode, setBarcode] = useState('')

  // SKU group (Uzum only)
  const [skuGroup, setSkuGroup] = useState('')

  // Variants
  const [variants, setVariants] = useState<Variant[]>([])

  // Export state
  const [downloading, setDownloading] = useState<'uzum' | null>(null)
  // Photo-upload feedback (URL fetch / file-picker failures).
  const [uploadResult, setUploadResult] = useState<{ ok: boolean; message: string } | null>(null)

  // Import state
  const [importResult, setImportResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [importDragOver, setImportDragOver] = useState(false)

  const [saveFlash, setSaveFlash] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [loadFlash, setLoadFlash] = useState(false)

  const collectDraft = useCallback((): FormDraft => ({
    nameRu, nameUz, sku, brand, model, country,
    brandSkipped, modelSkipped, countrySkipped,
    descRu, descUz, shortDescRu, shortDescUz,
    photoUrls, sellingPrice, oldPrice,
    weightG, heightMm, widthMm, lengthMm,
    ikpu, ikpuPackCode, barcode, skuGroup,
    variants,
    uzumCatPathIds: uzumCatPath.map(n => n.id),
  }), [nameRu, nameUz, sku, brand, model, country,
    brandSkipped, modelSkipped, countrySkipped,
    descRu, descUz, shortDescRu, shortDescUz,
    photoUrls, sellingPrice, oldPrice,
    weightG, heightMm, widthMm, lengthMm,
    ikpu, ikpuPackCode, barcode, skuGroup,
    variants, uzumCatPath])

  const handleSave = useCallback(() => {
    saveDraftToLocal(collectDraft())
    setSavedAt(Date.now())
    setSaveFlash(true)
    setTimeout(() => setSaveFlash(false), 2000)
  }, [collectDraft])

  const handleLoadSaved = useCallback(() => {
    const saved = loadSavedDraft()
    if (!saved) return
    setNameRu(saved.nameRu ?? '')
    setNameUz(saved.nameUz ?? '')
    setSku(saved.sku ?? '')
    setBrand(saved.brand ?? '')
    setModel(saved.model ?? '')
    setCountry(saved.country ?? '')
    setBrandSkipped(saved.brandSkipped ?? false)
    setModelSkipped(saved.modelSkipped ?? false)
    setCountrySkipped(saved.countrySkipped ?? false)
    setDescRu(saved.descRu ?? '')
    setDescUz(saved.descUz ?? '')
    setShortDescRu(saved.shortDescRu ?? '')
    setShortDescUz(saved.shortDescUz ?? '')
    setPhotoUrls(saved.photoUrls ?? '')
    setSellingPrice(saved.sellingPrice ?? '')
    setOldPrice(saved.oldPrice ?? '')
    setWeightG(saved.weightG ?? '')
    setHeightMm(saved.heightMm ?? '')
    setWidthMm(saved.widthMm ?? '')
    setLengthMm(saved.lengthMm ?? '')
    setIkpu(saved.ikpu ?? '')
    setIkpuPackCode(saved.ikpuPackCode ?? '')
    setBarcode(saved.barcode ?? '')
    setSkuGroup(saved.skuGroup ?? '')
    if (saved.variants) setVariants(saved.variants)
    if (saved.uzumCatPathIds?.length && uzumTree.length) {
      const path = resolveIdPath(uzumTree, saved.uzumCatPathIds)
      if (path.length) setUzumCatPath(path)
    }
    setSavedAt(saved.savedAt ?? null)
    setLoadFlash(true)
    setTimeout(() => setLoadFlash(false), 2000)
  }, [uzumTree])

  // ── Fetch category trees on mount ──────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    const normalize = (nodes: { id: number; title?: string; name?: string; children?: unknown[] }[]): CatNode[] =>
      nodes.map(n => ({
        id: n.id,
        name: n.title ?? n.name ?? '',
        children: n.children?.length ? normalize(n.children as typeof nodes) : undefined,
      }))

    fetch('/api/products/uzum-categories')
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(data => {
        if (cancelled) return
        const tree = normalize(data.categories ?? [])
        setUzumTree(tree)
      })
      .catch(() => { if (!cancelled) setUzumTreeError('Не удалось загрузить категории Uzum') })
      .finally(() => { if (!cancelled) setUzumTreeLoading(false) })
    return () => { cancelled = true }
  }, [])

  // ── Auto-translate RU↔UZ on blur ──────────────────────────────────────
  const autoTranslate = useAutoTranslate()

  // ── Smart per-marketplace export validation ─────────────────────────────

  const hasInvalidSize = variants.some(v => v.size.trim() && validateSizeClient(v.size) !== null)

  const canExportUzum =
    nameRu.trim() && nameUz.trim()
    && (brand.trim() || brandSkipped)
    && (country.trim() || countrySkipped)
    && uzumCatName.trim()
    && descRu.trim() && descUz.trim()
    && shortDescRu.trim() && shortDescUz.trim()
    && (variants.length > 0 ? variants.every(v => v.photoUrl.trim()) : photoUrls.trim())
    && sellingPrice && oldPrice
    && weightG && heightMm && widthMm && lengthMm
    && ikpu.trim()
    && !hasInvalidSize

  // ── Category tree search helper ─────────────────────────────────────────
  const findCatPath = useCallback((tree: CatNode[], name: string): CatNode[] | null => {
    if (!name) return null
    const target = name.toLowerCase().trim()
    const dfs = (nodes: CatNode[], path: CatNode[]): CatNode[] | null => {
      for (const node of nodes) {
        const cur = [...path, node]
        if (node.name.toLowerCase().trim() === target) return cur
        if (node.children?.length) {
          const found = dfs(node.children, cur)
          if (found) return found
        }
      }
      return null
    }
    return dfs(tree, [])
  }, [])

  // ── File import ─────────────────────────────────────────────────────────

  const handleFileImport = async (file: File) => {
    setImportResult(null)
    try {
      const XLSX = await import('xlsx')
      const data = await file.arrayBuffer()
      const wb = XLSX.read(data, { type: 'array' })

      const ws = wb.Sheets[wb.SheetNames[0]]
      if (!ws) throw new Error('Empty file')

      const allRows: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
      if (allRows.length < 2) throw new Error('No data rows')

      // The Uzum template may carry section groups in row 1, so the header row
      // is located rather than assumed.
      let headerRowIdx = -1
      for (let i = 0; i < Math.min(allRows.length, 4); i++) {
        const rowStrs = allRows[i].map(h => String(h).trim())
        if (rowStrs.some(h => /Название товара RU/i.test(h))) { headerRowIdx = i; break }
      }

      if (headerRowIdx < 0) {
        throw new Error(lang === 'ru' ? 'Неизвестный формат файла' : lang === 'uz' ? "Noma'lum fayl formati" : 'Unknown file format')
      }

      const headers = allRows[headerRowIdx].map(h => String(h).trim())
      const rows = allRows

      const col = (name: RegExp) => headers.findIndex(h => name.test(h))
      const str = (row: string[], idx: number) => (idx >= 0 ? String(row[idx] ?? '').trim() : '')
      const num = (row: string[], idx: number) => {
        const v = idx >= 0 ? Number(row[idx]) : 0
        return isNaN(v) ? 0 : v
      }

      // Skip header row + description row (one desc row follows the headers)
      const startRow = headerRowIdx + 2
      const dataRows = rows.slice(startRow).filter(r => r.some(c => String(c).trim()))
      if (dataRows.length === 0) throw new Error(lang === 'ru' ? 'Нет данных в файле' : 'No data in file')

      const first = dataRows[0]

      const ci = {
        nameRu: col(/^Название товара RU/), sku: col(/^Идентификатор от продавца/),
        nameUz: col(/^Название товара UZ/), skuGroup: col(/^Группировка SKU/),
        catName: col(/^Название категории/), catId: col(/^id категории/),
        brand: col(/^Бренд/), model: col(/^Модель$/), country: col(/^Страна производства/),
        descRu: col(/^Описание товара RU/), descUz: col(/^Описание товара UZ/),
        shortRu: col(/^Краткое описание RU/), shortUz: col(/^Краткое описание UZ/),
        photos: col(/^Ссылки на фото/), barcode: col(/^Штрихкод/), ikpu: col(/^ИКПУ/),
        color: col(/^Цвет/), size: col(/^Размер/),
        price: col(/^Цена продажи/), oldPrice: col(/^Цена до скидки/),
        weight: col(/^Вес/), height: col(/^Высота/), width: col(/^Ширина/), length: col(/^Длина/),
      }
      setNameRu(str(first, ci.nameRu))
      setNameUz(str(first, ci.nameUz))
      setSku(str(first, ci.sku))
      setSkuGroup(str(first, ci.skuGroup))
      setBrand(str(first, ci.brand))
      setModel(str(first, ci.model))
      setCountry(str(first, ci.country))
      const uzCatName = str(first, ci.catName)
      if (uzCatName) {
        const path = findCatPath(uzumTree, uzCatName)
        if (path) setUzumCatPath(path)
      }
      setDescRu(str(first, ci.descRu))
      setDescUz(str(first, ci.descUz))
      setShortDescRu(str(first, ci.shortRu))
      setShortDescUz(str(first, ci.shortUz))
      setPhotoUrls(str(first, ci.photos))
      setBarcode(str(first, ci.barcode))
      setIkpu(str(first, ci.ikpu))
      setSellingPrice(String(num(first, ci.price) || ''))
      setOldPrice(String(num(first, ci.oldPrice) || ''))
      setWeightG(String(num(first, ci.weight) || ''))
      setHeightMm(String(num(first, ci.height) || ''))
      setWidthMm(String(num(first, ci.width) || ''))
      setLengthMm(String(num(first, ci.length) || ''))
      setBrandSkipped(false)
      setModelSkipped(false)
      setCountrySkipped(false)

      const hasVariantData = dataRows.length > 1 || str(first, ci.color) || str(first, ci.size)
      if (hasVariantData) {
        setVariants(dataRows.map(r => ({
          id: uid(),
          color: str(r, ci.color),
          size: str(r, ci.size),
          sku: str(r, ci.sku),
          barcode: str(r, ci.barcode),
          sellingPrice: String(num(r, ci.price) || ''),
          oldPrice: String(num(r, ci.oldPrice) || ''),
          photoUrl: '',
        })))
      }


      const count = dataRows.length
      setImportResult({
        ok: true,
        message: lang === 'ru'
          ? `Uzum: загружено ${count} строк(и)`
          : lang === 'uz'
          ? `Uzum: ${count} qator yuklandi`
          : `Uzum: imported ${count} row(s)`,
      })
    } catch (err) {
      setImportResult({
        ok: false,
        message: err instanceof Error ? err.message : 'Import failed',
      })
    }
  }

  // ── Variant & characteristic helpers ────────────────────────────────────

  const addVariant = () => setVariants(prev => [...prev, EMPTY_VARIANT()])
  const removeVariant = (id: string) => setVariants(prev => prev.filter(v => v.id !== id))
  const updateVariant = (id: string, field: keyof Variant, val: string) =>
    setVariants(prev => prev.map(v => (v.id === id ? { ...v, [field]: val } : v)))


  // ── Build product data for export ───────────────────────────────────────

  const buildProducts = useCallback(() => {

    const base = {
      nameRu: nameRu.trim(),
      nameUz: nameUz.trim(),
      sku: sku.trim(),
      skuGroup: skuGroup.trim() || nameRu.trim(),
      categoryName: uzumCatName || '',
      categoryId: '',
      brand: brandSkipped ? 'Отсутствует бренд' : brand.trim(),
      model: modelSkipped ? '' : model.trim(),
      country: countrySkipped ? 'Отсутствует' : country.trim(),
      descriptionRu: descRu.trim(),
      descriptionUz: descUz.trim(),
      shortDescRu: shortDescRu.trim(),
      shortDescUz: shortDescUz.trim(),
      photoUrls: photoUrls.trim(),
      barcode: barcode.trim(),
      ikpu: ikpu.trim(),
      ikpuPackCode: ikpuPackCode.trim() || undefined,
      sellingPrice: Math.round((Number(sellingPrice) || 0) / 1000) * 1000,
      oldPrice: Math.round((Number(oldPrice) || 0) / 1000) * 1000,
      weightGrams: Number(weightG) || 0,
      heightMm: Number(heightMm) || 0,
      widthMm: Number(widthMm) || 0,
      lengthMm: Number(lengthMm) || 0,
    }

    if (variants.length === 0) return [base]

    return variants.map(v => ({
      ...base,
      sku: v.sku || base.sku,
      color: v.color || undefined,
      size: v.size || undefined,
      barcode: v.barcode || base.barcode,
      sellingPrice: Math.round((Number(v.sellingPrice) || base.sellingPrice) / 1000) * 1000,
      oldPrice: Math.round((Number(v.oldPrice) || base.oldPrice) / 1000) * 1000,
      photoUrls: v.photoUrl.trim() || '',
    }))
  }, [nameRu, nameUz, sku, skuGroup, uzumCatName,
    brand, brandSkipped, model, modelSkipped, country, countrySkipped,
    descRu, descUz, shortDescRu, shortDescUz, photoUrls, barcode, ikpu, ikpuPackCode,
    sellingPrice, oldPrice, weightG, heightMm, widthMm, lengthMm, variants])

  // ── Export & push handlers ──────────────────────────────────────────────

  const doExport = async () => {
    const products = buildProducts()

    const body: Record<string, unknown> = {
      marketplace: 'uzum',
      products,
      uzumCategory: {
        id: uzumCatPath.length > 0 ? String(uzumCatPath[uzumCatPath.length - 1].id) : '',
        name: uzumCatName || '',
        fullPath: uzumCatPath.map(n => n.name).join(' > ') || '',
      },
    }

    const res = await fetch('/api/products/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(await res.text())

    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'uzum-products.xlsm'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const compressImage = (file: File, maxSizeMB = 1, maxDim = 2000): Promise<File> =>
    new Promise((resolve) => {
      if (file.size <= maxSizeMB * 1024 * 1024) { resolve(file); return }
      const img = new window.Image()
      img.onload = () => {
        let { width: w, height: h } = img
        if (w > maxDim || h > maxDim) {
          const scale = maxDim / Math.max(w, h)
          w = Math.round(w * scale); h = Math.round(h * scale)
        }
        const canvas = document.createElement('canvas')
        canvas.width = w; canvas.height = h
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, w, h)
        canvas.toBlob(
          blob => {
            if (blob) {
              resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }))
            } else {
              resolve(file)
            }
          },
          'image/jpeg',
          0.85,
        )
      }
      img.onerror = () => resolve(file)
      img.src = URL.createObjectURL(file)
    })

  const handleImageUpload = async (files: FileList | null) => {
    if (!files?.length) return
    setUploading(true)
    const urls: string[] = []
    for (const file of Array.from(files)) {
      try {
        const compressed = await compressImage(file)
        const fd = new FormData()
        fd.append('image', compressed)
        const res = await fetch('/api/products/upload-image', { method: 'POST', body: fd })
        if (res.ok) {
          const data = await res.json()
          if (data.url) urls.push(data.url)
        }
      } catch { /* skip failed uploads */ }
    }
    if (urls.length > 0) {
      setPhotoUrls(prev => {
        const existing = prev.trim()
        return existing ? `${existing}\n${urls.join('\n')}` : urls.join('\n')
      })
    }
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleVariantImageUpload = async (variantId: string, file: File) => {
    setVariantUploading(variantId)
    try {
      const compressed = await compressImage(file)
      const fd = new FormData()
      fd.append('image', compressed)
      const res = await fetch('/api/products/upload-image', { method: 'POST', body: fd })
      if (res.ok) {
        const data = await res.json()
        if (data.url) {
          updateVariant(variantId, 'photoUrl', data.url)
        } else {
          setUploadResult({ ok: false, message: lang === 'ru' ? 'Ошибка загрузки фото: URL не получен' : 'Photo upload error: no URL returned' })
        }
      } else {
        const err = await res.json().catch(() => ({ error: res.statusText }))
        const detail = err.detail ? ` (${String(err.detail).slice(0, 100)})` : ''
        setUploadResult({ ok: false, message: `${lang === 'ru' ? 'Ошибка загрузки фото' : 'Photo upload error'}: ${err.error || res.statusText}${detail}` })
      }
    } catch (err) {
      setUploadResult({ ok: false, message: `${lang === 'ru' ? 'Ошибка загрузки фото' : 'Photo upload error'}: ${err instanceof Error ? err.message : 'Unknown'}` })
    }
    setVariantUploading(null)
    const ref = variantFileRefs.current[variantId]
    if (ref) ref.value = ''
  }

  const handleExport = async () => {
    setDownloading('uzum')
    try {
      await doExport()
    } catch {
      // silently handled
    } finally {
      setDownloading(null)
    }
  }

  const skipLabel = d.notAvailable ?? (lang === 'ru' ? 'Отсутствует' : lang === 'uz' ? 'Mavjud emas' : 'Not available')

  return (
    <div className="space-y-4 max-w-3xl">
      {/* Back link */}
      <Link
        href="/dashboard/products"
        className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:opacity-80"
        style={{ color: 'var(--c1)' }}
      >
        <ArrowLeft className="w-4 h-4" />
        {d.productsTitle}
      </Link>

      {/* ── Save / Load draft bar ── */}
      <div
        className="sticky top-0 z-20 flex items-center justify-between gap-3 rounded-2xl border px-4 py-3"
        style={{ background: 'var(--bg-card)', borderColor: (saveFlash || loadFlash) ? 'var(--c1)' : 'var(--border)', transition: 'border-color .3s' }}
      >
        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          {savedAt && (
            <>
              <Check className="w-3.5 h-3.5" style={{ color: 'var(--c1)' }} />
              <span>
                {lang === 'ru' ? 'Сохранено' : lang === 'uz' ? 'Saqlandi' : 'Saved'}{' '}
                {new Date(savedAt).toLocaleTimeString(lang === 'ru' ? 'ru-RU' : lang === 'uz' ? 'uz-UZ' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleLoadSaved}
            className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl transition-all"
            style={{
              background: loadFlash ? 'var(--c1)' : 'var(--bg-card2)',
              color: loadFlash ? '#fff' : 'var(--text-base)',
            }}
          >
            {loadFlash ? <Check className="w-4 h-4" /> : <Upload className="w-4 h-4" />}
            {loadFlash
              ? (lang === 'ru' ? 'Загружено!' : lang === 'uz' ? 'Yuklandi!' : 'Loaded!')
              : (lang === 'ru' ? 'Загрузить сохранённое' : lang === 'uz' ? 'Saqlanganni yuklash' : 'Load saved')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl transition-all"
            style={{
              background: saveFlash ? 'var(--c1)' : 'var(--bg-card2)',
              color: saveFlash ? '#fff' : 'var(--text-base)',
            }}
          >
            {saveFlash ? <Check className="w-4 h-4" /> : <Download className="w-4 h-4" />}
            {saveFlash
              ? (lang === 'ru' ? 'Сохранено!' : lang === 'uz' ? 'Saqlandi!' : 'Saved!')
              : (lang === 'ru' ? 'Сохранить данные' : lang === 'uz' ? 'Ma\'lumotlarni saqlash' : 'Save data')}
          </button>
        </div>
      </div>

      {/* ── Import from Excel ── */}
      <div
        className="rounded-2xl border p-4 sm:p-5 transition-colors"
        style={{
          background: importDragOver ? 'var(--c1)08' : 'var(--bg-card)',
          borderColor: importDragOver ? 'var(--c1)' : 'var(--border)',
          borderStyle: importDragOver ? 'dashed' : 'solid',
        }}
        onDragOver={e => { e.preventDefault(); e.stopPropagation(); setImportDragOver(true) }}
        onDragEnter={e => { e.preventDefault(); e.stopPropagation(); setImportDragOver(true) }}
        onDragLeave={e => { e.preventDefault(); e.stopPropagation(); setImportDragOver(false) }}
        onDrop={e => {
          e.preventDefault(); e.stopPropagation(); setImportDragOver(false)
          const file = e.dataTransfer.files?.[0]
          if (file && /\.(xlsx|xlsm)$/i.test(file.name)) {
            handleFileImport(file)
          } else if (file) {
            setImportResult({
              ok: false,
              message: lang === 'ru'
                ? 'Поддерживаются только файлы .xlsx и .xlsm'
                : lang === 'uz'
                ? 'Faqat .xlsx va .xlsm fayllar qo\'llab-quvvatlanadi'
                : 'Only .xlsx and .xlsm files are supported',
            })
          } else {
            setImportResult({
              ok: false,
              message: lang === 'ru'
                ? 'Не удалось получить файл. Сначала сохраните файл на компьютер, затем перетащите его сюда.'
                : lang === 'uz'
                ? "Faylni olib bo'lmadi. Avval faylni kompyuterga saqlang, keyin shu yerga tashlang."
                : 'Could not get the file. Save it to your computer first, then drag it here.',
            })
          }
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="font-semibold text-[15px]" style={{ color: 'var(--text-base)' }}>
              {d.importExcel ?? (lang === 'ru' ? 'Импорт из Excel' : lang === 'uz' ? 'Excel dan import' : 'Import from Excel')}
            </h3>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {lang === 'ru'
                ? 'Перетащите файл сюда или нажмите кнопку (.xlsx / .xlsm)'
                : lang === 'uz'
                ? "Faylni shu yerga tashlang yoki tugmani bosing (.xlsx / .xlsm)"
                : 'Drag file here or click the button (.xlsx / .xlsm)'}
            </p>
          </div>
          <label
            className="inline-flex items-center justify-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl border transition-colors cursor-pointer hover:opacity-80 shrink-0"
            style={{ background: 'var(--bg-card2)', color: 'var(--text-base)', borderColor: 'var(--border)' }}
          >
            <Upload className="w-4 h-4" />
            {d.chooseFile ?? (lang === 'ru' ? 'Выбрать файл' : lang === 'uz' ? 'Faylni tanlash' : 'Choose file')}
            <input
              type="file"
              accept=".xlsx,.xlsm"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0]
                if (f) handleFileImport(f)
                e.target.value = ''
              }}
            />
          </label>
        </div>
        {importDragOver && (
          <div className="flex items-center justify-center gap-2 mt-3 py-4 text-sm font-medium" style={{ color: 'var(--c1)' }}>
            <Download className="w-5 h-5" />
            {lang === 'ru' ? 'Отпустите файл для загрузки' : lang === 'uz' ? 'Faylni yuklash uchun qo\'yib yuboring' : 'Drop file to upload'}
          </div>
        )}
        {importResult && (
          <div
            className="flex items-center gap-2 text-sm mt-3 px-3 py-2 rounded-xl border"
            style={{
              borderColor: importResult.ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)',
              background: importResult.ok ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
              color: importResult.ok ? 'rgb(34,197,94)' : 'rgb(239,68,68)',
            }}
          >
            {importResult.ok ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            {importResult.message}
          </div>
        )}
      </div>

      {/* ── Basic Info ── */}
      <SectionCard title={d.basicInfo} allowOverflow>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InputField
            label={d.nameRu}
            badges={<MpBadges uz reqUz />}
            value={nameRu} onChange={setNameRu}
            onBlur={() => autoTranslate(nameRu, 'ru', 'uz', nameUz, setNameUz)}
            placeholder={d.phNameRu}
          />
          <InputField
            label={d.nameUz}
            badges={<MpBadges uz reqUz />}
            value={nameUz} onChange={setNameUz}
            onBlur={() => autoTranslate(nameUz, 'uz', 'ru', nameRu, setNameRu)}
            placeholder={d.phNameUz}
          />
          <InputField
            label={d.skuId}
            badges={<MpBadges uz />}
            value={sku} onChange={setSku}
            placeholder={d.phSku}
          />
          <div>
            <UzumEnumPicker field="brands"
              label={d.brandLabel}
              badges={<MpBadges uz reqUz />}
              value={brand} onChange={setBrand}
              disabled={brandSkipped}
              placeholder={d.phBrand}
            />
            <SkipCheck checked={brandSkipped} onChange={setBrandSkipped} label={skipLabel} />
          </div>
          <div className="relative">
            <UzumEnumPicker field="countries"
              label={d.countryLabel}
              badges={<MpBadges uz reqUz />}
              value={country}
              onChange={setCountry}
              disabled={countrySkipped}
              placeholder={d.phCountry}
            />
            <SkipCheck checked={countrySkipped} onChange={setCountrySkipped} label={skipLabel} />
          </div>
        </div>
      </SectionCard>

      {/* ── Category ── */}
      <SectionCard title={d.categorySection} allowOverflow>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <CascadingCatPicker
            tree={uzumTree}
            loading={uzumTreeLoading}
            error={uzumTreeError}
            selectedPath={uzumCatPath}
            onSelect={setUzumCatPath}
            label={d.uzumCategory}
            badge={<MpBadges uz reqUz />}
            accentColor="#7B68EE"
          />
        </div>
      </SectionCard>

      {/* ── Descriptions ── */}
      <SectionCard title={d.descriptionSection}>
        <div className="space-y-4">
          <TextAreaField
            label={d.descRu}
            badges={<MpBadges uz reqUz />}
            value={descRu} onChange={setDescRu}
            onBlur={() => autoTranslate(descRu, 'ru', 'uz', descUz, setDescUz)}
            hint={lang === 'ru' ? 'Uzum: до 28 000 симв.' : lang === 'uz' ? 'Uzum: 28 000 belgigacha' : 'Uzum: up to 28,000 chars'}
            placeholder={d.phDescRu}
          />
          <TextAreaField
            label={d.descUz}
            badges={<MpBadges uz reqUz />}
            value={descUz} onChange={setDescUz}
            onBlur={() => autoTranslate(descUz, 'uz', 'ru', descRu, setDescRu)}
            placeholder={d.phDescUz}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextAreaField
              label={d.shortDescRu}
              badges={<MpBadges uz reqUz />}
              value={shortDescRu} onChange={setShortDescRu} rows={2}
              onBlur={() => autoTranslate(shortDescRu, 'ru', 'uz', shortDescUz, setShortDescUz)}
              hint={lang === 'ru' ? 'До 390 символов' : lang === 'uz' ? '390 belgigacha' : 'Up to 390 chars'}
              placeholder={d.phShortDescRu}
            />
            <TextAreaField
              label={d.shortDescUz}
              badges={<MpBadges uz reqUz />}
              value={shortDescUz} onChange={setShortDescUz} rows={2}
              onBlur={() => autoTranslate(shortDescUz, 'uz', 'ru', shortDescRu, setShortDescRu)}
              hint={lang === 'ru' ? 'До 390 символов' : lang === 'uz' ? '390 belgigacha' : 'Up to 390 chars'}
              placeholder={d.phShortDescUz}
            />
          </div>
        </div>
      </SectionCard>

      {/* ── Pricing & Dimensions ── */}
      <SectionCard title={d.pricingSection}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <InputField
            label={d.sellingPrice}
            badges={<MpBadges uz reqUz />}
            type="number" value={sellingPrice} onChange={setSellingPrice}
            placeholder={d.phSellingPrice}
            error={sellingPriceError}
          />
          <InputField
            label={d.oldPriceLabel}
            badges={<MpBadges uz reqUz />}
            type="number" value={oldPrice} onChange={setOldPrice}
            placeholder={d.phOldPrice}
            error={oldPriceError}
          />
          <IkpuSearchField
            value={ikpu} onChange={setIkpu}
            badges={<MpBadges uz reqUz />}
            lang={lang}
          />
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-dim)' }}>
              {d.barcodeLabel}
              <MpBadges uz />
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={barcode}
                onChange={e => setBarcode(e.target.value)}
                placeholder={d.phBarcode}
                className="flex-1 min-w-0 px-3 py-2 rounded-xl border text-sm transition-colors focus:outline-none focus:ring-2"
                style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-base)', '--tw-ring-color': 'var(--c1)' } as React.CSSProperties}
              />
              <button
                type="button"
                onClick={() => setBarcode(generateEAN13())}
                className="shrink-0 px-3 py-2 rounded-xl border text-sm font-medium transition-colors hover:opacity-80"
                style={{ background: 'var(--bg-card2)', borderColor: 'var(--border)', color: 'var(--c1)' }}
                title={lang === 'ru' ? 'Сгенерировать EAN-13' : lang === 'uz' ? 'EAN-13 yaratish' : 'Generate EAN-13'}
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
          <InputField
            label={d.weightG}
            badges={<MpBadges uz reqUz />}
            type="number" value={weightG} onChange={setWeightG}
            placeholder={d.phWeightG}
          />
          <InputField
            label={d.heightMm}
            badges={<MpBadges uz reqUz />}
            type="number" value={heightMm} onChange={setHeightMm}
            placeholder={d.phHeightMm}
          />
          <InputField
            label={d.widthMm}
            badges={<MpBadges uz reqUz />}
            type="number" value={widthMm} onChange={setWidthMm}
            placeholder={d.phWidthMm}
          />
          <InputField
            label={d.lengthMm}
            badges={<MpBadges uz reqUz />}
            type="number" value={lengthMm} onChange={setLengthMm}
            placeholder={d.phLengthMm}
          />
        </div>
      </SectionCard>

      {/* ── Uzum-only fields ── */}
      <SectionCard
        title={d.uzumOnlySection ?? (lang === 'ru' ? 'Поля только для Uzum' : lang === 'uz' ? 'Faqat Uzum uchun maydonlar' : 'Uzum-only fields')}
        badge={<MpBadge />}
        defaultOpen={false}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InputField
            label={d.skuGroupLabel}
            badges={<MpBadges uz reqUz />}
            value={skuGroup} onChange={setSkuGroup}
            placeholder={nameRu || d.phSkuGroup}
          />
          <div>
            <InputField
              label={d.modelLabel}
              badges={<MpBadges uz />}
              value={model} onChange={setModel}
              disabled={modelSkipped}
              placeholder={d.phModel}
            />
            <SkipCheck checked={modelSkipped} onChange={setModelSkipped} label={skipLabel} />
          </div>
        </div>
      </SectionCard>

      {/* ── Variants ── */}
      <SectionCard
        title={d.variantsSection}
        badge={<MpBadges uz />}
        defaultOpen={false}
      >
        {variants.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {lang === 'ru' ? 'Нет вариантов. Один товар будет экспортирован.' :
             lang === 'uz' ? "Variantlar yo'q. Bitta mahsulot eksport qilinadi." :
             'No variants. One product will be exported.'}
          </p>
        ) : (
          <div className="space-y-3">
            {variants.map((v, i) => (
              <div
                key={v.id}
                className="rounded-xl border p-3 sm:p-4 space-y-3"
                style={{ background: 'var(--bg-card2)', borderColor: 'var(--border)' }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium" style={{ color: 'var(--text-dim)' }}>
                    #{i + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeVariant(v.id)}
                    className="text-xs flex items-center gap-1 px-2 py-1 rounded-lg transition-colors hover:bg-red-500/10"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {d.removeVariant}
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <UzumEnumPicker field="colors" label={d.colorLabel} badges={<MpBadges uz />}
                    value={v.color} onChange={val => updateVariant(v.id, 'color', val)}
                    placeholder={d.phColor} />
                  <UzumEnumPicker field="sizes" label={d.sizeLabel} badges={<MpBadges uz />}
                    value={v.size} onChange={val => updateVariant(v.id, 'size', val)}
                    placeholder={d.phSize} />
                  <InputField label={d.skuId} badges={<MpBadges uz />}
                    value={v.sku} onChange={val => updateVariant(v.id, 'sku', val)}
                    placeholder={d.phSku} />
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-dim)' }}>
                      {d.barcodeLabel}
                      <MpBadges uz />
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={v.barcode}
                        onChange={e => updateVariant(v.id, 'barcode', e.target.value)}
                        placeholder={d.phBarcode}
                        className="flex-1 min-w-0 px-3 py-2 rounded-xl border text-sm transition-colors focus:outline-none focus:ring-2"
                        style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-base)', '--tw-ring-color': 'var(--c1)' } as React.CSSProperties}
                      />
                      <button
                        type="button"
                        onClick={() => updateVariant(v.id, 'barcode', generateEAN13())}
                        className="shrink-0 px-3 py-2 rounded-xl border text-sm font-medium transition-colors hover:opacity-80"
                        style={{ background: 'var(--bg-card2)', borderColor: 'var(--border)', color: 'var(--c1)' }}
                        title={lang === 'ru' ? 'Сгенерировать EAN-13' : lang === 'uz' ? 'EAN-13 yaratish' : 'Generate EAN-13'}
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <InputField label={d.sellingPrice} badges={<MpBadges uz />}
                    type="number" value={v.sellingPrice}
                    onChange={val => updateVariant(v.id, 'sellingPrice', val)}
                    placeholder={d.phSellingPrice}
                    error={priceNotMultipleOf1000(v.sellingPrice) ? priceErrorMsg : undefined} />
                  <InputField label={d.oldPriceLabel} badges={<MpBadges uz />}
                    type="number" value={v.oldPrice}
                    onChange={val => updateVariant(v.id, 'oldPrice', val)}
                    placeholder={d.phOldPrice}
                    error={priceNotMultipleOf1000(v.oldPrice) ? priceErrorMsg : undefined} />
                </div>
                {/* Per-variant photo — file input always in DOM for stable ref */}
                <input
                  id={`variant-file-${v.id}`}
                  ref={el => { variantFileRefs.current[v.id] = el }}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0]
                    if (f) handleVariantImageUpload(v.id, f)
                  }}
                />
                <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-dim)' }}>
                    {lang === 'ru' ? `Фото варианта${v.color ? ` (${v.color})` : ''}` :
                     lang === 'uz' ? `Variant rasmi${v.color ? ` (${v.color})` : ''}` :
                     `Variant photo${v.color ? ` (${v.color})` : ''}`}
                    <span className="text-red-500 ml-0.5">*</span>
                  </label>
                  {v.photoUrl ? (
                    <div className="flex items-center gap-3 p-2 rounded-xl border" style={{ borderColor: 'var(--border)', background: 'var(--bg-card2)' }}>
                      <img
                        src={v.photoUrl}
                        alt={v.color || 'variant'}
                        className="w-14 h-14 rounded-lg object-cover border"
                        style={{ borderColor: 'var(--border)' }}
                      />
                      <div className="flex-1 min-w-0">
                        <span className="block text-xs font-medium truncate" style={{ color: 'var(--text-base)' }}>
                          {v.photoUrl.split('/').pop()}
                        </span>
                        <span className="block text-xs mt-0.5" style={{ color: 'var(--c1)' }}>
                          {lang === 'ru' ? 'Фото загружено' : lang === 'uz' ? 'Rasm yuklandi' : 'Photo uploaded'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            const el = variantFileRefs.current[v.id] ?? document.getElementById(`variant-file-${v.id}`) as HTMLInputElement | null
                            el?.click()
                          }}
                          className="text-xs px-2 py-1 rounded-lg transition-colors hover:opacity-80"
                          style={{ color: 'var(--c1)' }}
                          title={lang === 'ru' ? 'Заменить' : 'Replace'}
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => updateVariant(v.id, 'photoUrl', '')}
                          className="text-xs px-2 py-1 rounded-lg transition-colors hover:bg-red-500/10"
                          style={{ color: 'var(--text-muted)' }}
                          title={lang === 'ru' ? 'Удалить' : 'Delete'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          const el = variantFileRefs.current[v.id] ?? document.getElementById(`variant-file-${v.id}`) as HTMLInputElement | null
                          if (!el) {
                            setUploadResult({ ok: false, message: lang === 'ru' ? 'Не удалось открыть выбор файла. Попробуйте вставить ссылку.' : 'Could not open file picker. Try pasting a URL.' })
                            return
                          }
                          el.click()
                        }}
                        disabled={variantUploading === v.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                        style={{
                          background: 'var(--c1)',
                          color: '#fff',
                          opacity: variantUploading === v.id ? 0.6 : 1,
                        }}
                      >
                        {variantUploading === v.id ? (
                          <div className="w-3.5 h-3.5 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />
                        ) : (
                          <Upload className="w-3.5 h-3.5" />
                        )}
                        {variantUploading === v.id
                          ? (lang === 'ru' ? 'Загрузка...' : lang === 'uz' ? 'Yuklanmoqda...' : 'Uploading...')
                          : (lang === 'ru' ? 'Загрузить' : lang === 'uz' ? 'Yuklash' : 'Upload')}
                      </button>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {lang === 'ru' ? 'или вставьте ссылку →' : lang === 'uz' ? "yoki havola qo'ying →" : 'or paste URL →'}
                      </span>
                      <input
                        type="text"
                        value={v.photoUrl}
                        onChange={e => updateVariant(v.id, 'photoUrl', e.target.value)}
                        placeholder="https://..."
                        className="flex-1 min-w-0 px-2 py-1 rounded-lg border text-xs focus:outline-none focus:ring-1"
                        style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-base)', '--tw-ring-color': 'var(--c1)' } as React.CSSProperties}
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={addVariant}
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl border transition-colors hover:opacity-80"
          style={{ color: 'var(--c1)', borderColor: 'var(--border)', background: 'var(--bg-card2)' }}
        >
          <Plus className="w-4 h-4" />
          {d.addVariant}
        </button>
      </SectionCard>

      {/* ── Characteristics (manual, in the seller cabinet) ── */}
      <SectionCard
        title={d.characteristicsSection}
        badge={<MpBadges uz />}
        defaultOpen={false}
      >
        <div
          className="flex items-start gap-3 px-4 py-3 rounded-xl border text-sm"
          style={{ background: 'var(--c1)08', borderColor: 'var(--c1)30', color: 'var(--text-base)' }}
        >
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--c1)' }} />
          <p>
            {lang === 'ru'
              ? 'Характеристики (свойства) товара необходимо заполнить самостоятельно в кабинете продавца на маркетплейсе после загрузки товара. Daromadchi не может помочь с этой задачей, так как характеристики отличаются для каждой категории.'
              : lang === 'uz'
              ? "Mahsulot xususiyatlarini marketplace sotuvchi kabinetida mahsulotni yuklagandan keyin o'zingiz to'ldirishingiz kerak. Daromadchi bu vazifada yordam bera olmaydi, chunki xususiyatlar har bir kategoriya uchun farq qiladi."
              : 'Product characteristics must be filled in manually in the marketplace seller cabinet after uploading the product. Daromadchi cannot help with this task, as characteristics differ for each category.'}
          </p>
        </div>
      </SectionCard>

      {/* ── Uzum Market Export ── */}
      <div
        className="rounded-2xl border p-4 sm:p-5"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-2 mb-3">
          <h3 className="font-semibold text-[15px]" style={{ color: 'var(--text-base)' }}>
            {d.uzumExport ?? 'Uzum Market'}
          </h3>
          <MpBadge />
        </div>
        <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
          {d.uzumExportHint ?? (lang === 'ru'
            ? 'Скачайте Excel-файл и загрузите его в кабинет продавца Uzum'
            : lang === 'uz'
            ? 'Excel faylni yuklab oling va Uzum sotuvchi kabinetiga yuklang'
            : 'Download Excel file and upload it to Uzum seller cabinet')}
        </p>

        {!canExportUzum && (() => {
          const missing: string[] = []
          const add = (cond: string, label: string) => { if (!cond.trim()) missing.push(label) }
          add(nameRu, lang === 'ru' ? 'Название RU' : lang === 'uz' ? 'Nomi RU' : 'Name RU')
          add(nameUz, lang === 'ru' ? 'Название UZ' : lang === 'uz' ? 'Nomi UZ' : 'Name UZ')
          if (!brand.trim() && !brandSkipped) missing.push(lang === 'ru' ? 'Бренд' : 'Brend')
          if (!country.trim() && !countrySkipped) missing.push(lang === 'ru' ? 'Страна' : lang === 'uz' ? 'Mamlakat' : 'Country')
          add(uzumCatName, lang === 'ru' ? 'Категория Uzum' : lang === 'uz' ? 'Uzum kategoriyasi' : 'Uzum category')
          add(descRu, lang === 'ru' ? 'Описание RU' : lang === 'uz' ? 'Tavsif RU' : 'Description RU')
          add(descUz, lang === 'ru' ? 'Описание UZ' : lang === 'uz' ? 'Tavsif UZ' : 'Description UZ')
          add(shortDescRu, lang === 'ru' ? 'Краткое описание RU' : lang === 'uz' ? 'Qisqa tavsif RU' : 'Short desc RU')
          add(shortDescUz, lang === 'ru' ? 'Краткое описание UZ' : lang === 'uz' ? 'Qisqa tavsif UZ' : 'Short desc UZ')
          if (variants.length > 0) {
            const noPhoto = variants.filter(v => !v.photoUrl.trim())
            if (noPhoto.length > 0) {
              const names = noPhoto.map(v => v.color || v.sku || '?').join(', ')
              missing.push(`${lang === 'ru' ? 'Фото вариантов' : lang === 'uz' ? 'Variant rasmlari' : 'Variant photos'}: ${names}`)
            }
          } else {
            add(photoUrls, lang === 'ru' ? 'Фото' : lang === 'uz' ? 'Rasm' : 'Photos')
          }
          add(sellingPrice, lang === 'ru' ? 'Цена продажи' : lang === 'uz' ? 'Sotuv narxi' : 'Selling price')
          add(oldPrice, lang === 'ru' ? 'Старая цена' : lang === 'uz' ? 'Eski narx' : 'Old price')
          add(weightG, lang === 'ru' ? 'Вес' : lang === 'uz' ? "Og'irlik" : 'Weight')
          add(heightMm, lang === 'ru' ? 'Высота' : lang === 'uz' ? 'Balandlik' : 'Height')
          add(widthMm, lang === 'ru' ? 'Ширина' : lang === 'uz' ? 'Kenglik' : 'Width')
          add(lengthMm, lang === 'ru' ? 'Длина' : lang === 'uz' ? 'Uzunlik' : 'Length')
          add(ikpu, 'IKPU')
          if (hasInvalidSize) {
            missing.push(lang === 'ru' ? 'Размер (недопустимый формат — выберите из списка)' : lang === 'uz' ? "O'lcham (noto'g'ri format)" : 'Size (invalid format — pick from list)')
          }
          return (
            <div className="text-sm mb-4 px-3 py-2.5 rounded-xl border"
              style={{ color: 'var(--text-muted)', borderColor: 'rgba(123,104,238,0.2)', background: 'rgba(123,104,238,0.04)' }}>
              <p className="font-medium mb-1" style={{ color: '#7B68EE' }}>
                {lang === 'ru' ? 'Заполните поля:' : lang === 'uz' ? "Maydonlarni to'ldiring:" : 'Fill in fields:'}
              </p>
              <p className="text-xs">{missing.join(', ')}</p>
            </div>
          )
        })()}

        {uploadResult && (
          <div
            className="flex items-center gap-2 text-sm mb-4 px-3 py-2.5 rounded-xl border"
            style={{
              borderColor: uploadResult.ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)',
              background: uploadResult.ok ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
              color: uploadResult.ok ? 'rgb(34,197,94)' : 'rgb(239,68,68)',
            }}
          >
            {uploadResult.ok ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            {uploadResult.message}
          </div>
        )}

        <button
          type="button"
          disabled={!canExportUzum || downloading !== null}
          onClick={handleExport}
          className="inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors disabled:opacity-40"
          style={{
            background: canExportUzum ? '#7B68EE' : 'var(--bg-card2)',
            color: canExportUzum ? '#fff' : 'var(--text-muted)',
          }}
        >
          <FileSpreadsheet className="w-4 h-4" />
          {downloading === 'uzum' ? d.downloading : d.exportUzum}
        </button>
      </div>
    </div>
  )
}
