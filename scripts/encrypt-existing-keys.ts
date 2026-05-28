// Encrypt any plaintext api_key_encrypted values already in the database.
// Run once after adding ENCRYPTION_KEY to the environment:
//   ENCRYPTION_KEY=<your-key> npx tsx scripts/encrypt-existing-keys.ts
//
// Safe to run multiple times — skips rows already in iv:tag:ciphertext format.

import { createClient } from '@supabase/supabase-js'
import { encrypt, isEncrypted } from '../lib/crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

async function main() {
  const { data: shops, error } = await supabase
    .from('shops')
    .select('id, marketplace, api_key_encrypted')
    .not('api_key_encrypted', 'is', null)

  if (error) { console.error('DB error:', error.message); process.exit(1) }
  if (!shops?.length) { console.log('No shops with API keys found.'); return }

  let encrypted = 0
  let skipped   = 0

  for (const shop of shops) {
    const stored = shop.api_key_encrypted as string
    if (isEncrypted(stored)) {
      skipped++
      continue
    }
    const { error: upErr } = await supabase
      .from('shops')
      .update({ api_key_encrypted: encrypt(stored) })
      .eq('id', shop.id)

    if (upErr) {
      console.error(`Failed shop ${shop.id} (${shop.marketplace}):`, upErr.message)
    } else {
      encrypted++
      console.log(`✅ Encrypted: ${shop.id} (${shop.marketplace})`)
    }
  }

  console.log(`\nDone — ${encrypted} encrypted, ${skipped} already encrypted.`)
}

main()
