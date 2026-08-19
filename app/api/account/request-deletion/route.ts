import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { sendAccountDeletionRequest } from '@/lib/email'
import { sendTelegramMessage } from '@/lib/telegram'
import { withErrorHandler } from '@/lib/api-handler'
import { logger } from '@/lib/logger'
import { ADMIN_CHAT_IDS } from '@/lib/telegram-admin'

export const runtime = 'nodejs'

// Admin chats that receive operational alerts (the same ones the feedback flow
// uses), from TELEGRAM_ADMIN_CHAT_ID.

// User-facing "Request account deletion". A logged-in user asks for their
// account to be deleted; we notify the operator (email to privacy@ + Telegram)
// and confirm receipt. This does NOT delete anything — deletion stays a
// controlled admin action (app/api/auth/delete-account) and, once processed,
// removes personal data via cascade while retaining anonymized payment records.
export const POST = withErrorHandler(async () => {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const requestedAt = new Date().toISOString()

  // Both notifications are best-effort — a failure in one must not lose the
  // request, and the user still gets a confirmation. At least one channel
  // (email or Telegram) reaching the operator is enough to action it.
  const results = await Promise.allSettled([
    sendAccountDeletionRequest(user.email, user.id, requestedAt),
    // One entry in `results`, however many operators are configured, so the
    // telegramOk bookkeeping below stays right.
    Promise.all(ADMIN_CHAT_IDS.map(chatId => sendTelegramMessage(
      chatId,
      `🗑️ <b>Account deletion request</b>\nEmail: ${user.email}\nUser ID: <code>${user.id}</code>\nRequested: ${requestedAt}`,
    ))),
  ])
  const delivered = results.some(r => r.status === 'fulfilled')
  logger.info('account_deletion_requested', {
    userId: user.id,
    emailOk: results[0].status === 'fulfilled',
    telegramOk: results[1].status === 'fulfilled',
  })

  return NextResponse.json({
    ok: true,
    delivered,
    message: 'Your account-deletion request has been received and will be processed.',
  })
})
