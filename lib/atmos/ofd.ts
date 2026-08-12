/**
 * OFD / fiscal-receipt configuration for subscription charges.
 *
 * ⚠️⚠️ PLACEHOLDER — MUST be set before go-live. A fiscal receipt needs a valid
 * IKPU/OFD code for the SERVICE being sold. The existing smartwatch IKPU
 * (08517002028000000) will NOT correctly fiscalize a software subscription — the
 * SaaS/IT-services taxonomy code is required. Do NOT ship with the placeholder:
 * receipts issued against it are invalid.
 */

import type { AtmosOfdItem } from './client'

// TODO(atmos/ofd): replace with the real SaaS-subscription IKPU code.
export const SAAS_SUBSCRIPTION_IKPU = '__SET_SAAS_IKPU_BEFORE_GO_LIVE__'

// TODO(atmos/ofd): confirm the VAT treatment for SaaS subscriptions.
export const SAAS_VAT_PERCENT = 0

export function isOfdConfigured(): boolean {
  return !SAAS_SUBSCRIPTION_IKPU.startsWith('__')
}

// Build the single OFD line for a subscription charge. `amountTiyin` is the full
// charged amount (tiyin); the line is quantity 1 at that price.
export function buildSubscriptionOfdItems(planLabel: string, amountTiyin: number): AtmosOfdItem[] {
  return [
    {
      ikpu: SAAS_SUBSCRIPTION_IKPU,
      title: planLabel,
      price: amountTiyin,
      count: 1,
      vat_percent: SAAS_VAT_PERCENT,
    },
  ]
}
