'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import {
  Plus, Trash2, Download, FileSpreadsheet, Send, Upload,
  ChevronDown, ChevronUp, ArrowLeft, Check, AlertCircle, Search,
  RefreshCw,
} from 'lucide-react'
import Link from 'next/link'
import { useLang } from '@/app/providers'
import { translations } from '@/lib/i18n'
import { useAutoTranslate } from '@/hooks/useAutoTranslate'
import { searchDirect } from '@/lib/ikpu/browser-search'
import type { IkpuResult } from '@/lib/ikpu/client'
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

interface Characteristic {
  id: string
  name: string
  value: string
}

const uid = () => Math.random().toString(36).slice(2, 9)

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

// ── Country searchable picker ────────────────────────────────────────────────

const COUNTRIES: { ru: string; uz: string; en: string }[] = [
  { ru: 'Китай', uz: 'Xitoy', en: 'China' },
  { ru: 'Турция', uz: 'Turkiya', en: 'Turkey' },
  { ru: 'Узбекистан', uz: "O'zbekiston", en: 'Uzbekistan' },
  { ru: 'Россия', uz: 'Rossiya', en: 'Russia' },
  { ru: 'Южная Корея', uz: 'Janubiy Koreya', en: 'South Korea' },
  { ru: 'Япония', uz: 'Yaponiya', en: 'Japan' },
  { ru: 'Германия', uz: 'Germaniya', en: 'Germany' },
  { ru: 'США', uz: 'AQSH', en: 'USA' },
  { ru: 'Италия', uz: 'Italiya', en: 'Italy' },
  { ru: 'Франция', uz: 'Fransiya', en: 'France' },
  { ru: 'Индия', uz: 'Hindiston', en: 'India' },
  { ru: 'Великобритания', uz: 'Buyuk Britaniya', en: 'United Kingdom' },
  { ru: 'Бразилия', uz: 'Braziliya', en: 'Brazil' },
  { ru: 'Вьетнам', uz: 'Vyetnam', en: 'Vietnam' },
  { ru: 'Индонезия', uz: 'Indoneziya', en: 'Indonesia' },
  { ru: 'Таиланд', uz: 'Tailand', en: 'Thailand' },
  { ru: 'Малайзия', uz: 'Malayziya', en: 'Malaysia' },
  { ru: 'Тайвань', uz: 'Tayvan', en: 'Taiwan' },
  { ru: 'Польша', uz: 'Polsha', en: 'Poland' },
  { ru: 'Испания', uz: 'Ispaniya', en: 'Spain' },
  { ru: 'Нидерланды', uz: 'Niderlandiya', en: 'Netherlands' },
  { ru: 'Швеция', uz: 'Shvetsiya', en: 'Sweden' },
  { ru: 'Швейцария', uz: 'Shveytsariya', en: 'Switzerland' },
  { ru: 'Канада', uz: 'Kanada', en: 'Canada' },
  { ru: 'Мексика', uz: 'Meksika', en: 'Mexico' },
  { ru: 'Австралия', uz: 'Avstraliya', en: 'Australia' },
  { ru: 'ОАЭ', uz: 'BAA', en: 'UAE' },
  { ru: 'Саудовская Аравия', uz: 'Saudiya Arabistoni', en: 'Saudi Arabia' },
  { ru: 'Казахстан', uz: "Qozog'iston", en: 'Kazakhstan' },
  { ru: 'Кыргызстан', uz: "Qirg'iziston", en: 'Kyrgyzstan' },
  { ru: 'Таджикистан', uz: 'Tojikiston', en: 'Tajikistan' },
  { ru: 'Туркменистан', uz: 'Turkmaniston', en: 'Turkmenistan' },
  { ru: 'Беларусь', uz: 'Belarus', en: 'Belarus' },
  { ru: 'Украина', uz: 'Ukraina', en: 'Ukraine' },
  { ru: 'Азербайджан', uz: 'Ozarbayjon', en: 'Azerbaijan' },
  { ru: 'Грузия', uz: 'Gruziya', en: 'Georgia' },
  { ru: 'Армения', uz: 'Armaniston', en: 'Armenia' },
  { ru: 'Пакистан', uz: 'Pokiston', en: 'Pakistan' },
  { ru: 'Бангладеш', uz: 'Bangladesh', en: 'Bangladesh' },
  { ru: 'Египет', uz: 'Misr', en: 'Egypt' },
  { ru: 'Финляндия', uz: 'Finlandiya', en: 'Finland' },
  { ru: 'Норвегия', uz: 'Norvegiya', en: 'Norway' },
  { ru: 'Дания', uz: 'Daniya', en: 'Denmark' },
  { ru: 'Чехия', uz: 'Chexiya', en: 'Czech Republic' },
  { ru: 'Португалия', uz: 'Portugaliya', en: 'Portugal' },
  { ru: 'Австрия', uz: 'Avstriya', en: 'Austria' },
  { ru: 'Венгрия', uz: 'Vengriya', en: 'Hungary' },
  { ru: 'Израиль', uz: 'Isroil', en: 'Israel' },
  { ru: 'Аргентина', uz: 'Argentina', en: 'Argentina' },
  { ru: 'Сингапур', uz: 'Singapur', en: 'Singapore' },
  { ru: 'Филиппины', uz: 'Filippin', en: 'Philippines' },
]

function CountryPicker({
  value,
  onChange,
  disabled,
  label,
  badges,
  placeholder,
  lang,
}: {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  label: string
  badges?: React.ReactNode
  placeholder?: string
  lang: 'ru' | 'uz' | 'en'
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const displayName = (c: typeof COUNTRIES[0]) => c[lang]

  const filtered = COUNTRIES.filter(c => {
    const q = query.toLowerCase()
    if (!q) return true
    return c.ru.toLowerCase().includes(q)
      || c.uz.toLowerCase().includes(q)
      || c.en.toLowerCase().includes(q)
  })

  const selectedDisplay = value
    ? (COUNTRIES.find(c => c.ru === value || c.uz === value || c.en === value)?.[lang] ?? value)
    : ''

  return (
    <div ref={ref} className="relative">
      <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-dim)' }}>
        {label}{badges}
      </label>
      <div className="relative">
        <input
          type="text"
          value={open ? query : selectedDisplay}
          onChange={e => { setQuery(e.target.value); if (!open) setOpen(true) }}
          onFocus={() => { setOpen(true); setQuery('') }}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full px-3 py-2 pr-8 rounded-xl border text-sm transition-colors focus:outline-none focus:ring-2 disabled:opacity-40"
          style={{
            background: 'var(--bg-input)',
            borderColor: 'var(--border)',
            color: 'var(--text-base)',
            // @ts-expect-error CSS custom property
            '--tw-ring-color': 'var(--c1)',
          }}
        />
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
      </div>
      {open && !disabled && (
        <div
          className="absolute z-30 left-0 right-0 mt-1 rounded-xl border shadow-lg max-h-60 overflow-y-auto"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
        >
          {filtered.length === 0 && (
            <p className="px-3 py-2 text-sm" style={{ color: 'var(--text-muted)' }}>
              {lang === 'ru' ? 'Не найдено' : lang === 'uz' ? 'Topilmadi' : 'Not found'}
            </p>
          )}
          {filtered.map(c => (
            <button
              key={c.en}
              type="button"
              onClick={() => { onChange(c.ru); setOpen(false); setQuery('') }}
              className="w-full text-left px-3 py-2 text-sm hover:opacity-80 transition-colors border-b last:border-b-0"
              style={{
                color: 'var(--text-base)',
                borderColor: 'var(--border)',
                background: value === c.ru ? 'var(--c1-alpha, rgba(99,102,241,0.08))' : undefined,
              }}
            >
              {displayName(c)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

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

  // Category — cascading tree pickers
  const [uzumTree, setUzumTree] = useState<CatNode[]>([])
  const [uzumTreeLoading, setUzumTreeLoading] = useState(true)
  const [uzumTreeError, setUzumTreeError] = useState('')
  const [uzumCatPath, setUzumCatPath] = useState<CatNode[]>([])

  const [yandexTree, setYandexTree] = useState<CatNode[]>([])
  const [yandexTreeLoading, setYandexTreeLoading] = useState(true)
  const [yandexTreeError, setYandexTreeError] = useState('')
  const [yandexCatPath, setYandexCatPath] = useState<CatNode[]>([])

  const uzumCatName = uzumCatPath.length > 0 ? uzumCatPath[uzumCatPath.length - 1].name : ''
  const yandexCatName = yandexCatPath.length > 0 ? yandexCatPath[yandexCatPath.length - 1].name : ''
  const yandexCatId = yandexCatPath.length > 0 ? yandexCatPath[yandexCatPath.length - 1].id : null

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
  const [variantUploading, setVariantUploading] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const variantFileRefs = useRef<Record<string, HTMLInputElement | null>>({})

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
        if (!cancelled) setUzumTree(normalize(data.categories ?? []))
      })
      .catch(() => { if (!cancelled) setUzumTreeError('Не удалось загрузить категории Uzum') })
      .finally(() => { if (!cancelled) setUzumTreeLoading(false) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch('/api/products/yandex-categories')
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(data => {
        if (!cancelled) setYandexTree(data.categories ?? [])
      })
      .catch(() => { if (!cancelled) setYandexTreeError('Не удалось загрузить категории Yandex') })
      .finally(() => { if (!cancelled) setYandexTreeLoading(false) })
    return () => { cancelled = true }
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
    && (variants.length > 0 ? variants.every(v => v.photoUrl.trim()) : photoUrls.trim())
    && sellingPrice && oldPrice
    && weightG && heightMm && widthMm && lengthMm
    && ikpu.trim()

  const hasPhotos = variants.length > 0
    ? variants.every(v => v.photoUrl.trim())
    : !!photoUrls.trim()

  const canExportYandex =
    nameRu.trim() && nameUz.trim()
    && sku.trim()
    && (brand.trim() || brandSkipped)
    && yandexCatName.trim()
    && descRu.trim() && descUz.trim()
    && hasPhotos
    && sellingPrice
    && barcode.trim()
    && weightG && heightMm && widthMm && lengthMm
    && ikpu.trim()

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
        const yDesc = str(first, ci.desc)
        setDescRu(yDesc)
        const ymCatStr = str(first, ci.cat)
        if (ymCatStr) {
          const path = findCatPath(yandexTree, ymCatStr)
          if (path) setYandexCatPath(path)
        }
        setBrand(str(first, ci.brand))
        setBarcode(str(first, ci.barcode))
        setCountry(str(first, ci.country))
        setNameUz(str(first, ci.nameUz))
        setDescUz(str(first, ci.descUz))
        setIkpu(str(first, ci.ikpu))
        setIkpuPackCode(str(first, ci.ikpuPackCode))
        setSellingPrice(String(num(first, ci.price) || ''))
        setOldPrice(String(num(first, ci.oldPrice) || ''))
        setSkuGroup(str(first, ci.sku) || str(first, ci.name))
        if (yDesc && !shortDescRu) setShortDescRu(yDesc.slice(0, 300))

        const wKg = num(first, ci.weight)
        if (wKg) setWeightG(String(Math.round(wKg * 1000)))
        const lCm = num(first, ci.length)
        if (lCm) setLengthMm(String(Math.round(lCm * 10)))
        const wCm = num(first, ci.width)
        if (wCm) setWidthMm(String(Math.round(wCm * 10)))
        const hCm = num(first, ci.height)
        if (hCm) setHeightMm(String(Math.round(hCm * 10)))

        const parseColor = (charStr: string) => {
          if (!charStr) return ''
          const pair = charStr.split(';').find(p => /^цвет\|/i.test(p.trim()))
          return pair ? pair.split('|')[1]?.trim() || '' : ''
        }
        const parseSize = (charStr: string) => {
          if (!charStr) return ''
          const pair = charStr.split(';').find(p => /^размер\|/i.test(p.trim()))
          return pair ? pair.split('|')[1]?.trim() || '' : ''
        }

        const charStr = str(first, ci.chars)
        if (charStr) {
          setChars(charStr.split(';').filter(Boolean)
            .filter(p => !/^(цвет|размер)\|/i.test(p.trim()))
            .map(pair => {
              const [name, value] = pair.split('|')
              return { id: uid(), name: name?.trim() || '', value: value?.trim() || '' }
            }))
        }

        const firstColor = parseColor(str(first, ci.chars))
        const firstSize = parseSize(str(first, ci.chars))
        const hasVariantData = dataRows.length > 1 || firstColor || firstSize
        if (hasVariantData) {
          setVariants(dataRows.map(r => {
            const rChars = str(r, ci.chars)
            return {
              id: uid(),
              color: parseColor(rChars),
              size: parseSize(rChars),
              sku: str(r, ci.sku),
              barcode: str(r, ci.barcode),
              sellingPrice: String(num(r, ci.price) || ''),
              oldPrice: String(num(r, ci.oldPrice) || ''),
              photoUrl: '',
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
      photoUrls: v.photoUrl.trim() || '',
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
        id: uzumCatPath.length > 0 ? String(uzumCatPath[uzumCatPath.length - 1].id) : '',
        name: uzumCatName || '',
        fullPath: uzumCatPath.map(n => n.name).join(' > ') || '',
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
          setPushResult({ ok: false, message: lang === 'ru' ? 'Ошибка загрузки фото: URL не получен' : 'Photo upload error: no URL returned' })
        }
      } else {
        const err = await res.json().catch(() => ({ error: res.statusText }))
        setPushResult({ ok: false, message: `${lang === 'ru' ? 'Ошибка загрузки фото' : 'Photo upload error'}: ${err.error || res.statusText}` })
      }
    } catch (err) {
      setPushResult({ ok: false, message: `${lang === 'ru' ? 'Ошибка загрузки фото' : 'Photo upload error'}: ${err instanceof Error ? err.message : 'Unknown'}` })
    }
    setVariantUploading(null)
    const ref = variantFileRefs.current[variantId]
    if (ref) ref.value = ''
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

  const checkImageDimensions = (url: string): Promise<{ w: number; h: number } | null> =>
    new Promise(resolve => {
      const img = new window.Image()
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
      img.onerror = () => resolve(null)
      img.src = url
      setTimeout(() => resolve(null), 5000)
    })

  const handleYandexPush = async () => {
    setPushing(true)
    setPushResult(null)
    try {
      if (variants.length > 0) {
        const missing = variants.filter(v => !v.photoUrl.trim())
        if (missing.length > 0) {
          const names = missing.map(v => v.color || v.sku || '?').join(', ')
          const msg = lang === 'ru'
            ? `Загрузите фото для каждого варианта. Без фото: ${names}`
            : lang === 'uz'
            ? `Har bir variant uchun rasm yuklang. Rasmsiz: ${names}`
            : `Upload a photo for each variant. Missing photo: ${names}`
          setPushResult({ ok: false, message: msg })
          setPushing(false)
          return
        }
      } else if (!photoUrls.trim()) {
        const msg = lang === 'ru'
          ? 'Загрузите хотя бы одно фото товара.'
          : lang === 'uz'
          ? "Kamida bitta mahsulot rasmini yuklang."
          : 'Upload at least one product photo.'
        setPushResult({ ok: false, message: msg })
        setPushing(false)
        return
      }

      // Check image dimensions (Yandex requires min 300x300)
      const allUrls: { label: string; url: string }[] = []
      if (variants.length > 0) {
        for (const v of variants) {
          for (const u of v.photoUrl.split(/[\n,]+/).map(s => s.trim()).filter(Boolean)) {
            allUrls.push({ label: v.color || v.sku || '?', url: u })
          }
        }
      } else {
        for (const u of photoUrls.split(/[\n,]+/).map(s => s.trim()).filter(Boolean)) {
          allUrls.push({ label: '', url: u })
        }
      }
      const tooSmall: string[] = []
      await Promise.all(allUrls.map(async ({ label, url }) => {
        const dims = await checkImageDimensions(url)
        if (dims && (dims.w < 300 || dims.h < 300)) {
          const tag = label ? `${label}: ` : ''
          tooSmall.push(`${tag}${dims.w}x${dims.h}px`)
        }
      }))
      if (tooSmall.length > 0) {
        const msg = lang === 'ru'
          ? `Фото слишком маленькие (мин. 300x300 для Yandex): ${tooSmall.join(', ')}`
          : lang === 'uz'
          ? `Rasmlar juda kichik (min. 300x300 Yandex uchun): ${tooSmall.join(', ')}`
          : `Photos too small (min 300x300 for Yandex): ${tooSmall.join(', ')}`
        setPushResult({ ok: false, message: msg })
        setPushing(false)
        return
      }
      const products = buildProducts()
      const offers = products.map(p => ({
        offerId: p.sku || `new-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: p.nameRu,
        category: yandexCatName || undefined,
        marketCategoryId: yandexCatId || undefined,
        vendor: p.brand || undefined,
        description: p.descriptionRu || undefined,
        pictures: (() => {
          if (!p.photoUrls) return undefined
          const urls = p.photoUrls.split(/[\n,]+/)
            .map(u => u.trim())
            .filter(u => u && /^https?:\/\/.+/.test(u))
            .map(u => u.replace(/^http:\/\//, 'https://'))
          return urls.length > 0 ? urls : undefined
        })(),
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
        uz_name: p.nameUz || undefined,
        uz_description: p.descriptionUz || undefined,
      }))

      console.log('[Yandex Push] Sending offers:', offers.map(o => ({
        offerId: o.offerId, pictures: o.pictures, vendor: o.vendor,
        hasDimensions: !!o.weightDimensions, hasBarcodes: !!o.barcodes?.length,
      })))

      const res = await fetch('/api/products/yandex-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offers }),
      })

      if (res.ok) {
        const data = await res.json().catch(() => ({}))
        console.log('[Yandex Push] Full response:', JSON.stringify(data, null, 2))
        const totalPhotos = offers.reduce((n, o) => n + (o.pictures?.length ?? 0), 0)
        const photoNote = totalPhotos > 0
          ? (lang === 'ru' ? ` Фото: ${totalPhotos} шт.` : lang === 'uz' ? ` Rasmlar: ${totalPhotos} ta.` : ` Photos: ${totalPhotos}.`)
          : (lang === 'ru' ? ' Фото не указаны.' : lang === 'uz' ? ' Rasmlar ko\'rsatilmagan.' : ' No photos included.')
        const message = lang === 'ru'
          ? `${offers.length} товар(ов) отправлено в Yandex Market. Обработка может занять несколько минут.${photoNote}`
          : lang === 'uz'
          ? `${offers.length} ta mahsulot Yandex Market ga yuborildi. Ishlov berish bir necha daqiqa davom etishi mumkin.${photoNote}`
          : `${offers.length} product(s) pushed to Yandex Market. Processing may take a few minutes.${photoNote}`
        setPushResult({ ok: true, message })
        // Trigger a background sync so the pushed product appears in Daromadchi
        // immediately instead of waiting for the next scheduled heavy sync.
        fetch('/api/yandex/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }).then(r => r.json()).then(syncData => {
          if (syncData.ok) {
            const syncMsg = lang === 'ru'
              ? ' Синхронизация завершена — товар появится на странице «Товары».'
              : lang === 'uz'
              ? ' Sinxronizatsiya tugadi — mahsulot «Mahsulotlar» sahifasida paydo bo\'ladi.'
              : ' Sync complete — product will appear on the Products page.'
            setPushResult(prev => prev?.ok ? { ok: true, message: prev.message + syncMsg } : prev)
          }
        }).catch(() => { /* sync failure is non-critical */ })
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
      <SectionCard title={d.basicInfo} allowOverflow>
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
          <div className="relative">
            <CountryPicker
              label={d.countryLabel}
              badges={<MpBadges uz ym reqUz reqYm />}
              value={country}
              onChange={setCountry}
              disabled={countrySkipped}
              placeholder={d.phCountry}
              lang={lang}
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
          <div>
            <CascadingCatPicker
              tree={yandexTree}
              loading={yandexTreeLoading}
              error={yandexTreeError}
              selectedPath={yandexCatPath}
              onSelect={setYandexCatPath}
              label={d.yandexCategory}
              badge={<MpBadges ym reqYm />}
              accentColor="#FC3F1D"
            />
            {yandexCatId && (
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                ID: {yandexCatId}
                {categoryParamsLoading ? ' — загрузка параметров...' : categoryParams.length > 0 ? ` — ${categoryParams.filter(p => p.required).length} обязательных параметров` : ''}
              </p>
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
        {variants.length > 0 ? (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl" style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)' }}>
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--c1)' }} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {lang === 'ru'
                ? 'Загрузите фото для каждого варианта (цвета) отдельно в разделе «Варианты» ниже.'
                : lang === 'uz'
                ? "Har bir variant (rang) uchun rasmni «Variantlar» bo'limida alohida yuklang."
                : 'Upload a photo for each variant (color) separately in the Variants section below.'}
            </p>
          </div>
        ) : (
          <>
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
          </>
        )}
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
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-dim)' }}>
              {d.barcodeLabel}
              <MpBadges uz ym reqYm />
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
            badges={<MpBadges uz ym reqUz reqYm />}
            type="number" value={weightG} onChange={setWeightG}
            hint={weightG ? `→ Yandex: ${(Number(weightG) / 1000).toFixed(3)} ${lang === 'ru' ? 'кг' : 'kg'}` : (lang === 'ru' ? 'Yandex конвертирует в кг' : lang === 'uz' ? 'Yandex kg ga konvert qiladi' : 'Yandex converts to kg')}
            placeholder={d.phWeightG}
          />
          <InputField
            label={d.heightMm}
            badges={<MpBadges uz ym reqUz reqYm />}
            type="number" value={heightMm} onChange={setHeightMm}
            hint={heightMm ? `→ Yandex: ${(Number(heightMm) / 10).toFixed(1)} ${lang === 'ru' ? 'см' : 'cm'}` : (lang === 'ru' ? 'Yandex конвертирует в см' : lang === 'uz' ? 'Yandex sm ga konvert qiladi' : 'Yandex converts to cm')}
            placeholder={d.phHeightMm}
          />
          <InputField
            label={d.widthMm}
            badges={<MpBadges uz ym reqUz reqYm />}
            type="number" value={widthMm} onChange={setWidthMm}
            hint={widthMm ? `→ Yandex: ${(Number(widthMm) / 10).toFixed(1)} ${lang === 'ru' ? 'см' : 'cm'}` : undefined}
            placeholder={d.phWidthMm}
          />
          <InputField
            label={d.lengthMm}
            badges={<MpBadges uz ym reqUz reqYm />}
            type="number" value={lengthMm} onChange={setLengthMm}
            hint={lengthMm ? `→ Yandex: ${(Number(lengthMm) / 10).toFixed(1)} ${lang === 'ru' ? 'см' : 'cm'}` : undefined}
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
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-dim)' }}>
                      {d.barcodeLabel}
                      <MpBadges uz ym />
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
                  <InputField label={d.sellingPrice} badges={<MpBadges uz ym />}
                    type="number" value={v.sellingPrice}
                    onChange={val => updateVariant(v.id, 'sellingPrice', val)}
                    placeholder={d.phSellingPrice} />
                  <InputField label={d.oldPriceLabel} badges={<MpBadges uz ym />}
                    type="number" value={v.oldPrice}
                    onChange={val => updateVariant(v.id, 'oldPrice', val)}
                    placeholder={d.phOldPrice} />
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
                            setPushResult({ ok: false, message: lang === 'ru' ? 'Не удалось открыть выбор файла. Попробуйте вставить ссылку.' : 'Could not open file picker. Try pasting a URL.' })
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

      {/* ── Characteristics (Uzum + Yandex) ── */}
      <SectionCard
        title={d.characteristicsSection}
        badge={<MpBadges uz ym />}
        defaultOpen={false}
      >
        <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
          {lang === 'ru' ? 'Характеристики товара — зависят от категории (Uzum и Yandex)'
            : lang === 'uz' ? "Mahsulot xususiyatlari — kategoriyaga bog'liq (Uzum va Yandex)"
            : 'Product characteristics — depend on category (Uzum and Yandex)'}
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
          if (variants.length > 0) {
            const noPhoto = variants.filter(v => !v.photoUrl.trim())
            if (noPhoto.length > 0) {
              const names = noPhoto.map(v => v.color || v.sku || '?').join(', ')
              missing.push(`${lang === 'ru' ? 'Фото вариантов' : lang === 'uz' ? 'Variant rasmlari' : 'Variant photos'}: ${names}`)
            }
          } else {
            add(photoUrls, lang === 'ru' ? 'Фото' : lang === 'uz' ? 'Rasm' : 'Photos')
          }
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
