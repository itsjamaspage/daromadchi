import { getSyncInfo } from '@/lib/db/shop-context'
import LastSynced from './LastSynced'

export default async function LastSyncedServer() {
  const { lastSyncedAt, lastSyncFailed } = await getSyncInfo()
  return <LastSynced lastSyncedAt={lastSyncedAt} lastSyncFailed={lastSyncFailed} />
}
