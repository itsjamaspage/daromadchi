import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'

export const runtime = 'nodejs'

const UPLOADS_DIR = path.join(process.cwd(), '.uploads')
const CACHE_SECONDS = 86400 * 30

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params
  const filename = segments[segments.length - 1]

  if (!filename || filename.includes('..') || filename.includes('/')) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
  }

  const ext = path.extname(filename).toLowerCase()
  const contentType = MIME[ext] || 'application/octet-stream'
  const filePath = path.join(UPLOADS_DIR, filename)

  try {
    const data = await readFile(filePath)
    return new NextResponse(data, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(data.byteLength),
        'Cache-Control': `public, max-age=${CACHE_SECONDS}, immutable`,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}
