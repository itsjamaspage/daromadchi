import type { MarketplaceType } from '@/lib/types'
import { marketplaceFetch } from '@/lib/marketplace-readonly-guard'

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
        return res.ok
      }
      case 'uzum': {
        const res = await marketplaceFetch('https://api-seller.uzum.uz/api/seller-openapi/v1/shops', {
          headers: { Authorization: token, Accept: 'application/json' },
          cache: 'no-store',
        })
        return res.ok
      }
      case 'wildberries': {
        const res = await marketplaceFetch('https://marketplace-api.wildberries.ru/api/v3/supplies?limit=1', {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
          cache: 'no-store',
        })
        return res.ok
      }
      default:
        return false
    }
  } catch {
    return false
  }
}
