import { createClient } from '@/lib/supabase/server'
import SettingsForm from './SettingsForm'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let profile: { store_name: string | null; uzum_api_token: string | null; last_synced_at: string | null } = {
    store_name: null,
    uzum_api_token: null,
    last_synced_at: null,
  }

  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('store_name, uzum_api_token, last_synced_at')
      .eq('id', user.id)
      .single()
    if (data) profile = data as typeof profile
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Sozlamalar</h1>
        <p className="text-slate-400 text-sm mt-1">Do&apos;kon va integratsiya sozlamalari</p>
      </div>
      <SettingsForm
        storeName={profile.store_name ?? ''}
        hasToken={!!profile.uzum_api_token}
        lastSyncedAt={profile.last_synced_at}
      />
    </div>
  )
}
