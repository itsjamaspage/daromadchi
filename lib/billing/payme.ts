const MERCHANT_ID = process.env.PAYME_MERCHANT_ID ?? ''
const SECRET_KEY  = process.env.PAYME_SECRET_KEY  ?? ''
const BASE_URL    = process.env.NEXT_PUBLIC_APP_URL ?? 'https://daromadchi.uz'

// Payme expects amounts in tiyin (1 so'm = 100 tiyin)
export function paymePaymentUrl(paymentId: string, amountSom: number): string {
  const params = `m=${MERCHANT_ID};ac.payment_id=${paymentId};a=${amountSom * 100};l=uz;c=${BASE_URL}/billing/success?provider=payme`
  return `https://checkout.paycom.uz/${Buffer.from(params).toString('base64')}`
}

export function verifyPaymeAuth(authHeader: string | null): boolean {
  if (!authHeader) return false
  const encoded = Buffer.from(`Paycom:${SECRET_KEY}`).toString('base64')
  return authHeader === `Basic ${encoded}`
}

export const PaymeError = {
  INVALID_AMOUNT:    { code: -31001, message: { uz: 'Noto\'g\'ri summa',           ru: 'Неверная сумма',         en: 'Invalid amount'            } },
  ORDER_NOT_FOUND:   { code: -31050, message: { uz: 'To\'lov topilmadi',           ru: 'Платёж не найден',       en: 'Payment not found'         } },
  CANT_PERFORM:      { code: -31008, message: { uz: 'Amaliyotni bo\'lmaydi',       ru: 'Нельзя выполнить',       en: 'Cannot perform operation'  } },
  TRANS_NOT_FOUND:   { code: -31003, message: { uz: 'Tranzaksiya topilmadi',       ru: 'Транзакция не найдена',  en: 'Transaction not found'     } },
  FORBIDDEN:         { code: -32504, message: { uz: 'Ruxsat yo\'q',                ru: 'Нет доступа',            en: 'Forbidden'                 } },
} as const
