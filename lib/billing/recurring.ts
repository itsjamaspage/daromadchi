import 'server-only'
import { payCreate, payPreApply, payApply, TOKEN_PAYMENT_OTP } from './atmos'

/**
 * Charge a previously-bound card by its reusable token. The full three-call ATMOS
 * sequence (create → pre-apply → apply) in one place, shared by the first
 * interactive charge (bind-confirm) and the auto-renewal cron.
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
  // Called with the pay/create transaction id BEFORE pay/apply, so the caller can
  // persist it (payments.atmos_payment_id) while the charge is still in flight —
  // the ATMOS callback fires DURING pay/apply and needs it to match cleanly.
  onCreated?: (transactionId: string) => Promise<void> | void,
): Promise<{ transactionId: string }> {
  const { transactionId } = await payCreate(account, amountTiyin)
  if (onCreated) await onCreated(transactionId)
  await payPreApply(transactionId, cardToken)
  await payApply(transactionId, TOKEN_PAYMENT_OTP)
  return { transactionId }
}
