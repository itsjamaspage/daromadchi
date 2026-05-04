import { createClient } from '@/lib/supabase/server'
import SettingsForm from './SettingsForm'
import type { Shop } from '@/lib/types'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let shop: Shop | null = null

  if (user) {
    const { data } = await supabase
      .from('shops')
      .select('*')
      .eq('user_id', user.id)
      .eq('marketplace', 'uzum')
      .order('created_at')
      .limit(1)
      .single()
    if (data) shop = data as Shop
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Sozlamalar</h1>
        <p className="text-slate-400 text-sm mt-1">Do&apos;kon va integratsiya sozlamalari</p>
      </div>
      <SettingsForm shop={shop} />
    </div>
  )
}
