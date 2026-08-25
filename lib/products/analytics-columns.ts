/**
 * Which columns the product-analytics table can show, and which the seller has
 * turned off.
 *
 * Fourteen columns is a lot to look at when you only came to check margin, so
 * the table gets a Настройки panel. This module is the single list both the
 * panel and the table read, so a column can never appear in one and not the
 * other.
 *
 * ── Stored as HIDDEN, not visible — the load-bearing choice ─────────────────
 * The saved preference is the set of columns the seller switched OFF. Storing
 * the visible set instead would mean any column added in a later release is
 * absent from every existing seller's saved list, so it would be invisible to
 * everyone who had ever opened this panel — silently, and only for the people
 * who had used the feature. Storing the hidden set makes a new column show up
 * by default, which is the behaviour a new column deserves.
 *
 * For the same reason an unknown key in stored preferences is dropped rather
 * than preserved: a column removed from the app should not keep occupying a
 * seller's saved state forever.
 */

export type ColumnGroup = 'sales' | 'money'

export interface ColumnDef {
  key: string
  /** Key into the dashboard i18n strings, so the panel and the table header
   *  cannot disagree about what a column is called. */
  labelKey: string
  group: ColumnGroup
  /** Never hideable. The product name identifies the row — without it the
   *  remaining numbers have no subject. */
  locked?: boolean
}

export const ANALYTICS_COLUMNS: ColumnDef[] = [
  { key: 'product',    labelKey: 'product',       group: 'sales', locked: true },
  { key: 'delivered',  labelKey: 'topSoldQty',    group: 'sales' },
  { key: 'inTransit',  labelKey: 'topSoldInTransit', group: 'sales' },
  { key: 'cancelled',  labelKey: 'topSoldCancelled', group: 'sales' },
  { key: 'returned',   labelKey: 'colReturned',   group: 'sales' },
  { key: 'returnRate', labelKey: 'colReturnRate', group: 'sales' },
  { key: 'revenue',    labelKey: 'topSoldRevenue', group: 'sales' },
  { key: 'salesShare', labelKey: 'colSalesShare', group: 'sales' },
  { key: 'avgPrice',   labelKey: 'colAvgPrice',   group: 'money' },
  { key: 'price',      labelKey: 'price',         group: 'money' },
  { key: 'cost',       labelKey: 'costPrice',     group: 'money' },
  { key: 'profit',     labelKey: 'profit',        group: 'money' },
  { key: 'margin',     labelKey: 'margin',        group: 'money' },
  { key: 'abc',        labelKey: 'colAbc',        group: 'sales' },
]

export const COLUMN_KEYS = ANALYTICS_COLUMNS.map(c => c.key)
const KNOWN = new Set(COLUMN_KEYS)
const LOCKED = new Set(ANALYTICS_COLUMNS.filter(c => c.locked).map(c => c.key))

/** Presets, as the "Минимум / Продажи / Все" chips. Values are what stays ON. */
export const COLUMN_PRESETS: Record<string, string[]> = {
  // What you came to check: did it sell, and does it earn.
  minimal: ['product', 'delivered', 'revenue', 'margin'],
  sales:   ['product', 'delivered', 'inTransit', 'cancelled', 'returned', 'returnRate', 'revenue', 'salesShare', 'abc'],
  money:   ['product', 'revenue', 'avgPrice', 'price', 'cost', 'profit', 'margin'],
  all:     COLUMN_KEYS,
}

/** The hidden set a preset implies. Locked columns can never be hidden. */
export function hiddenForPreset(preset: string): string[] {
  const on = new Set(COLUMN_PRESETS[preset] ?? COLUMN_KEYS)
  return COLUMN_KEYS.filter(k => !on.has(k) && !LOCKED.has(k))
}

/**
 * Clean a stored hidden-set into one we will act on.
 *
 * Drops unknown keys (a column the app no longer has) and locked ones (a
 * corrupted or hand-edited preference must not be able to hide the product
 * name and leave a table of anonymous numbers).
 */
export function normalizeHidden(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return [...new Set(
    raw.filter((k): k is string => typeof k === 'string' && KNOWN.has(k) && !LOCKED.has(k)),
  )]
}

/** True when a column should be rendered. */
export function isVisible(key: string, hidden: readonly string[]): boolean {
  if (LOCKED.has(key)) return true
  return !hidden.includes(key)
}

/** How many columns are on — for the "7 / 14" counter in the panel. */
export function visibleCount(hidden: readonly string[]): number {
  return COLUMN_KEYS.filter(k => isVisible(k, hidden)).length
}

export const COLUMN_PREFS_STORAGE_KEY = 'daromadchi.analytics.hiddenColumns.v1'
