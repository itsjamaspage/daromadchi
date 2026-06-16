import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/api/auth'
import { verifyPaymeAuth, PaymeError } from '@/lib/billing/payme'
import { planExpiresAt } from '@/lib/billing/plans'

function rpc(id: unknown, result: unknown) {
  return NextResponse.json({ jsonrpc: '2.0', id, result })
}
function rpcErr(id: unknown, code: number, message: unknown) {
  return NextResponse.json({ jsonrpc: '2.0', id, error: { code, message } })
}

const STATE = { PENDING: 1, PAID: 2, CANCELLED: -1 } as const

export async function POST(req: NextRequest) {
  if (!verifyPaymeAuth(req.headers.get('authorization'))) {
    return rpcErr(null, PaymeError.FORBIDDEN.code, PaymeError.FORBIDDEN.message)
  }

  const body = await req.json().catch(() => null)
  if (!body) return rpcErr(null, -32700, 'Parse error')

  const { method, params, id } = body

  // ── CheckPerformTransaction ──────────────────────────────────────────────
  if (method === 'CheckPerformTransaction') {
    const paymentId = params?.account?.payment_id
    const { data: p } = await supabaseAdmin.from('payments').select('id, amount, status').eq('id', paymentId).maybeSingle()
    if (!p) return rpcErr(id, PaymeError.ORDER_NOT_FOUND.code, PaymeError.ORDER_NOT_FOUND.message)
    if (params.amount !== p.amount * 100) return rpcErr(id, PaymeError.INVALID_AMOUNT.code, PaymeError.INVALID_AMOUNT.message)
    if (p.status !== 'pending') return rpcErr(id, PaymeError.CANT_PERFORM.code, PaymeError.CANT_PERFORM.message)
    return rpc(id, { allow: true })
  }

  // ── CreateTransaction ────────────────────────────────────────────────────
  if (method === 'CreateTransaction') {
    const paymentId    = params?.account?.payment_id
    const paymeTransId = params.id as string
    const { data: p } = await supabaseAdmin.from('payments').select('id, amount, status, provider_transaction_id').eq('id', paymentId).maybeSingle()
    if (!p) return rpcErr(id, PaymeError.ORDER_NOT_FOUND.code, PaymeError.ORDER_NOT_FOUND.message)
    if (params.amount !== p.amount * 100) return rpcErr(id, PaymeError.INVALID_AMOUNT.code, PaymeError.INVALID_AMOUNT.message)
    if (p.status !== 'pending' && p.provider_transaction_id !== paymeTransId) {
      return rpcErr(id, PaymeError.CANT_PERFORM.code, PaymeError.CANT_PERFORM.message)
    }
    if (!p.provider_transaction_id) {
      await supabaseAdmin.from('payments').update({ provider_transaction_id: paymeTransId, updated_at: new Date().toISOString() }).eq('id', paymentId)
    }
    return rpc(id, { create_time: params.time, transaction: paymentId, state: STATE.PENDING })
  }

  // ── PerformTransaction ───────────────────────────────────────────────────
  if (method === 'PerformTransaction') {
    const paymeTransId = params.id as string
    const { data: p } = await supabaseAdmin.from('payments').select('id, user_id, plan, period_months, status').eq('provider_transaction_id', paymeTransId).maybeSingle()
    if (!p) return rpcErr(id, PaymeError.TRANS_NOT_FOUND.code, PaymeError.TRANS_NOT_FOUND.message)
    if (p.status === 'cancelled') return rpcErr(id, PaymeError.CANT_PERFORM.code, PaymeError.CANT_PERFORM.message)
    if (p.status === 'paid') return rpc(id, { perform_time: Date.now(), transaction: p.id, state: STATE.PAID })

    const now = Date.now()
    await Promise.all([
      supabaseAdmin.from('payments').update({ status: 'paid', updated_at: new Date().toISOString() }).eq('id', p.id),
      supabaseAdmin.from('users').update({ plan: p.plan, plan_expires_at: planExpiresAt(p.period_months) }).eq('id', p.user_id),
    ])
    return rpc(id, { perform_time: now, transaction: p.id, state: STATE.PAID })
  }

  // ── CancelTransaction ────────────────────────────────────────────────────
  if (method === 'CancelTransaction') {
    const paymeTransId = params.id as string
    const { data: p } = await supabaseAdmin.from('payments').select('id, status').eq('provider_transaction_id', paymeTransId).maybeSingle()
    if (!p) return rpcErr(id, PaymeError.TRANS_NOT_FOUND.code, PaymeError.TRANS_NOT_FOUND.message)
    if (p.status === 'paid') return rpcErr(id, PaymeError.CANT_PERFORM.code, PaymeError.CANT_PERFORM.message)
    await supabaseAdmin.from('payments').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', p.id)
    return rpc(id, { cancel_time: Date.now(), transaction: p.id, state: STATE.CANCELLED })
  }

  // ── CheckTransaction ─────────────────────────────────────────────────────
  if (method === 'CheckTransaction') {
    const paymeTransId = params.id as string
    const { data: p } = await supabaseAdmin.from('payments').select('id, status, created_at').eq('provider_transaction_id', paymeTransId).maybeSingle()
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
    const from = new Date(params.from).toISOString()
    const to   = new Date(params.to).toISOString()
    const { data: rows } = await supabaseAdmin
      .from('payments')
      .select('id, amount, status, created_at, provider_transaction_id')
      .eq('provider', 'payme')
      .gte('created_at', from)
      .lte('created_at', to)

    const transactions = (rows ?? []).map(p => {
      const stateMap: Record<string, number> = { pending: STATE.PENDING, paid: STATE.PAID, cancelled: STATE.CANCELLED, failed: -2 }
      return {
        id:           p.provider_transaction_id,
        time:         new Date(p.created_at).getTime(),
        amount:       p.amount * 100,
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
}
