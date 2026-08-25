import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/pricing', '/about', '/help', '/privacy', '/terms', '/compliance'],
        // NOTE: /dashboard/ is deliberately NOT disallowed. It carries a
        // `noindex` meta tag, and Google can only honor that if it's allowed to
        // crawl the page and read the tag. The dashboard is auth-gated, so an
        // unauthenticated crawler just hits the /login redirect — nothing
        // sensitive is exposed by letting it crawl.
        disallow: ['/api/', '/auth/', '/billing/'],
      },
    ],
    sitemap: 'https://daromadchi.uz/sitemap.xml',
  }
}
