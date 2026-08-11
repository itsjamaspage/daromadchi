import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import Google from 'next-auth/providers/google'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import type { NextAuthConfig } from 'next-auth'
import type { Provider } from 'next-auth/providers'

const providers: Provider[] = [
  Credentials({
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" }
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) {
        throw new Error('Invalid credentials')
      }

      const user = await db.query.users.findFirst({
        where: eq(users.email, (credentials.email as string).toLowerCase())
      })

      if (!user || !user.password_hash) {
        throw new Error('User not found or password not set')
      }

      const isValid = await bcrypt.compare(
        credentials.password as string,
        user.password_hash
      )

      if (!isValid) {
        throw new Error('Invalid password')
      }

      if (!user.email_verified && process.env.SMTP_USER) {
        throw new Error('EMAIL_NOT_VERIFIED')
      }

      return {
        id: user.id,
        email: user.email,
        name: user.full_name,
      }
    }
  })
]

// Google OAuth is optional — the button is only rendered when this provider
// is registered (see /api/auth/providers). Skip when env vars are absent so
// dev machines without OAuth creds still build and run.
export const GOOGLE_ENABLED = Boolean(
  process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET,
)
if (GOOGLE_ENABLED) {
  providers.push(Google({
    clientId: process.env.AUTH_GOOGLE_ID!,
    clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    // Force account chooser each time so the user can pick which Google
    // account to link — otherwise Google silently reuses the last one.
    authorization: { params: { prompt: 'select_account' } },
  }))
}

const authConfig: NextAuthConfig = {
  providers,
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60,
  },
  jwt: {
    maxAge: 30 * 24 * 60 * 60,
  },
  callbacks: {
    async signIn({ user, account }) {
      // Google flow: JWT strategy has no adapter, so create-or-fetch the DB
      // row here and swap user.id to the DB uuid — the jwt() callback below
      // then stores that as token.sub for the rest of the session.
      if (account?.provider === 'google' && user.email) {
        const email = user.email.toLowerCase()
        const existing = await db.query.users.findFirst({ where: eq(users.email, email) })
        if (existing) {
          user.id = existing.id
          // Google verifies emails on its side, so treat this as verified
          // even if the user first registered via the Credentials path and
          // never opened the verification link.
          if (!existing.email_verified) {
            await db.update(users)
              .set({ email_verified: new Date() })
              .where(eq(users.id, existing.id))
          }
        } else {
          // New Google user = account creation, so lawful consent (ZRU-547) is
          // required. The /login page sets a short-lived first-party
          // `signup_consent` cookie right before starting the Google flow when
          // the consent box is ticked; it survives the OAuth round-trip
          // (SameSite=Lax, sent on the top-level callback navigation). No
          // cookie ⇒ do NOT create the account — bounce back to /login to
          // capture consent first. This is the server-side backstop that stops
          // Google signups from bypassing the checkbox.
          const { cookies } = await import('next/headers')
          const consented = (await cookies()).get('signup_consent')?.value === '1'
          if (!consented) {
            return '/login?consent=required'
          }
          const [created] = await db.insert(users).values({
            email,
            full_name: user.name ?? null,
            email_verified: new Date(),
            consented_at: new Date(),
          }).returning({ id: users.id })
          user.id = created!.id
        }
      }
      return true
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id
        token.email = user.email
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string
      }
      return session
    },
  },
}

export const { auth, handlers, signIn, signOut } = NextAuth(authConfig)
