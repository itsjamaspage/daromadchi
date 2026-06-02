import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { type, message } = await req.json()
    if (!type || !message?.trim()) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }
    // Log for now — wire up to email/Supabase later
    console.log(`[Feedback] type=${type} message=${message}`)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
