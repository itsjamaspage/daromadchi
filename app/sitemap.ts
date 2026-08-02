import type { MetadataRoute } from 'next'

const BASE = 'https://www.daromadchi.uz'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: BASE,                 lastModified: new Date(), changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${BASE}/pricing`,    lastModified: new Date(), changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE}/about`,      lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    // /login intentionally omitted — it's noindex (no search value).
    { url: `${BASE}/help`,       lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/privacy`,    lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${BASE}/terms`,      lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${BASE}/compliance`, lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.3 },
  ]
}
