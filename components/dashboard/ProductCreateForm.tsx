'use client'

import { useState, useCallback } from 'react'
import {
  Plus, Trash2, Download, FileSpreadsheet, Send, Upload,
  ChevronDown, ChevronUp, ArrowLeft, Check, AlertCircle,
} from 'lucide-react'
import Link from 'next/link'
import { useLang } from '@/app/providers'
import { translations } from '@/lib/i18n'

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

function SectionCard({
  title,
  children,
  defaultOpen = true,
}: {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
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
        className="w-full flex items-center justify-between px-5 py-4 text-left"
        style={{ color: 'var(--text-base)' }}
      >
        <span className="font-semibold text-[15px]">{title}</span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {open && (
        <div className="px-5 pb-5 space-y-4 border-t" style={{ borderColor: 'var(--border)' }}>
          <div className="pt-4">{children}</div>
        </div>
      )}
    </div>
  )
}

function InputField({
  label,
  required,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string
  required?: boolean
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-dim)' }}>
        {label}{required && <span style={{ color: 'var(--c1)' }}> *</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-xl border text-sm transition-colors focus:outline-none focus:ring-2"
        style={{
          background: 'var(--bg-input)',
          borderColor: 'var(--border)',
          color: 'var(--text-base)',
          // @ts-expect-error CSS custom property
          '--tw-ring-color': 'var(--c1)',
        }}
      />
    </div>
  )
}

function TextAreaField({
  label,
  required,
  value,
  onChange,
  rows = 3,
  placeholder,
}: {
  label: string
  required?: boolean
  value: string
  onChange: (v: string) => void
  rows?: number
  placeholder?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-dim)' }}>
        {label}{required && <span style={{ color: 'var(--c1)' }}> *</span>}
      </label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-xl border text-sm transition-colors focus:outline-none focus:ring-2 resize-y"
        style={{
          background: 'var(--bg-input)',
          borderColor: 'var(--border)',
          color: 'var(--text-base)',
          // @ts-expect-error CSS custom property
          '--tw-ring-color': 'var(--c1)',
        }}
      />
    </div>
  )
}

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

  // Category
  const [uzumCatId, setUzumCatId] = useState('')
  const [uzumCatName, setUzumCatName] = useState('')
  const [yandexCatName, setYandexCatName] = useState('')

  // Descriptions
  const [descRu, setDescRu] = useState('')
  const [descUz, setDescUz] = useState('')
  const [shortDescRu, setShortDescRu] = useState('')
  const [shortDescUz, setShortDescUz] = useState('')

  // Media
  const [photoUrls, setPhotoUrls] = useState('')

  // Pricing & dimensions (shared defaults)
  const [sellingPrice, setSellingPrice] = useState('')
  const [oldPrice, setOldPrice] = useState('')
  const [weightG, setWeightG] = useState('')
  const [heightMm, setHeightMm] = useState('')
  const [widthMm, setWidthMm] = useState('')
  const [lengthMm, setLengthMm] = useState('')
  const [ikpu, setIkpu] = useState('')
  const [barcode, setBarcode] = useState('')

  // SKU group
  const [skuGroup, setSkuGroup] = useState('')

  // Variants
  const [variants, setVariants] = useState<Variant[]>([])

  // Characteristics
  const [chars, setChars] = useState<Characteristic[]>([])

  // Export state
  const [downloading, setDownloading] = useState<'uzum' | 'yandex' | 'both' | null>(null)
  // Yandex push state
  const [pushing, setPushing] = useState(false)
  const [pushResult, setPushResult] = useState<{ ok: boolean; message: string } | null>(null)

  // Import state
  const [importResult, setImportResult] = useState<{ ok: boolean; message: string } | null>(null)

  const handleFileImport = async (file: File) => {
    setImportResult(null)
    try {
      const XLSX = await import('xlsx')
      const data = await file.arrayBuffer()
      const wb = XLSX.read(data, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      if (!ws) throw new Error('Empty file')

      const rows: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
      if (rows.length < 2) throw new Error('No data rows')

      const headers = rows[0].map(h => String(h).trim())
      const isUzum = headers.some(h => /Название товара RU/i.test(h))
      const isYandex = headers.some(h => /Ваш SKU/i.test(h))

      if (!isUzum && !isYandex) {
        throw new Error(lang === 'ru' ? 'Неизвестный формат файла' : lang === 'uz' ? "Noma'lum fayl formati" : 'Unknown file format')
      }

      const col = (name: RegExp) => headers.findIndex(h => name.test(h))
      const str = (row: string[], idx: number) => (idx >= 0 ? String(row[idx] ?? '').trim() : '')
      const num = (row: string[], idx: number) => {
        const v = idx >= 0 ? Number(row[idx]) : 0
        return isNaN(v) ? 0 : v
      }

      const startRow = isUzum ? 2 : 1
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
        setUzumCatId(str(first, ci.catId))
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
          price: col(/^Цена\b/), oldPrice: col(/^Зачёркнутая цена/),
          ikpu: col(/^ИКПУ/), chars: col(/^Характеристики/),
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
          setVariants(dataRows.slice(1).map(r => ({
            id: uid(),
            color: '',
            size: '',
            sku: str(r, ci.sku),
            barcode: str(r, ci.barcode),
            sellingPrice: String(num(r, ci.price) || ''),
            oldPrice: String(num(r, ci.oldPrice) || ''),
          })))
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

  const addVariant = () => setVariants(prev => [...prev, EMPTY_VARIANT()])
  const removeVariant = (id: string) => setVariants(prev => prev.filter(v => v.id !== id))
  const updateVariant = (id: string, field: keyof Variant, val: string) =>
    setVariants(prev => prev.map(v => (v.id === id ? { ...v, [field]: val } : v)))

  const addChar = () => setChars(prev => [...prev, { id: uid(), name: '', value: '' }])
  const removeChar = (id: string) => setChars(prev => prev.filter(c => c.id !== id))
  const updateChar = (id: string, field: 'name' | 'value', val: string) =>
    setChars(prev => prev.map(c => (c.id === id ? { ...c, [field]: val } : c)))

  const canExport = nameRu.trim() && nameUz.trim() && brand.trim() && descRu.trim()
    && descUz.trim() && shortDescRu.trim() && shortDescUz.trim()
    && sellingPrice && weightG && heightMm && widthMm && lengthMm && ikpu.trim()

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
      categoryId: uzumCatId,
      brand: brand.trim(),
      model: model.trim(),
      country: country.trim(),
      descriptionRu: descRu.trim(),
      descriptionUz: descUz.trim(),
      shortDescRu: shortDescRu.trim(),
      shortDescUz: shortDescUz.trim(),
      photoUrls: photoUrls.trim(),
      barcode: barcode.trim(),
      ikpu: ikpu.trim(),
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
  }, [nameRu, nameUz, sku, skuGroup, uzumCatName, uzumCatId, yandexCatName, brand, model, country,
    descRu, descUz, shortDescRu, shortDescUz, photoUrls, barcode, ikpu,
    sellingPrice, oldPrice, weightG, heightMm, widthMm, lengthMm, chars, variants])

  const doExport = async (marketplace: 'uzum' | 'yandex') => {
    const products = buildProducts()

    const body: Record<string, unknown> = { marketplace, products }
    if (marketplace === 'uzum') {
      body.uzumCategory = {
        id: uzumCatId || '0',
        name: uzumCatName || 'Не указана',
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
        name: p.nameRu,
        category: yandexCatName || undefined,
        vendor: p.brand || undefined,
        description: p.descriptionRu || undefined,
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
          currencyId: 'RUR',
          discountBase: p.oldPrice || undefined,
        } : undefined,
        customsCommodityCodes: p.ikpu ? [{ code: p.ikpu }] : undefined,
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

      {/* Import from Excel */}
      <div
        className="rounded-2xl border p-5"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="font-semibold text-[15px]" style={{ color: 'var(--text-base)' }}>
              {d.importExcel ?? (lang === 'ru' ? 'Импорт из Excel' : lang === 'uz' ? 'Excel dan import' : 'Import from Excel')}
            </h3>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {d.importExcelHint ?? (lang === 'ru'
                ? 'Загрузите файл Uzum или Yandex (.xlsx / .xlsm)'
                : lang === 'uz'
                ? 'Uzum yoki Yandex faylni yuklang (.xlsx / .xlsm)'
                : 'Upload an Uzum or Yandex file (.xlsx / .xlsm)')}
            </p>
          </div>
          <label
            className="inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors cursor-pointer"
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

      {/* Basic Info */}
      <SectionCard title={d.basicInfo}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InputField label={d.nameRu} required value={nameRu} onChange={setNameRu} />
          <InputField label={d.nameUz} required value={nameUz} onChange={setNameUz} />
          <InputField label={d.skuId} value={sku} onChange={setSku} />
          <InputField label={d.skuGroupLabel} required value={skuGroup} onChange={setSkuGroup}
            placeholder={nameRu || undefined} />
          <InputField label={d.brandLabel} required value={brand} onChange={setBrand} />
          <InputField label={d.modelLabel} value={model} onChange={setModel} />
          <InputField label={d.countryLabel} required value={country} onChange={setCountry} />
        </div>
      </SectionCard>

      {/* Category */}
      <SectionCard title={d.categorySection}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <InputField label={d.uzumCategory + ' — ID'} value={uzumCatId} onChange={setUzumCatId}
              placeholder="e.g. 1234" />
          </div>
          <div>
            <InputField label={d.uzumCategory + ' — ' + d.charName} value={uzumCatName}
              onChange={setUzumCatName} placeholder="e.g. Футболки" />
          </div>
          <div className="sm:col-span-2">
            <InputField label={d.yandexCategory} value={yandexCatName}
              onChange={setYandexCatName} placeholder="e.g. Футболки" />
          </div>
        </div>
      </SectionCard>

      {/* Descriptions */}
      <SectionCard title={d.descriptionSection}>
        <div className="space-y-4">
          <TextAreaField label={d.descRu} required value={descRu} onChange={setDescRu} />
          <TextAreaField label={d.descUz} required value={descUz} onChange={setDescUz} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextAreaField label={d.shortDescRu} required value={shortDescRu} onChange={setShortDescRu} rows={2} />
            <TextAreaField label={d.shortDescUz} required value={shortDescUz} onChange={setShortDescUz} rows={2} />
          </div>
        </div>
      </SectionCard>

      {/* Media */}
      <SectionCard title={d.mediaSection}>
        <TextAreaField label={d.photoUrls} required value={photoUrls} onChange={setPhotoUrls} rows={2} />
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{d.photoUrlsHint}</p>
      </SectionCard>

      {/* Pricing & Dimensions */}
      <SectionCard title={d.pricingSection}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <InputField label={d.sellingPrice} required type="number" value={sellingPrice} onChange={setSellingPrice} />
          <InputField label={d.oldPriceLabel} required type="number" value={oldPrice} onChange={setOldPrice} />
          <InputField label={d.ikpuLabel} required value={ikpu} onChange={setIkpu} />
          <InputField label={d.barcodeLabel} required value={barcode} onChange={setBarcode} />
          <InputField label={d.weightG} required type="number" value={weightG} onChange={setWeightG} />
          <InputField label={d.heightMm} required type="number" value={heightMm} onChange={setHeightMm} />
          <InputField label={d.widthMm} required type="number" value={widthMm} onChange={setWidthMm} />
          <InputField label={d.lengthMm} required type="number" value={lengthMm} onChange={setLengthMm} />
        </div>
      </SectionCard>

      {/* Variants */}
      <SectionCard title={d.variantsSection} defaultOpen={false}>
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
                className="rounded-xl border p-4 space-y-3"
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
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <InputField label={d.colorLabel} value={v.color}
                    onChange={val => updateVariant(v.id, 'color', val)} />
                  <InputField label={d.sizeLabel} value={v.size}
                    onChange={val => updateVariant(v.id, 'size', val)} />
                  <InputField label={d.skuId} value={v.sku}
                    onChange={val => updateVariant(v.id, 'sku', val)} />
                  <InputField label={d.barcodeLabel} value={v.barcode}
                    onChange={val => updateVariant(v.id, 'barcode', val)} />
                  <InputField label={d.sellingPrice} type="number" value={v.sellingPrice}
                    onChange={val => updateVariant(v.id, 'sellingPrice', val)} />
                  <InputField label={d.oldPriceLabel} type="number" value={v.oldPrice}
                    onChange={val => updateVariant(v.id, 'oldPrice', val)} />
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

      {/* Characteristics */}
      <SectionCard title={d.characteristicsSection} defaultOpen={false}>
        {chars.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {lang === 'ru' ? 'Нет характеристик.' :
             lang === 'uz' ? "Xususiyatlar yo'q." :
             'No characteristics.'}
          </p>
        ) : (
          <div className="space-y-2">
            {chars.map(c => (
              <div key={c.id} className="flex items-end gap-2">
                <div className="flex-1">
                  <InputField label={d.charName} value={c.name}
                    onChange={val => updateChar(c.id, 'name', val)} />
                </div>
                <div className="flex-1">
                  <InputField label={d.charValue} value={c.value}
                    onChange={val => updateChar(c.id, 'value', val)} />
                </div>
                <button
                  type="button"
                  onClick={() => removeChar(c.id)}
                  className="p-2 rounded-lg transition-colors hover:bg-red-500/10 mb-0.5"
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

      {/* Yandex Direct Push */}
      <div
        className="rounded-2xl border p-5"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
      >
        <h3 className="font-semibold text-[15px] mb-3" style={{ color: 'var(--text-base)' }}>
          {d.addToYandex ?? 'Yandex Market'}
        </h3>
        <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
          {d.addToYandexHint ?? (lang === 'ru'
            ? 'Товар будет создан напрямую в Yandex Market через API'
            : lang === 'uz'
            ? 'Mahsulot Yandex Market ga API orqali to\'g\'ridan-to\'g\'ri qo\'shiladi'
            : 'Product will be created directly on Yandex Market via API')}
        </p>

        {!canExport && (
          <p className="text-sm mb-4 px-3 py-2 rounded-xl border"
            style={{ color: 'var(--text-muted)', borderColor: 'var(--border)', background: 'var(--bg-card2)' }}>
            {d.fillRequired}
          </p>
        )}

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

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={!canExport || pushing}
            onClick={handleYandexPush}
            className="inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors disabled:opacity-40"
            style={{
              background: canExport && !pushing ? '#FC3F1D' : 'var(--bg-card2)',
              color: canExport && !pushing ? '#fff' : 'var(--text-muted)',
            }}
          >
            <Send className="w-4 h-4" />
            {pushing
              ? (d.pushing ?? (lang === 'ru' ? 'Отправка...' : lang === 'uz' ? 'Yuborilmoqda...' : 'Pushing...'))
              : (d.pushToYandex ?? (lang === 'ru' ? 'Добавить в Yandex' : lang === 'uz' ? 'Yandex ga qo\'shish' : 'Add to Yandex'))}
          </button>

          <button
            type="button"
            disabled={!canExport || downloading !== null}
            onClick={() => handleExport('yandex')}
            className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-xl border transition-colors disabled:opacity-40"
            style={{
              borderColor: 'var(--border)',
              color: canExport ? 'var(--text-base)' : 'var(--text-muted)',
              background: 'var(--bg-card2)',
            }}
          >
            <FileSpreadsheet className="w-4 h-4" />
            {downloading === 'yandex' ? d.downloading : (d.exportYandexAlt ?? (lang === 'ru' ? 'Скачать Excel' : lang === 'uz' ? 'Excel yuklab olish' : 'Download Excel'))}
          </button>
        </div>
      </div>

      {/* Uzum Excel Export */}
      <div
        className="rounded-2xl border p-5"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}
      >
        <h3 className="font-semibold text-[15px] mb-3" style={{ color: 'var(--text-base)' }}>
          {d.uzumExport ?? 'Uzum Market'}
        </h3>
        <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
          {d.uzumExportHint ?? (lang === 'ru'
            ? 'Скачайте Excel-файл и загрузите его в кабинет продавца Uzum'
            : lang === 'uz'
            ? 'Excel faylni yuklab oling va Uzum sotuvchi kabinetiga yuklang'
            : 'Download Excel file and upload it to Uzum seller cabinet')}
        </p>

        {!canExport && (
          <p className="text-sm mb-4 px-3 py-2 rounded-xl border"
            style={{ color: 'var(--text-muted)', borderColor: 'var(--border)', background: 'var(--bg-card2)' }}>
            {d.fillRequired}
          </p>
        )}

        <button
          type="button"
          disabled={!canExport || downloading !== null}
          onClick={() => handleExport('uzum')}
          className="inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors disabled:opacity-40"
          style={{
            background: canExport ? '#7B68EE' : 'var(--bg-card2)',
            color: canExport ? '#fff' : 'var(--text-muted)',
          }}
        >
          <FileSpreadsheet className="w-4 h-4" />
          {downloading === 'uzum' ? d.downloading : d.exportUzum}
        </button>
      </div>
    </div>
  )
}
