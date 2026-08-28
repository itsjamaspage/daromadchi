import { getSystemHealth } from '@/lib/db/system-health'
import { getLang } from '@/lib/server-i18n'
import StatusView from '@/components/dashboard/StatusView'

export const dynamic = 'force-dynamic'

type Lang = 'uz' | 'ru' | 'en'

export default async function StatusPage() {
  const [lang, health] = await Promise.all([getLang() as Promise<Lang>, getSystemHealth()])
  return <StatusView health={health} lang={lang} />
}
