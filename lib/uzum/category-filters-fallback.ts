// Hardcoded Uzum category filter definitions for categories where the template
// and GraphQL API may not return complete data.
// Sourced from the Uzum seller cabinet UI.

export interface UzumFilterDef {
  name: string
  type: 'SINGLE_CHOICE' | 'MULTI_CHOICE' | 'NUMBER' | 'TEXT'
  required: boolean
  min?: number
  max?: number
  values?: string[]
}

const CATEGORY_FILTERS: Record<number, UzumFilterDef[]> = {
  // Внешние аккумуляторы (Power banks)
  14037: [
    { name: 'Гарантия', type: 'SINGLE_CHOICE', required: false },
    { name: 'Страна производства', type: 'SINGLE_CHOICE', required: false },
    { name: 'Бренд (тест)', type: 'TEXT', required: false },
    { name: 'Ёмкость аккумулятора', type: 'NUMBER', required: true, min: 500, max: 50000 },
    { name: 'Номинальная емкость', type: 'NUMBER', required: false, min: 500, max: 50000 },
    { name: 'Максимальная мощность', type: 'NUMBER', required: true, min: 1, max: 200 },
    { name: 'Выходное напряжение', type: 'NUMBER', required: false, min: 1, max: 200 },
    { name: 'Выходной ток', type: 'NUMBER', required: false, min: 1, max: 10 },
    { name: 'Количество выходов', type: 'NUMBER', required: true, min: 1, max: 10 },
    { name: 'Разъём', type: 'MULTI_CHOICE', required: true },
    { name: 'Быстрая зарядка', type: 'SINGLE_CHOICE', required: true },
    { name: 'Беспроводная зарядка', type: 'SINGLE_CHOICE', required: false },
    { name: 'Стандарт зарядки', type: 'SINGLE_CHOICE', required: false },
    { name: 'Стандарт беспроводной зарядки', type: 'SINGLE_CHOICE', required: false },
    { name: 'Солнечная панель', type: 'SINGLE_CHOICE', required: false },
    { name: 'Дисплей', type: 'SINGLE_CHOICE', required: false },
    { name: 'Индикатор заряда', type: 'SINGLE_CHOICE', required: false },
    { name: 'Материал корпуса', type: 'SINGLE_CHOICE', required: true },
    { name: 'Система защиты', type: 'SINGLE_CHOICE', required: false },
  ],
}

export function getCategoryFiltersFallback(categoryId: number): UzumFilterDef[] {
  return CATEGORY_FILTERS[categoryId] ?? []
}
