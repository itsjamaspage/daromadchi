import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'

const MIGRATION_USER_PASSWORD = 'ChangeMe_123!'

async function migrateUsers() {
  console.log('Starting auth migration...')

  const allUsers = await db.query.users.findMany()

  let migratedCount = 0
  let skippedCount = 0

  for (const user of allUsers) {
    if (user.password_hash) {
      console.log(`✓ Skipping ${user.email} (already migrated)`)
      skippedCount++
      continue
    }

    const hash = await bcrypt.hash(MIGRATION_USER_PASSWORD, 12)

    await db
      .update(users)
      .set({
        password_hash: hash,
      })
      .where(eq(users.id, user.id))

    console.log(`✓ Migrated ${user.email} with temporary password`)
    migratedCount++
  }

  console.log(`\nMigration complete!`)
  console.log(`Migrated: ${migratedCount}, Skipped: ${skippedCount}`)
}

migrateUsers().catch(error => {
  console.error('Migration failed:', error)
  process.exit(1)
})
