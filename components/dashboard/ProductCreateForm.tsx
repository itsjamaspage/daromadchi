'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import {
  Plus, Trash2, Download, FileSpreadsheet, Send, Upload,
  ChevronDown, ChevronUp, ArrowLeft, Check, AlertCircle, Search,
} from 'lucide-react'
import Link from 'next/link'
import { useLang } from '@/app/providers'
import { translations } from '@/lib/i18n'
import { useAutoTranslate } from '@/hooks/useAutoTranslate'
import { searchDirect } from '@/lib/ikpu/browser-search'
import type { IkpuResult } from '@/lib/ikpu/client'

interface Variant {
  id: string
  color: string
  size: string
  sku: string
  barcode: string
  sellingPrice: string
  oldPrice: string
}

interface Characteristic {
  id: string
  name: string
  value: string
}

const uid = () => Math.random().toString(36).slice(2, 9)

const EMPTY_VARIANT = (): Variant => ({
  id: uid(),
  color: '',
  size: '',
  sku: '',
  barcode: '',
  sellingPrice: '',
  oldPrice: '',
})

// ── Marketplace badge ────────────────────────────────────────────────────────

function MpBadge({ mp, req }: { mp: 'uz' | 'ym'; req?: boolean }) {
  const bg = mp === 'uz' ? '#7B68EE' : '#FC3F1D'
  return (
    <span
      className="inline-flex items-center text-[10px] font-bold leading-none px-1.5 py-[3px] rounded-[4px] uppercase tracking-wide select-none"
      style={{ background: bg, color: '#fff' }}
    >
      {req && <span className="mr-[1px]">*</span>}
      {mp === 'uz' ? 'UZ' : 'YM'}
    </span>
  )
}

function MpBadges({ uz, ym, reqUz, reqYm }: {
  uz?: boolean; ym?: boolean; reqUz?: boolean; reqYm?: boolean
}) {
  return (
    <span className="inline-flex gap-1 ml-1.5 align-middle">
      {uz && <MpBadge mp="uz" req={reqUz} />}
      {ym && <MpBadge mp="ym" req={reqYm} />}
    </span>
  )
}

// ── Reusable section card ────────────────────────────────────────────────────

function SectionCard({
  title,
  children,
  defaultOpen = true,
  badge,
}: {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
  badge?: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div
      className="rounded-2xl border overflow-hidden"
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
    const isCode = /^\d{5,}$/.test(q.trim())
    try {
      const data = await searchDirect(q.trim(), { lang: searchLang, barcode: false })
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

  // Category
  const [uzumCatName, setUzumCatName] = useState('')
  const [yandexCatName, setYandexCatName] = useState('')
  const [yandexCatId, setYandexCatId] = useState<number | null>(null)
  const [yandexCatSearch, setYandexCatSearch] = useState('')
  const [yandexCatResults, setYandexCatResults] = useState<{ id: number; name: string; path: string }[]>([])
  const [yandexCatLoading, setYandexCatLoading] = useState(false)
  const [yandexCatOpen, setYandexCatOpen] = useState(false)
  const [yandexCatError, setYandexCatError] = useState('')
  const yandexCatRef = useRef<HTMLDivElement>(null)

  // Category parameters (fetched from Yandex when category is selected)
  const [categoryParams, setCategoryParams] = useState<{
    id: number; name: string; type: string; required?: boolean;
    values?: { id: number; value: string }[]
  }[]>([])
  const [categoryParamsLoading, setCategoryParamsLoading] = useState(false)

  // Descriptions
  const [descRu, setDescRu] = useState('')
  const [descUz, setDescUz] = useState('')
  const [shortDescRu, setShortDescRu] = useState('')
  const [shortDescUz, setShortDescUz] = useState('')

  // Media
  const [photoUrls, setPhotoUrls] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Pricing & dimensions
  const [sellingPrice, setSellingPrice] = useState('')
  const [oldPrice, setOldPrice] = useState('')
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

  // Characteristics (Yandex)
  const [chars, setChars] = useState<Characteristic[]>([])

  // Export state
  const [downloading, setDownloading] = useState<'uzum' | 'yandex' | 'both' | null>(null)
  const [pushing, setPushing] = useState(false)
  const [pushResult, setPushResult] = useState<{ ok: boolean; message: string } | null>(null)

  // Import state
  const [importResult, setImportResult] = useState<{ ok: boolean; message: string } | null>(null)

  // ── Yandex category search ────────────────────────────────────────────
  useEffect(() => {
    if (!yandexCatSearch.trim() || yandexCatSearch.length < 2) {
      return () => { setYandexCatResults([]); setYandexCatError('') }
    }
    const timer = setTimeout(async () => {
      setYandexCatLoading(true)
      setYandexCatError('')
      try {
        const res = await fetch('/api/products/yandex-categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: yandexCatSearch }),
        })
        if (res.ok) {
          const data = await res.json()
          const cats = data.categories ?? []
          setYandexCatResults(cats)
          if (cats.length > 0) setYandexCatOpen(true)
          else setYandexCatError(lang === 'ru' ? 'Категории не найдены' : lang === 'uz' ? 'Kategoriya topilmadi' : 'No categories found')
        } else {
          const err = await res.json().catch(() => ({}))
          setYandexCatError(err.error || (lang === 'ru' ? 'Ошибка поиска категорий' : 'Category search error'))
        }
      } catch {
        setYandexCatError(lang === 'ru' ? 'Не удалось загрузить категории' : 'Failed to load categories')
      }
      finally { setYandexCatLoading(false) }
    }, 400)
    return () => clearTimeout(timer)
  }, [yandexCatSearch, lang])

  // Close category dropdown on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (yandexCatRef.current && !yandexCatRef.current.contains(e.target as Node)) setYandexCatOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  // Fetch category parameters when category is selected
  useEffect(() => {
    if (!yandexCatId) {
      return () => { setCategoryParams([]) }
    }
    let cancelled = false
    const load = async () => {
      setCategoryParamsLoading(true)
      try {
        const res = await fetch('/api/products/yandex-category-params', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ categoryId: yandexCatId }),
        })
        const data = res.ok ? await res.json() : null
        if (!cancelled && data?.parameters) {
          setCategoryParams(data.parameters)
          const required = data.parameters.filter((p: { required?: boolean }) => p.required)
          setChars(prev => {
            const existing = new Set(prev.map(c => c.name.trim().toLowerCase()))
            const toAdd = required
              .filter((p: { name: string }) => !existing.has(p.name.toLowerCase()))
              .map((p: { name: string }) => ({ id: uid(), name: p.name, value: '' }))
            return toAdd.length > 0 ? [...prev, ...toAdd] : prev
          })
        }
      } catch { /* ignore */ }
      finally { if (!cancelled) setCategoryParamsLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [yandexCatId])

  // ── Auto-translate RU↔UZ on blur ──────────────────────────────────────
  const autoTranslate = useAutoTranslate()

  // ── Smart per-marketplace export validation ─────────────────────────────

  const canExportUzum =
    nameRu.trim() && nameUz.trim()
    && (brand.trim() || brandSkipped)
    && (country.trim() || countrySkipped)
    && uzumCatName.trim()
    && descRu.trim() && descUz.trim()
    && shortDescRu.trim() && shortDescUz.trim()
    && photoUrls.trim()
    && sellingPrice && oldPrice
    && weightG && heightMm && widthMm && lengthMm
    && ikpu.trim()

  const canExportYandex =
    nameRu.trim() && nameUz.trim()
    && sku.trim()
    && (brand.trim() || brandSkipped)
    && yandexCatName.trim()
    && descRu.trim() && descUz.trim()
    && photoUrls.trim()
    && sellingPrice
    && barcode.trim()
    && weightG && heightMm && widthMm && lengthMm
    && ikpu.trim()

  // ── File import ─────────────────────────────────────────────────────────

  const handleFileImport = async (file: File) => {
    setImportResult(null)
    try {
      const XLSX = await import('xlsx')
      const data = await file.arrayBuffer()
      const wb = XLSX.read(data, { type: 'array' })

      // Find the right sheet — real Yandex template uses "Список товаров", others use first sheet
      const productSheetName = wb.SheetNames.find(n => n === 'Список товаров') || wb.SheetNames[0]
      const ws = wb.Sheets[productSheetName]
      if (!ws) throw new Error('Empty file')

      const allRows: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
      if (allRows.length < 2) throw new Error('No data rows')

      // Detect format: real Yandex template has headers in row 2 (section groups in row 1)
      let headerRowIdx = 0
      let isUzum = false
      let isYandex = false
      for (let i = 0; i < Math.min(allRows.length, 4); i++) {
        const rowStrs = allRows[i].map(h => String(h).trim())
        if (rowStrs.some(h => /Название товара RU/i.test(h))) { headerRowIdx = i; isUzum = true; break }
        if (rowStrs.some(h => /Ваш SKU/i.test(h))) { headerRowIdx = i; isYandex = true; break }
      }

      if (!isUzum && !isYandex) {
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

      // Skip header row + description row (both formats have one desc row after headers)
      const startRow = headerRowIdx + 2
      const dataRows = rows.slice(startRow).filter(r => r.some(c => String(c).trim()))
      if (dataRows.length === 0) throw new Error(lang === 'ru' ? 'Нет данных в файле' : 'No data in file')

      const first = dataRows[0]

      if (isUzum) {
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
        setUzumCatName(str(first, ci.catName))
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

        if (dataRows.length > 1) {
          setVariants(dataRows.slice(1).map(r => ({
            id: uid(),
            color: str(r, ci.color),
            size: str(r, ci.size),
            sku: str(r, ci.sku),
            barcode: str(r, ci.barcode),
            sellingPrice: String(num(r, ci.price) || ''),
            oldPrice: String(num(r, ci.oldPrice) || ''),
          })))
        }
      } else {
        const ci = {
          sku: col(/^Ваш SKU/), name: col(/^Название товара/), photos: col(/^Ссылка на изображение/),
          desc: col(/^Описание товара/), cat: col(/^Категория на Маркете/), brand: col(/^Бренд/),
          barcode: col(/^Штрихкод/), country: col(/^Страна производства/),
          nameUz: col(/^Название на узбекском/), descUz: col(/^Описание на узбекском/),
          weight: col(/^Вес/), length: col(/^Длина/), width: col(/^Ширина/), height: col(/^Высота/),
          price: col(/^Цена /), oldPrice: col(/^Зачёркнутая цена/),
          ikpu: col(/^ИКПУ/), ikpuPackCode: col(/^Код упаковки/), chars: col(/^Характеристики/),
        }
        setNameRu(str(first, ci.name))
        setSku(str(first, ci.sku))
        setPhotoUrls(str(first, ci.photos))
        setDescRu(str(first, ci.desc))
        setYandexCatName(str(first, ci.cat))
        setBrand(str(first, ci.brand))
        setBarcode(str(first, ci.barcode))
        setCountry(str(first, ci.country))
        setNameUz(str(first, ci.nameUz))
        setDescUz(str(first, ci.descUz))
        setIkpu(str(first, ci.ikpu))
        setIkpuPackCode(str(first, ci.ikpuPackCode))
        setSellingPrice(String(num(first, ci.price) || ''))
        setOldPrice(String(num(first, ci.oldPrice) || ''))

        const wKg = num(first, ci.weight)
        if (wKg) setWeightG(String(Math.round(wKg * 1000)))
        const lCm = num(first, ci.length)
        if (lCm) setLengthMm(String(Math.round(lCm * 10)))
        const wCm = num(first, ci.width)
        if (wCm) setWidthMm(String(Math.round(wCm * 10)))
        const hCm = num(first, ci.height)
        if (hCm) setHeightMm(String(Math.round(hCm * 10)))

        const charStr = str(first, ci.chars)
        if (charStr) {
          setChars(charStr.split(';').filter(Boolean).map(pair => {
            const [name, value] = pair.split('|')
            return { id: uid(), name: name?.trim() || '', value: value?.trim() || '' }
          }))
        }

        if (dataRows.length > 1) {
          setVariants(dataRows.slice(1).map(r => {
            const varSku = str(r, ci.sku)
            const existing = variants.find(v => v.sku === varSku)
            return {
              id: uid(),
              color: existing?.color || '',
              size: existing?.size || '',
              sku: varSku,
              barcode: str(r, ci.barcode),
              sellingPrice: String(num(r, ci.price) || ''),
              oldPrice: String(num(r, ci.oldPrice) || ''),
            }
          }))
        }
      }

      const format = isUzum ? 'Uzum' : 'Yandex'
      const count = dataRows.length
      setImportResult({
        ok: true,
        message: lang === 'ru'
          ? `${format}: загружено ${count} строк(и)`
          : lang === 'uz'
          ? `${format}: ${count} qator yuklandi`
          : `${format}: imported ${count} row(s)`,
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

  const addChar = () => setChars(prev => [...prev, { id: uid(), name: '', value: '' }])
  const removeChar = (id: string) => setChars(prev => prev.filter(c => c.id !== id))
  const updateChar = (id: string, field: 'name' | 'value', val: string) =>
    setChars(prev => prev.map(c => (c.id === id ? { ...c, [field]: val } : c)))

  // ── Build product data for export ───────────────────────────────────────

  const buildProducts = useCallback(() => {
    const charsRecord: Record<string, string> = {}
    for (const c of chars) {
      if (c.name.trim() && c.value.trim()) charsRecord[c.name.trim()] = c.value.trim()
    }

    const base = {
      nameRu: nameRu.trim(),
      nameUz: nameUz.trim(),
      sku: sku.trim(),
      skuGroup: skuGroup.trim() || nameRu.trim(),
      categoryName: uzumCatName || yandexCatName || '',
      categoryId: '',
      brand: brandSkipped ? '' : brand.trim(),
      model: modelSkipped ? '' : model.trim(),
      country: countrySkipped ? '' : country.trim(),
      descriptionRu: descRu.trim(),
      descriptionUz: descUz.trim(),
      shortDescRu: shortDescRu.trim(),
      shortDescUz: shortDescUz.trim(),
      photoUrls: photoUrls.trim(),
      barcode: barcode.trim(),
      ikpu: ikpu.trim(),
      ikpuPackCode: ikpuPackCode.trim() || undefined,
      sellingPrice: Number(sellingPrice) || 0,
      oldPrice: Number(oldPrice) || 0,
      weightGrams: Number(weightG) || 0,
      heightMm: Number(heightMm) || 0,
      widthMm: Number(widthMm) || 0,
      lengthMm: Number(lengthMm) || 0,
      characteristics: Object.keys(charsRecord).length > 0 ? charsRecord : undefined,
    }

    if (variants.length === 0) return [base]

    return variants.map(v => ({
      ...base,
      sku: v.sku || base.sku,
      color: v.color || undefined,
      size: v.size || undefined,
      barcode: v.barcode || base.barcode,
      sellingPrice: Number(v.sellingPrice) || base.sellingPrice,
      oldPrice: Number(v.oldPrice) || base.oldPrice,
    }))
  }, [nameRu, nameUz, sku, skuGroup, uzumCatName, yandexCatName,
    brand, brandSkipped, model, modelSkipped, country, countrySkipped,
    descRu, descUz, shortDescRu, shortDescUz, photoUrls, barcode, ikpu, ikpuPackCode,
    sellingPrice, oldPrice, weightG, heightMm, widthMm, lengthMm, chars, variants])

  // ── Export & push handlers ──────────────────────────────────────────────

  const doExport = async (marketplace: 'uzum' | 'yandex') => {
    const products = buildProducts()

    const body: Record<string, unknown> = { marketplace, products }
    if (marketplace === 'uzum') {
      body.uzumCategory = {
        id: '',
        name: uzumCatName || '',
        fullPath: uzumCatName || '',
      }
    } else {
      body.yandexCategoryName = yandexCatName || 'Не указана'
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
    a.download = `${marketplace}-products.xlsx`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  // Map form characteristics → Yandex parameterValues using fetched category params
  const buildParameterValues = (p: ReturnType<typeof buildProducts>[0]) => {
    if (!categoryParams.length || !p.characteristics) return undefined
    const vals: { parameterId: number; valueId?: number; value?: string }[] = []
    for (const param of categoryParams) {
      const charValue = p.characteristics[param.name]
      if (!charValue) continue
      if (param.type === 'ENUM' && param.values?.length) {
        const match = param.values.find(v => v.value.toLowerCase() === charValue.toLowerCase())
        if (match) {
          vals.push({ parameterId: param.id, valueId: match.id })
        } else {
          vals.push({ parameterId: param.id, value: charValue })
        }
      } else {
        vals.push({ parameterId: param.id, value: charValue })
      }
    }
    return vals.length > 0 ? vals : undefined
  }

  const handleImageUpload = async (files: FileList | null) => {
    if (!files?.length) return
    setUploading(true)
    const urls: string[] = []
    for (const file of Array.from(files)) {
      try {
        const fd = new FormData()
        fd.append('image', file)
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

  const handleExport = async (target: 'uzum' | 'yandex' | 'both') => {
    setDownloading(target)
    try {
      if (target === 'both') {
        await doExport('uzum')
        await doExport('yandex')
      } else {
        await doExport(target)
      }
    } catch {
      // silently handled
    } finally {
      setDownloading(null)
    }
  }

  const handleYandexPush = async () => {
    setPushing(true)
    setPushResult(null)
    try {
      const products = buildProducts()
      const offers = products.map(p => ({
        offerId: p.sku || `new-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: p.nameUz || p.nameRu,
        category: yandexCatName || undefined,
        marketCategoryId: yandexCatId || undefined,
        vendor: p.brand || undefined,
        description: p.descriptionUz || p.descriptionRu || undefined,
        pictures: p.photoUrls ? p.photoUrls.split(/[\n,]+/).map(u => u.trim()).filter(Boolean) : undefined,
        barcodes: p.barcode ? [p.barcode] : undefined,
        manufacturerCountries: p.country ? [p.country] : undefined,
        weightDimensions: (p.weightGrams && p.lengthMm && p.widthMm && p.heightMm) ? {
          weight: p.weightGrams / 1000,
          length: p.lengthMm / 10,
          width: p.widthMm / 10,
          height: p.heightMm / 10,
        } : undefined,
        basicPrice: p.sellingPrice ? {
          value: p.sellingPrice,
          currencyId: 'UZS',
          discountBase: p.oldPrice || undefined,
        } : undefined,
        commodityCodes: p.ikpu ? [{ code: p.ikpu, type: 'IKPU_CODE' as const }] : undefined,
        parameterValues: buildParameterValues(p),
      }))

      const res = await fetch('/api/products/yandex-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offers }),
      })

      if (res.ok) {
        setPushResult({
          ok: true,
          message: lang === 'ru'
            ? `${offers.length} товар(ов) отправлено в Yandex Market`
            : lang === 'uz'
            ? `${offers.length} ta mahsulot Yandex Market ga yuborildi`
            : `${offers.length} product(s) pushed to Yandex Market`,
        })
      } else {
        const data = await res.json().catch(() => ({ error: res.statusText }))
        setPushResult({
          ok: false,
          message: data.error || `HTTP ${res.status}`,
        })
      }
    } catch (err) {
      setPushResult({
        ok: false,
        message: err instanceof Error ? err.message : 'Unknown error',
      })
    } finally {
      setPushing(false)
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

      {/* ── Import from Excel ── */}
      <div
        className="rounded-2xl border p-4 sm:p-5"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="font-semibold text-[15px]" style={{ color: 'var(--text-base)' }}>
              {d.importExcel ?? (lang === 'ru' ? 'Импорт из Excel' : lang === 'uz' ? 'Excel dan import' : 'Import from Excel')}
            </h3>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {lang === 'ru'
                ? 'Загрузите свой файл Uzum или Yandex (.xlsx / .xlsm) — данные заполнят форму автоматически'
                : lang === 'uz'
                ? "Uzum yoki Yandex faylingizni yuklang (.xlsx / .xlsm) — ma'lumotlar avtomatik to'ldiriladi"
                : 'Upload your Uzum or Yandex file (.xlsx / .xlsm) — data will fill the form automatically'}
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
      <SectionCard title={d.basicInfo}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InputField
            label={d.nameRu}
            badges={<MpBadges uz ym reqUz reqYm />}
            value={nameRu} onChange={setNameRu}
            onBlur={() => autoTranslate(nameRu, 'ru', 'uz', nameUz, setNameUz)}
            placeholder={d.phNameRu}
          />
          <InputField
            label={d.nameUz}
            badges={<MpBadges uz ym reqUz reqYm />}
            value={nameUz} onChange={setNameUz}
            onBlur={() => autoTranslate(nameUz, 'uz', 'ru', nameRu, setNameRu)}
            placeholder={d.phNameUz}
          />
          <InputField
            label={d.skuId}
            badges={<MpBadges uz ym reqYm />}
            value={sku} onChange={setSku}
            placeholder={d.phSku}
          />
          <div>
            <InputField
              label={d.brandLabel}
              badges={<MpBadges uz ym reqUz />}
              value={brand} onChange={setBrand}
              disabled={brandSkipped}
              placeholder={d.phBrand}
            />
            <SkipCheck checked={brandSkipped} onChange={setBrandSkipped} label={skipLabel} />
          </div>
          <div>
            <InputField
              label={d.countryLabel}
              badges={<MpBadges uz ym reqUz reqYm />}
              value={country} onChange={setCountry}
              disabled={countrySkipped}
              placeholder={d.phCountry}
            />
            <SkipCheck checked={countrySkipped} onChange={setCountrySkipped} label={skipLabel} />
          </div>
        </div>
      </SectionCard>

      {/* ── Category ── */}
      <SectionCard title={d.categorySection}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InputField
            label={d.uzumCategory}
            badges={<MpBadges uz reqUz />}
            value={uzumCatName} onChange={setUzumCatName}
            placeholder={d.phUzumCategory}
          />
          <div ref={yandexCatRef} className="relative">
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-dim)' }}>
              {d.yandexCategory}
              <MpBadges ym reqYm />
            </label>
            <div className="relative">
              <input
                type="text"
                value={yandexCatId ? yandexCatName : yandexCatSearch}
                onChange={e => {
                  if (yandexCatId) { setYandexCatId(null); setYandexCatName('') }
                  setYandexCatSearch(e.target.value)
                }}
                onFocus={() => { if (yandexCatResults.length) setYandexCatOpen(true) }}
                placeholder={lang === 'ru' ? 'Поиск категории...' : lang === 'uz' ? 'Kategoriya qidirish...' : 'Search category...'}
                className="w-full px-3 py-2 rounded-xl border text-sm transition-colors focus:outline-none focus:ring-2"
                style={{
                  background: 'var(--bg-input)',
                  borderColor: yandexCatId ? 'var(--c1)' : 'var(--border)',
                  color: 'var(--text-base)',
                  // @ts-expect-error CSS custom property
                  '--tw-ring-color': 'var(--c1)',
                }}
              />
              {yandexCatLoading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--c1)' }} />
                </div>
              )}
              {yandexCatId && !yandexCatLoading && (
                <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--c1)' }} />
              )}
            </div>
            {yandexCatId && (
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                ID: {yandexCatId}
                {categoryParamsLoading ? ' — загрузка параметров...' : categoryParams.length > 0 ? ` — ${categoryParams.filter(p => p.required).length} обязательных параметров` : ''}
              </p>
            )}
            {!yandexCatId && !yandexCatLoading && yandexCatError && (
              <p className="text-xs mt-1" style={{ color: '#FC3F1D' }}>{yandexCatError}</p>
            )}
            {!yandexCatId && !yandexCatLoading && !yandexCatError && yandexCatSearch.length >= 2 && yandexCatResults.length > 0 && !yandexCatOpen && (
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                {lang === 'ru' ? 'Нажмите на поле чтобы выбрать категорию из списка' : lang === 'uz' ? "Ro'yxatdan kategoriya tanlash uchun bosing" : 'Click the field to select a category'}
              </p>
            )}
            {!yandexCatId && !yandexCatLoading && !yandexCatError && !yandexCatSearch.trim() && (
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                {lang === 'ru' ? 'Введите название и выберите из списка' : lang === 'uz' ? "Nomini yozing va ro'yxatdan tanlang" : 'Type a name and select from the list'}
              </p>
            )}
            {yandexCatOpen && yandexCatResults.length > 0 && (
              <div
                className="absolute z-30 left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-xl border shadow-lg"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
              >
                {yandexCatResults.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setYandexCatName(c.name)
                      setYandexCatId(c.id)
                      setYandexCatSearch('')
                      setYandexCatOpen(false)
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:opacity-80 transition-colors border-b last:border-b-0"
                    style={{ color: 'var(--text-base)', borderColor: 'var(--border)' }}
                  >
                    <span className="font-medium">{c.name}</span>
                    <span className="block text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{c.path}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </SectionCard>

      {/* ── Descriptions ── */}
      <SectionCard title={d.descriptionSection}>
        <div className="space-y-4">
          <TextAreaField
            label={d.descRu}
            badges={<MpBadges uz ym reqUz reqYm />}
            value={descRu} onChange={setDescRu}
            onBlur={() => autoTranslate(descRu, 'ru', 'uz', descUz, setDescUz)}
            hint={lang === 'ru' ? 'Uzum: до 28 000 симв. · Yandex: до 6 000 симв.' : lang === 'uz' ? 'Uzum: 28 000 belgigacha · Yandex: 6 000 belgigacha' : 'Uzum: up to 28,000 chars · Yandex: up to 6,000 chars'}
            placeholder={d.phDescRu}
          />
          <TextAreaField
            label={d.descUz}
            badges={<MpBadges uz ym reqUz reqYm />}
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

      {/* ── Media ── */}
      <SectionCard title={d.mediaSection}>
        <TextAreaField
          label={d.photoUrls}
          badges={<MpBadges uz ym reqUz reqYm />}
          value={photoUrls} onChange={setPhotoUrls} rows={2}
          placeholder={d.phPhotoUrls}
        />
        <div className="flex items-center gap-3 mt-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={e => handleImageUpload(e.target.files)}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            style={{
              background: 'var(--c1)',
              color: '#fff',
              opacity: uploading ? 0.6 : 1,
            }}
          >
            {uploading ? (
              <>
                <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />
                {lang === 'ru' ? 'Загрузка...' : lang === 'uz' ? 'Yuklanmoqda...' : 'Uploading...'}
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                {lang === 'ru' ? 'Загрузить фото' : lang === 'uz' ? 'Rasm yuklash' : 'Upload photos'}
              </>
            )}
          </button>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{d.photoUrlsHint}</p>
        </div>
      </SectionCard>

      {/* ── Pricing & Dimensions ── */}
      <SectionCard title={d.pricingSection}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <InputField
            label={d.sellingPrice}
            badges={<MpBadges uz ym reqUz reqYm />}
            type="number" value={sellingPrice} onChange={setSellingPrice}
            placeholder={d.phSellingPrice}
          />
          <InputField
            label={d.oldPriceLabel}
            badges={<MpBadges uz ym reqUz />}
            type="number" value={oldPrice} onChange={setOldPrice}
            placeholder={d.phOldPrice}
          />
          <IkpuSearchField
            value={ikpu} onChange={setIkpu}
            badges={<MpBadges uz ym reqUz reqYm />}
            lang={lang}
          />
          <InputField
            label={d.barcodeLabel}
            badges={<MpBadges uz ym reqYm />}
            value={barcode} onChange={setBarcode}
            placeholder={d.phBarcode}
          />
          <InputField
            label={d.weightG}
            badges={<MpBadges uz ym reqUz reqYm />}
            type="number" value={weightG} onChange={setWeightG}
            hint={lang === 'ru' ? 'Yandex конвертирует в кг' : lang === 'uz' ? 'Yandex kg ga konvert qiladi' : 'Yandex converts to kg'}
            placeholder={d.phWeightG}
          />
          <InputField
            label={d.heightMm}
            badges={<MpBadges uz ym reqUz reqYm />}
            type="number" value={heightMm} onChange={setHeightMm}
            hint={lang === 'ru' ? 'Yandex конвертирует в см' : lang === 'uz' ? 'Yandex sm ga konvert qiladi' : 'Yandex converts to cm'}
            placeholder={d.phHeightMm}
          />
          <InputField
            label={d.widthMm}
            badges={<MpBadges uz ym reqUz reqYm />}
            type="number" value={widthMm} onChange={setWidthMm}
            placeholder={d.phWidthMm}
          />
          <InputField
            label={d.lengthMm}
            badges={<MpBadges uz ym reqUz reqYm />}
            type="number" value={lengthMm} onChange={setLengthMm}
            placeholder={d.phLengthMm}
          />
        </div>
      </SectionCard>

      {/* ── Uzum-only fields ── */}
      <SectionCard
        title={d.uzumOnlySection ?? (lang === 'ru' ? 'Поля только для Uzum' : lang === 'uz' ? 'Faqat Uzum uchun maydonlar' : 'Uzum-only fields')}
        badge={<MpBadge mp="uz" />}
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
        badge={<MpBadges uz ym />}
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
                  <InputField label={d.colorLabel} badges={<MpBadges uz ym />}
                    value={v.color} onChange={val => updateVariant(v.id, 'color', val)}
                    placeholder={d.phColor} />
                  <InputField label={d.sizeLabel} badges={<MpBadges uz ym />}
                    value={v.size} onChange={val => updateVariant(v.id, 'size', val)}
                    placeholder={d.phSize} />
                  <InputField label={d.skuId} badges={<MpBadges uz ym />}
                    value={v.sku} onChange={val => updateVariant(v.id, 'sku', val)}
                    placeholder={d.phSku} />
                  <InputField label={d.barcodeLabel} badges={<MpBadges uz ym />}
                    value={v.barcode} onChange={val => updateVariant(v.id, 'barcode', val)}
                    placeholder={d.phBarcode} />
                  <InputField label={d.sellingPrice} badges={<MpBadges uz ym />}
                    type="number" value={v.sellingPrice}
                    onChange={val => updateVariant(v.id, 'sellingPrice', val)}
                    placeholder={d.phSellingPrice} />
                  <InputField label={d.oldPriceLabel} badges={<MpBadges uz ym />}
                    type="number" value={v.oldPrice}
                    onChange={val => updateVariant(v.id, 'oldPrice', val)}
                    placeholder={d.phOldPrice} />
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

      {/* ── Characteristics (Yandex) ── */}
      <SectionCard
        title={d.characteristicsSection}
        badge={<MpBadge mp="ym" />}
        defaultOpen={false}
      >
        <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
          {lang === 'ru' ? 'Ключевые, Дополнительные, Подробности — зависят от категории Yandex'
            : lang === 'uz' ? "Asosiy, Qo'shimcha, Tafsilotlar — Yandex kategoriyasiga bog'liq"
            : 'Key, Additional, Details — depend on Yandex category'}
        </p>
        {chars.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {lang === 'ru' ? 'Нет характеристик.' :
             lang === 'uz' ? "Xususiyatlar yo'q." :
             'No characteristics.'}
          </p>
        ) : (
          <div className="space-y-2">
            {chars.map(c => (
              <div key={c.id} className="flex flex-col sm:flex-row sm:items-end gap-2">
                <div className="flex-1">
                  <InputField label={d.charName} value={c.name}
                    onChange={val => updateChar(c.id, 'name', val)}
                    placeholder={d.phCharName} />
                </div>
                <div className="flex-1">
                  <InputField label={d.charValue} value={c.value}
                    onChange={val => updateChar(c.id, 'value', val)}
                    placeholder={d.phCharValue} />
                </div>
                <button
                  type="button"
                  onClick={() => removeChar(c.id)}
                  className="p-2 rounded-lg transition-colors hover:bg-red-500/10 mb-0.5 self-end"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={addChar}
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl border transition-colors hover:opacity-80"
          style={{ color: 'var(--c1)', borderColor: 'var(--border)', background: 'var(--bg-card2)' }}
        >
          <Plus className="w-4 h-4" />
          {d.addCharacteristic}
        </button>
      </SectionCard>

      {/* ── Yandex Market Export / Push ── */}
      <div
        className="rounded-2xl border p-4 sm:p-5"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-2 mb-3">
          <h3 className="font-semibold text-[15px]" style={{ color: 'var(--text-base)' }}>
            {d.addToYandex ?? 'Yandex Market'}
          </h3>
          <MpBadge mp="ym" />
        </div>
        <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
          {d.addToYandexHint ?? (lang === 'ru'
            ? 'Товар будет создан напрямую в Yandex Market через API'
            : lang === 'uz'
            ? "Mahsulot Yandex Market ga API orqali to'g'ridan-to'g'ri qo'shiladi"
            : 'Product will be created directly on Yandex Market via API')}
        </p>

        {!canExportYandex && (() => {
          const missing: string[] = []
          const add = (cond: string, label: string) => { if (!cond.trim()) missing.push(label) }
          add(nameRu, lang === 'ru' ? 'Название RU' : lang === 'uz' ? 'Nomi RU' : 'Name RU')
          add(nameUz, lang === 'ru' ? 'Название UZ' : lang === 'uz' ? 'Nomi UZ' : 'Name UZ')
          add(sku, lang === 'ru' ? 'Артикул' : 'SKU')
          if (!brand.trim() && !brandSkipped) missing.push(lang === 'ru' ? 'Бренд' : 'Brend')
          add(yandexCatName, lang === 'ru' ? 'Категория Yandex' : lang === 'uz' ? 'Yandex kategoriyasi' : 'Yandex category')
          add(descRu, lang === 'ru' ? 'Описание RU' : lang === 'uz' ? 'Tavsif RU' : 'Description RU')
          add(descUz, lang === 'ru' ? 'Описание UZ' : lang === 'uz' ? 'Tavsif UZ' : 'Description UZ')
          add(photoUrls, lang === 'ru' ? 'Фото' : lang === 'uz' ? 'Rasm' : 'Photos')
          add(sellingPrice, lang === 'ru' ? 'Цена' : lang === 'uz' ? 'Narx' : 'Price')
          add(barcode, lang === 'ru' ? 'Штрихкод' : 'Shtrixkod')
          add(weightG, lang === 'ru' ? 'Вес' : lang === 'uz' ? "Og'irlik" : 'Weight')
          add(heightMm, lang === 'ru' ? 'Высота' : lang === 'uz' ? 'Balandlik' : 'Height')
          add(widthMm, lang === 'ru' ? 'Ширина' : lang === 'uz' ? 'Kenglik' : 'Width')
          add(lengthMm, lang === 'ru' ? 'Длина' : lang === 'uz' ? 'Uzunlik' : 'Length')
          add(ikpu, 'IKPU')
          return (
            <div className="text-sm mb-4 px-3 py-2.5 rounded-xl border"
              style={{ color: 'var(--text-muted)', borderColor: 'rgba(252,63,29,0.2)', background: 'rgba(252,63,29,0.04)' }}>
              <p className="font-medium mb-1" style={{ color: '#FC3F1D' }}>
                {lang === 'ru' ? 'Заполните поля:' : lang === 'uz' ? "Maydonlarni to'ldiring:" : 'Fill in fields:'}
              </p>
              <p className="text-xs">{missing.join(', ')}</p>
            </div>
          )
        })()}

        {pushResult && (
          <div
            className="flex items-center gap-2 text-sm mb-4 px-3 py-2 rounded-xl border"
            style={{
              borderColor: pushResult.ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)',
              background: pushResult.ok ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
              color: pushResult.ok ? 'rgb(34,197,94)' : 'rgb(239,68,68)',
            }}
          >
            {pushResult.ok ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            {pushResult.message}
          </div>
        )}

        <div className="flex flex-col sm:flex-row flex-wrap gap-3">
          <button
            type="button"
            disabled={!canExportYandex || pushing}
            onClick={handleYandexPush}
            className="inline-flex items-center justify-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors disabled:opacity-40"
            style={{
              background: canExportYandex && !pushing ? '#FC3F1D' : 'var(--bg-card2)',
              color: canExportYandex && !pushing ? '#fff' : 'var(--text-muted)',
            }}
          >
            <Send className="w-4 h-4" />
            {pushing
              ? (d.pushing ?? (lang === 'ru' ? 'Отправка...' : lang === 'uz' ? 'Yuborilmoqda...' : 'Pushing...'))
              : (d.pushToYandex ?? (lang === 'ru' ? 'Добавить в Yandex' : lang === 'uz' ? "Yandex ga qo'shish" : 'Add to Yandex'))}
          </button>

          <button
            type="button"
            disabled={!canExportYandex || downloading !== null}
            onClick={() => handleExport('yandex')}
            className="inline-flex items-center justify-center gap-2 text-sm font-medium px-4 py-2 rounded-xl border transition-colors disabled:opacity-40"
            style={{
              borderColor: 'var(--border)',
              color: canExportYandex ? 'var(--text-base)' : 'var(--text-muted)',
              background: 'var(--bg-card2)',
            }}
          >
            <FileSpreadsheet className="w-4 h-4" />
            {downloading === 'yandex' ? d.downloading : (d.exportYandexAlt ?? (lang === 'ru' ? 'Скачать Excel' : lang === 'uz' ? 'Excel yuklab olish' : 'Download Excel'))}
          </button>
        </div>
      </div>

      {/* ── Uzum Market Export ── */}
      <div
        className="rounded-2xl border p-4 sm:p-5"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-2 mb-3">
          <h3 className="font-semibold text-[15px]" style={{ color: 'var(--text-base)' }}>
            {d.uzumExport ?? 'Uzum Market'}
          </h3>
          <MpBadge mp="uz" />
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
          add(photoUrls, lang === 'ru' ? 'Фото' : lang === 'uz' ? 'Rasm' : 'Photos')
          add(sellingPrice, lang === 'ru' ? 'Цена продажи' : lang === 'uz' ? 'Sotuv narxi' : 'Selling price')
          add(oldPrice, lang === 'ru' ? 'Старая цена' : lang === 'uz' ? 'Eski narx' : 'Old price')
          add(weightG, lang === 'ru' ? 'Вес' : lang === 'uz' ? "Og'irlik" : 'Weight')
          add(heightMm, lang === 'ru' ? 'Высота' : lang === 'uz' ? 'Balandlik' : 'Height')
          add(widthMm, lang === 'ru' ? 'Ширина' : lang === 'uz' ? 'Kenglik' : 'Width')
          add(lengthMm, lang === 'ru' ? 'Длина' : lang === 'uz' ? 'Uzunlik' : 'Length')
          add(ikpu, 'IKPU')
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

        <button
          type="button"
          disabled={!canExportUzum || downloading !== null}
          onClick={() => handleExport('uzum')}
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
