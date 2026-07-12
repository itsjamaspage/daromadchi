import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import type { NextAuthConfig } from 'next-auth'

const authConfig: NextAuthConfig = {
  providers: [
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

        if (!user.email_verified) {
          throw new Error('EMAIL_NOT_VERIFIED')
        }

        return {
          id: user.id,
          email: user.email,
          name: user.full_name,
        }
      }
    })
  ],
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
