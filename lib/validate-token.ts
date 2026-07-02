import type { MarketplaceType } from '@/lib/types'
import { marketplaceFetch } from '@/lib/marketplace-readonly-guard'
import { logger } from '@/lib/logger'

export async function validateMarketplaceToken(
  marketplace: MarketplaceType,
  token: string,
): Promise<boolean> {
  try {
    switch (marketplace) {
      case 'yandex_market': {
        const res = await marketplaceFetch('https://api.partner.market.yandex.ru/v2/campaigns', {
          headers: { 'Api-Key': token, Accept: 'application/json' },
          cache: 'no-store',
        })
        if (!res.ok) logger.warn('validate_token_rejected', { marketplace, status: res.status })
        return res.ok
      }
      case 'uzum': {
        const res = await marketplaceFetch('https://api-seller.uzum.uz/api/seller-openapi/v1/shops', {
          headers: { Authorization: token, Accept: 'application/json' },
          cache: 'no-store',
        })
        if (!res.ok) logger.warn('validate_token_rejected', { marketplace, status: res.status })
        return res.ok
      }
      case 'wildberries': {
        const res = await marketplaceFetch('https://common-api.wildberries.ru/api/v1/seller-info', {
          headers: { Authorization: token },
          cache: 'no-store',
        })
        if (!res.ok) logger.warn('validate_token_rejected', { marketplace, status: res.status })
        return res.ok
      }
      default:
        return false
    }
  } catch (err) {
    logger.error('validate_token_network_error', { marketplace, error: String(err) })
    return false
  }
}
