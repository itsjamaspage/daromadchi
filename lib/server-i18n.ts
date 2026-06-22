import { cookies } from 'next/headers'
import { translations, type Lang } from './i18n'

export async function getT() {
  const store = await cookies()
  const lang = (store.get('lang')?.value ?? 'uz') as Lang
  return translations[lang]
}

export async function getLang(): Promise<Lang> {
  const store = await cookies()
  return (store.get('lang')?.value ?? 'uz') as Lang
}
