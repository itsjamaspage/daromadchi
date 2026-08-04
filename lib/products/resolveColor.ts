// Parse a color from a product TITLE (never the SKU — SKUs are intentionally the
// same across colors/markets, e.g. JMM99). Display-only. Substring match for safe
// 3+ char Cyrillic stems; whole-word match for short/ambiguous Latin tokens (so
// "oq" doesn't match random substrings). First match wins. Returns null when no
// color word is present (e.g. the J16 earphones) — those rows just get no badge.

export type ColorKey =
  | 'black' | 'white' | 'blue' | 'red' | 'green' | 'gray'
  | 'gold' | 'pink' | 'purple' | 'yellow' | 'brown' | 'beige'

// Same set the UI language switcher uses (app/providers → useLang).
export type BadgeLang = 'uz' | 'ru' | 'en'

export type ProductColor = { key: ColorKey; hex: string; ring?: boolean }

type Rule = ProductColor & { stems: string[]; words: string[] }

// Order matters: first match wins.
const RULES: Rule[] = [
  { key: 'black',  hex: '#111827',              stems: ['чёрн', 'черн'],       words: ['qora', 'black'] },
  { key: 'white',  hex: '#ffffff', ring: true,  stems: ['бел'],                words: ['oq', 'oppoq', 'white'] },
  { key: 'blue',   hex: '#2563eb',              stems: ['син', 'голуб'],       words: ["ko'k", 'kok', 'blue'] },
  { key: 'red',    hex: '#dc2626',              stems: ['красн'],              words: ['qizil', 'red'] },
  { key: 'green',  hex: '#16a34a',              stems: ['зелён', 'зелен'],     words: ['yashil', 'green'] },
  { key: 'gray',   hex: '#9ca3af',              stems: ['серый', 'серебр'],    words: ['kulrang', 'gray', 'grey', 'silver'] },
  { key: 'gold',   hex: '#d4af37',              stems: ['золот'],              words: ['tilla', 'gold'] },
  { key: 'pink',   hex: '#ec4899',              stems: ['розов'],              words: ['pushti', 'pink'] },
  { key: 'purple', hex: '#7c3aed',              stems: ['фиолет'],             words: ['binafsha', 'purple'] },
  { key: 'yellow', hex: '#eab308',              stems: ['жёлт', 'желт'],       words: ['sariq', 'yellow'] },
  { key: 'brown',  hex: '#78350f',              stems: ['коричн'],             words: ['jigarrang', 'brown'] },
  { key: 'beige',  hex: '#d2b48c', ring: true,  stems: ['беж'],                words: ['bej', 'beige'] },
]

// Localized color names — the badge shows the name in the current UI language.
export const COLOR_LABELS: Record<ColorKey, Record<BadgeLang, string>> = {
  black:  { uz: 'Qora',     ru: 'Чёрный',      en: 'Black'  },
  white:  { uz: 'Oq',       ru: 'Белый',       en: 'White'  },
  blue:   { uz: "Ko'k",     ru: 'Синий',       en: 'Blue'   },
  red:    { uz: 'Qizil',    ru: 'Красный',     en: 'Red'    },
  green:  { uz: 'Yashil',   ru: 'Зелёный',     en: 'Green'  },
  gray:   { uz: 'Kulrang',  ru: 'Серый',       en: 'Gray'   },
  gold:   { uz: 'Tilla',    ru: 'Золотой',     en: 'Gold'   },
  pink:   { uz: 'Pushti',   ru: 'Розовый',     en: 'Pink'   },
  purple: { uz: 'Binafsha', ru: 'Фиолетовый',  en: 'Purple' },
  yellow: { uz: 'Sariq',    ru: 'Жёлтый',      en: 'Yellow' },
  brown:  { uz: 'Jigar',    ru: 'Коричневый',  en: 'Brown'  },
  beige:  { uz: 'Bej',      ru: 'Бежевый',     en: 'Beige'  },
}

// Swatch metadata by resolved colour key — the companion to COLOR_LABELS, so a
// consumer holding a stored colour KEY (e.g. products.variant_color) can render
// the same swatch as ColorBadge without re-parsing a title. Null for unknown keys.
export function colorMetaFor(key: string | null | undefined): { hex: string; ring?: boolean } | null {
  if (!key) return null
  const r = RULES.find((x) => x.key === key)
  return r ? { hex: r.hex, ring: r.ring } : null
}

export function resolveColor(title?: string | null): ProductColor | null {
  if (!title) return null
  const t = title.toLowerCase()
  const tokens = new Set(t.split(/[^a-zа-яё']+/i).filter(Boolean))
  for (const r of RULES) {
    if (r.stems.some((s) => t.includes(s))) return { key: r.key, hex: r.hex, ring: r.ring }
    if (r.words.some((w) => tokens.has(w)))  return { key: r.key, hex: r.hex, ring: r.ring }
  }
  return null
}
