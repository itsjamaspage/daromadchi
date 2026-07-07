import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/pricing', '/about', '/help', '/privacy', '/terms', '/compliance'],
        disallow: ['/dashboard/', '/api/', '/auth/', '/billing/'],
      },
    ],
    sitemap: 'https://www.daromadchi.uz/sitemap.xml',
  }
}
