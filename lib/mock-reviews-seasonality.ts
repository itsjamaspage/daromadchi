export interface ReviewEntry {
  id: string
  author: string
  date: string
  rating: number
  text: string
  productTitle: string
  sentiment: 'positive' | 'negative' | 'neutral'
  replied: boolean
  platform?: string
  shopId?: string
}
