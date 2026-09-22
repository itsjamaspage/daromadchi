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

const YES_NO = ['Да', 'Нет']

const CATEGORY_FILTERS: Record<number, UzumFilterDef[]> = {
  // Внешние аккумуляторы (Power banks)
  14037: [
    { name: 'Гарантия', type: 'SINGLE_CHOICE', required: false, values: [
      '1 месяц', '3 месяца', '6 месяцев', '12 месяцев', '24 месяца', '36 месяцев', 'Без гарантии',
    ] },
    { name: 'Страна производства', type: 'SINGLE_CHOICE', required: false, values: [
      'Китай', 'Узбекистан', 'Россия', 'Южная Корея', 'Япония', 'Германия', 'США', 'Турция', 'Вьетнам', 'Индия', 'Тайвань',
    ] },
    { name: 'Бренд (тест)', type: 'TEXT', required: false },
    { name: 'Ёмкость аккумулятора', type: 'NUMBER', required: true, min: 500, max: 50000 },
    { name: 'Номинальная емкость', type: 'NUMBER', required: false, min: 500, max: 50000 },
    { name: 'Максимальная мощность', type: 'NUMBER', required: true, min: 1, max: 200 },
    { name: 'Выходное напряжение', type: 'NUMBER', required: false, min: 1, max: 200 },
    { name: 'Выходной ток', type: 'NUMBER', required: false, min: 1, max: 10 },
    { name: 'Количество выходов', type: 'NUMBER', required: true, min: 1, max: 10 },
    { name: 'Разъём', type: 'MULTI_CHOICE', required: true, values: [
      'USB Type-C', 'USB Type-A', 'Micro USB', 'Lightning',
    ] },
    { name: 'Быстрая зарядка', type: 'SINGLE_CHOICE', required: true, values: YES_NO },
    { name: 'Беспроводная зарядка', type: 'SINGLE_CHOICE', required: false, values: YES_NO },
    { name: 'Стандарт зарядки', type: 'SINGLE_CHOICE', required: false, values: [
      'Quick Charge 2.0', 'Quick Charge 3.0', 'Quick Charge 4.0', 'USB Power Delivery', 'VOOC', 'Dash Charge', 'Super Charge', 'Adaptive Fast Charging',
    ] },
    { name: 'Стандарт беспроводной зарядки', type: 'SINGLE_CHOICE', required: false, values: [
      'Qi', 'MagSafe', 'Qi2',
    ] },
    { name: 'Солнечная панель', type: 'SINGLE_CHOICE', required: false, values: YES_NO },
    { name: 'Дисплей', type: 'SINGLE_CHOICE', required: false, values: YES_NO },
    { name: 'Индикатор заряда', type: 'SINGLE_CHOICE', required: false, values: YES_NO },
    { name: 'Материал корпуса', type: 'SINGLE_CHOICE', required: true, values: [
      'Пластик', 'Металл', 'Комбинированный', 'Алюминий', 'Поликарбонат',
    ] },
    { name: 'Система защиты', type: 'SINGLE_CHOICE', required: false, values: YES_NO },
  ],
}

export function getCategoryFiltersFallback(categoryId: number): UzumFilterDef[] {
  return CATEGORY_FILTERS[categoryId] ?? []
}
