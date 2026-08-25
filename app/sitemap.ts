import type { MetadataRoute } from 'next'
import { getAllSlugs } from '@/lib/help-content'

const BASE = 'https://daromadchi.uz'

// ── Why there is no lastModified ─────────────────────────────────────────────
// Every entry used to carry `new Date()`. The sitemap is prerendered at build
// time, so that stamped the deploy date onto all of them — telling Google that
// every page on the site changed every time anything shipped. A date that moves
// for pages that did not change is worse than no date: it trains crawlers to
// ignore the field, including on the occasions when it would have been true.
//
// We have no real per-page edit date to put there instead. lib/help-content.ts
// carries no timestamp per article, and the marketing pages are plain TSX. So
// the field is omitted rather than faked — it is optional in the sitemap spec.
// If a real source ever exists (a commit date baked in at build, or an
// updated_at on the article records), this is the one place to add it.

// ── Why the help articles are derived, not listed ────────────────────────────
// This file listed 7 URLs while the site served 43 indexable ones: /cookies and
// all 35 /help/<slug> articles were missing. Every one of them declares a
// self-referential canonical, so they were always meant to be indexed — Google
// found them by crawling links instead, which is why Search Console reported far
// more discovered pages than the sitemap declared.
//
// A hand-maintained list is what let that happen, so the articles are read from
// the same getAllSlugs() the routes are generated from. Adding an article now
// adds its sitemap entry; deleting one removes it. app/sitemap.test.ts holds the
// remaining static pages to the same rule.

const STATIC_PAGES: { path: string; changeFrequency: 'weekly' | 'monthly' | 'yearly'; priority: number }[] = [
  { path: '',            changeFrequency: 'weekly',  priority: 1.0 },
  { path: '/pricing',    changeFrequency: 'monthly', priority: 0.9 },
  { path: '/about',      changeFrequency: 'monthly', priority: 0.7 },
  // /login intentionally omitted — it's noindex (no search value).
  { path: '/help',       changeFrequency: 'monthly', priority: 0.5 },
  { path: '/privacy',    changeFrequency: 'yearly',  priority: 0.3 },
  { path: '/terms',      changeFrequency: 'yearly',  priority: 0.3 },
  { path: '/cookies',    changeFrequency: 'yearly',  priority: 0.3 },
  { path: '/compliance', changeFrequency: 'yearly',  priority: 0.3 },
]

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...STATIC_PAGES.map(({ path, changeFrequency, priority }) => ({
      url: `${BASE}${path}`,
      changeFrequency,
      priority,
    })),
    // The long-tail pages: one entry per help article, from the article set
    // itself. Ranked above the legal pages and level with the /help index —
    // they are the substance the index links to, not an afterthought.
    ...getAllSlugs().map(slug => ({
      url: `${BASE}/help/${slug}`,
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    })),
  ]
}
