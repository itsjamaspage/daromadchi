import type { Metadata } from 'next'

// The login page is a client component and can't export metadata itself, so this
// thin server layout carries its robots directive. A login page has no search
// value — keep it out of the index.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children
}
