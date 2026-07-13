'use client'

import { useState } from 'react'
import { X, BookOpen } from 'lucide-react'
import { useLang } from '@/app/providers'
import type { Lang } from '@/lib/i18n'

interface Term {
  abbr: string
  full: Record<Lang, string>
  desc: Record<Lang, string>
}

// Abbreviations and short terms users run into across the dashboard.
const TERMS: Term[] = [
  {
    abbr: 'ДРР / DRR',
    full: { uz: 'Reklama xarajatlari ulushi', ru: 'Доля рекламных расходов', en: 'Ad spend share' },
    desc: {
      uz: "Reklamaga sarflangan pulning shu reklamadan kelgan tushumga nisbati (%). Past DRR — reklama samaraliroq.",
      ru: 'Отношение расходов на рекламу к выручке от неё (%). Чем ниже ДРР, тем эффективнее реклама.',
      en: 'Ad spend divided by the revenue it generated (%). Lower DRR means more efficient ads.',
    },
  },
  {
    abbr: 'CTR',
    full: { uz: 'Bosish darajasi (Click-Through Rate)', ru: 'Кликабельность (Click-Through Rate)', en: 'Click-Through Rate' },
    desc: {
      uz: "Reklamani ko'rganlarning necha foizi unga bosgani (kliklar ÷ ko'rsatishlar).",
      ru: 'Какой процент увидевших объявление кликнул по нему (клики ÷ показы).',
      en: 'Share of people who clicked an ad after seeing it (clicks ÷ impressions).',
    },
  },
  {
    abbr: 'CPC',
    full: { uz: 'Bir bosish narxi (Cost Per Click)', ru: 'Цена за клик (Cost Per Click)', en: 'Cost Per Click' },
    desc: {
      uz: 'Reklamadagi bitta bosish uchun toʻlanadigan oʻrtacha narx.',
      ru: 'Средняя стоимость одного клика по рекламе.',
      en: 'Average amount paid for a single ad click.',
    },
  },
  {
    abbr: 'CPO',
    full: { uz: 'Bir buyurtma narxi (Cost Per Order)', ru: 'Цена за заказ (Cost Per Order)', en: 'Cost Per Order' },
    desc: {
      uz: 'Reklama orqali kelgan bitta buyurtma uchun sarflangan oʻrtacha xarajat.',
      ru: 'Средние рекламные расходы на один полученный заказ.',
      en: 'Average ad spend per order brought in by the campaign.',
    },
  },
  {
    abbr: 'CR',
    full: { uz: 'Konversiya darajasi (Conversion Rate)', ru: 'Конверсия (Conversion Rate)', en: 'Conversion Rate' },
    desc: {
      uz: "Mahsulotni koʻrganlarning necha foizi buyurtma bergani.",
      ru: 'Какой процент посетителей карточки оформил заказ.',
      en: 'Share of product-page visitors who placed an order.',
    },
  },
  {
    abbr: 'ROI / ROAS',
    full: { uz: 'Investitsiya / reklama qaytimi', ru: 'Окупаемость вложений / рекламы', en: 'Return On Investment / Ad Spend' },
    desc: {
      uz: 'Sarflangan har bir soʻm qancha tushum yoki foyda qaytargani.',
      ru: 'Сколько выручки или прибыли вернул каждый вложенный сум.',
      en: 'How much revenue or profit each spent so‘m returned.',
    },
  },
  {
    abbr: 'FBO',
    full: { uz: 'Marketplace ombori orqali (Fulfillment by Operator)', ru: 'Со склада маркетплейса (Fulfillment by Operator)', en: 'Fulfillment By Operator' },
    desc: {
      uz: 'Tovar marketplace omborida saqlanadi va u yetkazib beradi.',
      ru: 'Товар хранится на складе маркетплейса, он же его доставляет.',
      en: 'Stock is held in the marketplace warehouse, which also ships it.',
    },
  },
  {
    abbr: 'FBS',
    full: { uz: 'Sotuvchi ombori orqali (Fulfillment by Seller)', ru: 'Со склада продавца (Fulfillment by Seller)', en: 'Fulfillment By Seller' },
    desc: {
      uz: 'Tovar sotuvchida saqlanadi; buyurtma boʻlsa marketplace yetkazib beradi.',
      ru: 'Товар хранится у продавца; при заказе доставляет маркетплейс.',
      en: 'Stock stays with the seller; the marketplace ships on each order.',
    },
  },
  {
    abbr: 'rFBS',
    full: { uz: 'Sotuvchi yetkazadi (realFBS)', ru: 'Доставка силами продавца (realFBS)', en: 'realFBS' },
    desc: {
      uz: 'Tovar ham sotuvchida, yetkazib berishni ham sotuvchining oʻzi tashkil qiladi.',
      ru: 'И хранение, и доставку организует сам продавец.',
      en: 'The seller handles both storage and delivery.',
    },
  },
  {
    abbr: 'P&L',
    full: { uz: 'Foyda va zarar hisoboti', ru: 'Отчёт о прибылях и убытках', en: 'Profit & Loss' },
    desc: {
      uz: "Tushum, xarajatlar va sof foydani koʻrsatadigan moliyaviy hisobot.",
      ru: 'Финансовый отчёт: выручка, расходы и чистая прибыль.',
      en: 'Financial statement of revenue, costs and net profit.',
    },
  },
  {
    abbr: 'SKU',
    full: { uz: 'Tovar artikuli (Stock Keeping Unit)', ru: 'Артикул (Stock Keeping Unit)', en: 'Stock Keeping Unit' },
    desc: {
      uz: 'Har bir tovar variantining noyob identifikatori (artikul).',
      ru: 'Уникальный идентификатор (артикул) каждой товарной позиции.',
      en: 'Unique identifier (article) for each product variant.',
    },
  },
  {
    abbr: 'ABC / XYZ',
    full: { uz: 'ABC / XYZ tahlili', ru: 'ABC / XYZ анализ', en: 'ABC / XYZ analysis' },
    desc: {
      uz: "Tovarlarni daromad (ABC) va talab barqarorligi (XYZ) boʻyicha guruhlash.",
      ru: 'Группировка товаров по вкладу в выручку (ABC) и стабильности спроса (XYZ).',
      en: 'Grouping products by revenue share (ABC) and demand stability (XYZ).',
    },
  },
]

const LABELS: Record<Lang, { trigger: string; title: string; close: string }> = {
  uz: { trigger: 'Qisqartmalar', title: 'Qisqartmalar lugʻati', close: 'Tushunarli' },
  ru: { trigger: 'Аббревиатуры', title: 'Словарь аббревиатур', close: 'Понятно' },
  en: { trigger: 'Abbreviations', title: 'Abbreviations glossary', close: 'Got it' },
}

export default function Glossary() {
  const [open, setOpen] = useState(false)
  const { lang } = useLang()
  const l = LABELS[lang] ?? LABELS.uz

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
        style={{ color: 'var(--text-muted)', border: '1px solid transparent' }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--c1)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}
      >
        <BookOpen className="w-4 h-4 flex-shrink-0" />
        {l.trigger}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />

          <div className="relative w-full max-w-md bg-[var(--bg-card)] border border-[var(--border2)] rounded-2xl shadow-2xl shadow-black/60 overflow-hidden" style={{ whiteSpace: 'normal' }}>
            <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-[var(--bg-card2)] border border-[var(--border)] flex items-center justify-center flex-shrink-0">
                  <BookOpen className="w-3.5 h-3.5 text-[var(--c1)]" />
                </div>
                <h2 className="text-[var(--text-base)] font-semibold text-sm">{l.title}</h2>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-base)] transition-colors p-1 rounded-lg hover:bg-[var(--bg-card2)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-3 max-h-[70vh] overflow-y-auto overflow-x-hidden select-none">
              {TERMS.map(term => (
                <div key={term.abbr} className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-card2)] px-3.5 py-3">
                  <div className="flex items-baseline gap-1.5 flex-wrap min-w-0">
                    <span className="text-[var(--c1)] font-bold text-xs shrink-0">{term.abbr}</span>
                    <span className="text-[var(--text-base)] text-xs font-medium" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>{term.full[lang] ?? term.full.uz}</span>
                  </div>
                  <p className="text-[var(--text-muted)] text-xs leading-relaxed mt-1" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>{term.desc[lang] ?? term.desc.uz}</p>
                </div>
              ))}
            </div>

            <div className="px-5 py-3 border-t border-[var(--border)]">
              <button
                onClick={() => setOpen(false)}
                className="w-full py-2 rounded-xl bg-[var(--bg-card2)] border border-[var(--border)] text-xs font-semibold hover:bg-[var(--c1)]/30 transition-all"
                style={{ color: 'var(--c1)' }}
              >
                {l.close}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
