import type { MarketplaceType } from '@/lib/types'
import { marketplaceFetch } from '@/lib/marketplace-readonly-guard'
import { logger } from '@/lib/logger'

export async function validateMarketplaceToken(
  marketplace: MarketplaceType,
  token: string,
  campaignId?: string,
): Promise<boolean> {
  try {
    switch (marketplace) {
      case 'yandex_market': {
        const url = campaignId
          ? `https://api.partner.market.yandex.ru/v2/campaigns/${campaignId}`
          : 'https://api.partner.market.yandex.ru/v2/campaigns'
        const res = await marketplaceFetch(url, {
          headers: { 'Api-Key': token, Accept: 'application/json' },
          cache: 'no-store',
        })
        // 401 = truly invalid token; 403 = valid token but restricted permissions
        // (still valid for data sync). Only reject on 401.
        if (res.status === 401) {
          logger.warn('validate_token_rejected', { marketplace, status: res.status, campaignId })
          return false
        }
        return true
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
        // Was: common-api.wildberries.ru/api/v1/seller-info — that endpoint
        // now 401s scope-restricted tokens even when the token is fully
        // valid for the sync's actual APIs, so we were rejecting good tokens
        // and never writing them to the DB. Validate against the exact
        // endpoint the sync starts with (Content API cards list) so a token
        // that passes here is guaranteed to work for at least one real call.
        const res = await marketplaceFetch('https://content-api.wildberries.ru/content/v2/get/cards/list', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ settings: { cursor: { limit: 1 }, filter: { withPhoto: -1 } } }),
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
