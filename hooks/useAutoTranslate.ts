'use client'

import { useCallback, useRef } from 'react'

type Lang = 'ru' | 'uz'

async function translateText(text: string, from: Lang, to: Lang): Promise<string> {
  const res = await fetch('/api/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, from, to }),
  })
  if (!res.ok) return ''
  const { translated } = await res.json() as { translated: string }
  return translated
}

export function useAutoTranslate() {
  const inflightRef = useRef<Set<string>>(new Set())

  const translate = useCallback(
    (srcText: string, from: Lang, to: Lang, targetValue: string, setTarget: (v: string) => void) => {
      const text = srcText.trim()
      if (!text) return
      if (targetValue.trim()) return

      const key = `${from}-${text.slice(0, 30)}`
      if (inflightRef.current.has(key)) return
      inflightRef.current.add(key)

      translateText(text, from, to)
        .then(result => {
          if (result) setTarget(result)
        })
        .finally(() => inflightRef.current.delete(key))
    },
    [],
  )

  return translate
}
