import type { Lang } from '@/lib/i18n'

const LABELS: Record<string, Record<Lang, string>> = {
  PICKUP_EXPIRED:          { uz: 'PVZ dan olinmadi',   ru: 'Не забрал из ПВЗ',    en: 'Not collected' },
  FULL_NOT_RANSOM:         { uz: 'Olinmadi (невыкуп)', ru: 'Невыкуп',              en: 'Not collected' },
  USER_NOT_RECEIVED:       { uz: 'Qabul qilmadi',      ru: 'Не получил',           en: 'Not received' },
  DELIVERY_SERVICE_FAILED: { uz: 'Yetkazib berilmadi',  ru: 'Ошибка доставки',      en: 'Delivery failed' },
  USER_REFUSED_DELIVERY:   { uz: 'Rad etdi',            ru: 'Отказ от доставки',     en: 'Refused delivery' },
  USER_REFUSED_PRODUCT:    { uz: 'Tovarni rad etdi',    ru: 'Отказ от товара',       en: 'Refused product' },
  USER_REFUSED_QUALITY:    { uz: 'Sifat rad etildi',    ru: 'Отказ по качеству',     en: 'Refused quality' },
  USER_CHANGED_MIND:       { uz: "Fikrdan qaytdi",      ru: 'Передумал',             en: 'Changed mind' },
  REPLACING_ORDER:         { uz: 'Almashtirildi',       ru: 'Замена заказа',         en: 'Replaced' },
  EXPIRED:                 { uz: 'PVZ dan olinmadi',   ru: 'Не забрал из ПВЗ',    en: 'Not collected' },
}

export function returnReasonLabel(
  substatus: string | null | undefined,
  marketplaceStatus: string | null | undefined,
  lang: Lang,
): string | null {
  const key = substatus ?? marketplaceStatus
  if (!key) return null
  return LABELS[key]?.[lang] ?? null
}
