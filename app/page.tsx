import type { Metadata } from 'next'
import HomeClient from './HomeClient'

// The landing page itself is a client component (HomeClient); this thin server
// wrapper exists so the homepage can carry its own self-referential canonical.
// Relative path resolves against metadataBase (https://daromadchi.uz).
export const metadata: Metadata = {
  alternates: { canonical: '/' },
}

export default function Page() {
  return <HomeClient />
}
