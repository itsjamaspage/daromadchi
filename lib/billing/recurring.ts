import 'server-only'
import { payCreate, payPreApply, payApply, TOKEN_PAYMENT_OTP, mpsPreCreate, mpsCreateBind } from './atmos'

/**
 * Charge a previously-bound card by its reusable token (UzCard/Humo direct flow).
 * The full three-call ATMOS sequence (create → pre-apply → apply) in one place.
 *
 * `account` must be an already-persisted payments.account (our internal id) so the
 * server-to-server callback can look it up. For token payments the apply OTP is the
 * LITERAL "111111" — no SMS is sent. Throws AtmosApiError on any non-OK step; NEVER
 * retry apply blindly (double-charge risk) — the caller decides.
 */
export async function chargeBoundCard(
  account: string,
  amountTiyin: number,
  cardToken: string,
  onCreated?: (transactionId: string) => Promise<void> | void,
): Promise<{ transactionId: string }> {
  const { transactionId } = await payCreate(account, amountTiyin)
  if (onCreated) await onCreated(transactionId)
  await payPreApply(transactionId, cardToken)
  await payApply(transactionId, TOKEN_PAYMENT_OTP)
  return { transactionId }
}

/**
 * Charge a card_id-bound card via MPS (Visa/Mastercard hosted-bind flow).
 * Two-call sequence: pre-create → create/bind. Instant — no OTP.
 */
export async function chargeBoundCardMps(
  account: string,
  amountTiyin: number,
  cardId: string,
  onCreated?: (transactionId: string) => Promise<void> | void,
): Promise<{ transactionId: string }> {
  const pre = await mpsPreCreate({
    amountTiyin,
    extId: account,
    account,
  })
  if (onCreated) await onCreated(pre.transactionId)
  const result = await mpsCreateBind({
    cardId,
    amountTiyin,
    transactionId: pre.transactionId,
  })
  return { transactionId: result.transactionId }
}
