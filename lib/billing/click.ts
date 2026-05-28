import crypto from 'crypto'

const SERVICE_ID  = process.env.CLICK_SERVICE_ID  ?? ''
const MERCHANT_ID = process.env.CLICK_MERCHANT_ID ?? ''
const SECRET_KEY  = process.env.CLICK_SECRET_KEY  ?? ''
const BASE_URL    = process.env.NEXT_PUBLIC_APP_URL ?? 'https://daromadchi.uz'

export function clickPaymentUrl(paymentId: string, amount: number): string {
  const params = new URLSearchParams({
    service_id:        SERVICE_ID,
    merchant_id:       MERCHANT_ID,
    amount:            String(amount),
    transaction_param: paymentId,
    return_url:        `${BASE_URL}/billing/success?provider=click`,
  })
  return `https://my.click.uz/pay/service/?${params}`
}

// Click error codes
export const ClickError = {
  SIGN_FAILED:       { error: -1,  error_note: 'SIGN CHECK FAILED'            },
  WRONG_AMOUNT:      { error: -2,  error_note: 'Incorrect parameter amount'   },
  NOT_FOUND:         { error: -5,  error_note: 'User does not exist'          },
  ALREADY_PAID:      { error: -4,  error_note: 'Already paid'                 },
  TRANS_NOT_FOUND:   { error: -6,  error_note: 'Transaction does not exist'   },
} as const

export function verifyClickSign(opts: {
  clickTransId:      string
  merchantTransId:   string
  amount:            string
  action:            string
  signTime:          string
  merchantPrepareId: string | null
  incoming:          string
}): boolean {
  const parts =
    opts.action === '1'
      ? [opts.clickTransId, SERVICE_ID, SECRET_KEY, opts.merchantTransId, opts.merchantPrepareId ?? '', opts.amount, opts.action, opts.signTime]
      : [opts.clickTransId, SERVICE_ID, SECRET_KEY, opts.merchantTransId, opts.amount, opts.action, opts.signTime]
  const expected = crypto.createHash('md5').update(parts.join('')).digest('hex')
  return expected === opts.incoming
}
