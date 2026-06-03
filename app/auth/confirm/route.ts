import { type EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Handles Supabase email links that use the token_hash + type format
// (signup confirmation, password recovery, email change). Recovery links are
// sent to the password-reset page; everything else lands on the dashboard.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type       = searchParams.get('type') as EmailOtpType | null
  const next       = searchParams.get('next')
    ?? (type === 'recovery' ? '/auth/update-password' : '/dashboard')

  if (token_hash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash })
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Invalid or expired link — bounce to login with an error flag
  return NextResponse.redirect(`${origin}/login?error=verification_failed`)
}
