import { NextRequest, NextResponse } from 'next/server'
import { eq, and, gte, lte } from 'drizzle-orm'
import { db, payments, users } from '@/lib/db'
import { verifyPaymeAuth, PaymeError } from '@/lib/billing/payme'
import { planExpiresAt } from '@/lib/billing/plans'
import { withErrorHandler } from '@/lib/api-handler'

function rpc(id: unknown, result: unknown) {
  return NextResponse.json({ jsonrpc: '2.0', id, result })
}
function rpcErr(id: unknown, code: number, message: unknown) {
  return NextResponse.json({ jsonrpc: '2.0', id, error: { code, message } })
}

const STATE = { PENDING: 1, PAID: 2, CANCELLED: -1 } as const

export const POST = withErrorHandler(async (req: NextRequest) => {
  if (!verifyPaymeAuth(req.headers.get('authorization'))) {
    return rpcErr(null, PaymeError.FORBIDDEN.code, PaymeError.FORBIDDEN.message)
  }

  const body = await req.json().catch(() => null)
  if (!body) return rpcErr(null, -32700, 'Parse error')

  const { method, params, id } = body

  // ── CheckPerformTransaction ──────────────────────────────────────────────
  if (method === 'CheckPerformTransaction') {
    const paymentId = params?.account?.payment_id
    const [p] = await db.select({ id: payments.id, amount: payments.amount, status: payments.status })
      .from(payments).where(eq(payments.id, paymentId)).limit(1)
    if (!p) return rpcErr(id, PaymeError.ORDER_NOT_FOUND.code, PaymeError.ORDER_NOT_FOUND.message)
    if (params.amount !== Number(p.amount) * 100) return rpcErr(id, PaymeError.INVALID_AMOUNT.code, PaymeError.INVALID_AMOUNT.message)
    if (p.status !== 'pending') return rpcErr(id, PaymeError.CANT_PERFORM.code, PaymeError.CANT_PERFORM.message)
    return rpc(id, { allow: true })
  }

  // ── CreateTransaction ────────────────────────────────────────────────────
  if (method === 'CreateTransaction') {
    const paymentId    = params?.account?.payment_id
    const paymeTransId = params.id as string
    const [p] = await db.select({
      id: payments.id, amount: payments.amount, status: payments.status,
      provider_transaction_id: payments.provider_transaction_id,
    }).from(payments).where(eq(payments.id, paymentId)).limit(1)
    if (!p) return rpcErr(id, PaymeError.ORDER_NOT_FOUND.code, PaymeError.ORDER_NOT_FOUND.message)
    if (params.amount !== Number(p.amount) * 100) return rpcErr(id, PaymeError.INVALID_AMOUNT.code, PaymeError.INVALID_AMOUNT.message)
    if (p.status !== 'pending' && p.provider_transaction_id !== paymeTransId) {
      return rpcErr(id, PaymeError.CANT_PERFORM.code, PaymeError.CANT_PERFORM.message)
    }
    if (!p.provider_transaction_id) {
      await db.update(payments)
        .set({ provider_transaction_id: paymeTransId, updated_at: new Date() })
        .where(eq(payments.id, paymentId))
    }
    return rpc(id, { create_time: params.time, transaction: paymentId, state: STATE.PENDING })
  }

  // ── PerformTransaction ───────────────────────────────────────────────────
  if (method === 'PerformTransaction') {
    const paymeTransId = params.id as string
    const [p] = await db.select({
      id: payments.id, user_id: payments.user_id, plan: payments.plan,
      period_months: payments.period_months, status: payments.status,
    }).from(payments).where(eq(payments.provider_transaction_id, paymeTransId)).limit(1)
    if (!p) return rpcErr(id, PaymeError.TRANS_NOT_FOUND.code, PaymeError.TRANS_NOT_FOUND.message)
    if (p.status === 'cancelled') return rpcErr(id, PaymeError.CANT_PERFORM.code, PaymeError.CANT_PERFORM.message)
    if (p.status === 'paid') return rpc(id, { perform_time: Date.now(), transaction: p.id, state: STATE.PAID })

    const now = Date.now()
    // payments.user_id is nullable (SET NULL on account deletion), but an active
    // checkout always has one; guard so a detached row can't crash completion.
    await Promise.all([
      db.update(payments).set({ status: 'paid', updated_at: new Date() }).where(eq(payments.id, p.id)),
      p.user_id
        ? db.update(users).set({
            plan: p.plan as 'free' | 'pro' | 'pro_plus',
            plan_expires_at: new Date(planExpiresAt(p.period_months)),
            // Re-subscribe clears the post-cancellation retention clock so the
            // account and its data are preserved (never reaches the 30-day purge).
            plan_cancelled_at: null,
          }).where(eq(users.id, p.user_id))
        : Promise.resolve(),
    ])
    return rpc(id, { perform_time: now, transaction: p.id, state: STATE.PAID })
  }

  // ── CancelTransaction ────────────────────────────────────────────────────
  if (method === 'CancelTransaction') {
    const paymeTransId = params.id as string
    const [p] = await db.select({ id: payments.id, status: payments.status })
      .from(payments).where(eq(payments.provider_transaction_id, paymeTransId)).limit(1)
    if (!p) return rpcErr(id, PaymeError.TRANS_NOT_FOUND.code, PaymeError.TRANS_NOT_FOUND.message)
    if (p.status === 'paid') return rpcErr(id, PaymeError.CANT_PERFORM.code, PaymeError.CANT_PERFORM.message)
    await db.update(payments).set({ status: 'cancelled', updated_at: new Date() }).where(eq(payments.id, p.id))
    return rpc(id, { cancel_time: Date.now(), transaction: p.id, state: STATE.CANCELLED })
  }

  // ── CheckTransaction ─────────────────────────────────────────────────────
  if (method === 'CheckTransaction') {
    const paymeTransId = params.id as string
    const [p] = await db.select({
      id: payments.id, status: payments.status, created_at: payments.created_at,
    }).from(payments).where(eq(payments.provider_transaction_id, paymeTransId)).limit(1)
    if (!p) return rpcErr(id, PaymeError.TRANS_NOT_FOUND.code, PaymeError.TRANS_NOT_FOUND.message)
    const stateMap: Record<string, number> = { pending: STATE.PENDING, paid: STATE.PAID, cancelled: STATE.CANCELLED, failed: -2 }
    return rpc(id, {
      create_time:  new Date(p.created_at).getTime(),
      perform_time: p.status === 'paid'      ? Date.now() : 0,
      cancel_time:  p.status === 'cancelled' ? Date.now() : 0,
      transaction:  p.id,
      state:        stateMap[p.status] ?? STATE.PENDING,
      reason:       null,
    })
  }

  // ── GetStatement ─────────────────────────────────────────────────────────
  if (method === 'GetStatement') {
    const from = new Date(params.from)
    const to   = new Date(params.to)
    const rows = await db.select({
      id: payments.id, amount: payments.amount, status: payments.status,
      created_at: payments.created_at, provider_transaction_id: payments.provider_transaction_id,
    }).from(payments).where(and(
      eq(payments.provider, 'payme'),
      gte(payments.created_at, from),
      lte(payments.created_at, to),
    ))

    const transactions = rows.map(p => {
      const stateMap: Record<string, number> = { pending: STATE.PENDING, paid: STATE.PAID, cancelled: STATE.CANCELLED, failed: -2 }
      return {
        id:           p.provider_transaction_id,
        time:         new Date(p.created_at).getTime(),
        amount:       Number(p.amount) * 100,
        account:      { payment_id: p.id },
        create_time:  new Date(p.created_at).getTime(),
        perform_time: p.status === 'paid'      ? new Date(p.created_at).getTime() : 0,
        cancel_time:  p.status === 'cancelled' ? new Date(p.created_at).getTime() : 0,
        transaction:  p.id,
        state:        stateMap[p.status] ?? STATE.PENDING,
        reason:       null,
      }
    })
    return rpc(id, { transactions })
  }

  return rpcErr(id, -32601, 'Method not found')
})
