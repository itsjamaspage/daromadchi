import { cookies } from 'next/headers'
import type { Lang } from './i18n'

export { dashT } from './dashT'

export async function getLang(): Promise<Lang> {
  const jar = await cookies()
  const val = jar.get('lang')?.value
  return (val === 'ru' || val === 'en' || val === 'uz') ? val : 'uz'
}
