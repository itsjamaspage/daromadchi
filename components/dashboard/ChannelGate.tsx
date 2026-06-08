'use client'

import { useEffect, useState, useCallback } from 'react'
import { useLang } from '@/app/providers'

const CHANNEL_URL = 'https://t.me/daromadchi_uz'

const labels = {
  uz: {
    title: "Kanalga a'zo bo'ling",
    desc: "Daromadchidan foydalanish uchun Telegram kanalimizga a'zo bo'lishingiz shart.",
    step1: '1-qadam: Telegram hisobingizni ulang',
    step2: "2-qadam: Kanalga a'zo bo'ling",
    connectBtn: 'Telegramni ulash',
    joinBtn: "@daromadchi_uz kanaliga kirish",
    checkBtn: "Tekshirish",
    checking: "Tekshirilmoqda...",
    connected: "✅ Telegram ulandi",
    notYet: "Hali a'zo bo'lmadingiz. Kanalga kiring va qayta tekshiring.",
  },
  ru: {
    title: "Подпишитесь на канал",
    desc: "Для использования Daromadchi необходимо подписаться на наш Telegram-канал.",
    step1: 'Шаг 1: Подключите Telegram-аккаунт',
    step2: 'Шаг 2: Подпишитесь на канал',
    connectBtn: 'Подключить Telegram',
    joinBtn: "Перейти в канал @daromadchi_uz",
    checkBtn: "Проверить",
    checking: "Проверяем...",
    connected: "✅ Telegram подключён",
    notYet: "Вы ещё не подписались. Зайдите в канал и проверьте снова.",
  },
  en: {
    title: "Subscribe to the channel",
    desc: "To use Daromadchi, you must subscribe to our Telegram channel.",
    step1: 'Step 1: Connect your Telegram account',
    step2: 'Step 2: Subscribe to the channel',
    connectBtn: 'Connect Telegram',
    joinBtn: "Open @daromadchi_uz channel",
    checkBtn: "Check",
    checking: "Checking...",
    connected: "✅ Telegram connected",
    notYet: "Not subscribed yet. Join the channel and check again.",
  },
}

export default function ChannelGate({ children }: { children: React.ReactNode }) {
  const { lang } = useLang()
  const t = labels[lang] ?? labels.uz

  const [status, setStatus] = useState<'loading' | 'ok' | 'no_telegram' | 'not_subscribed'>('loading')
  const [checking, setChecking] = useState(false)
  const [notYet, setNotYet] = useState(false)
  const [linking, setLinking] = useState(false)

  const check = useCallback(async (showNotYet = false) => {
    setChecking(true)
    setNotYet(false)
    try {
      const res = await fetch('/api/channel-check')
      const data = await res.json()
      if (data.subscribed) {
        setStatus('ok')
      } else if (data.reason === 'no_telegram') {
        setStatus('no_telegram')
      } else {
        setStatus('not_subscribed')
        if (showNotYet) setNotYet(true)
      }
    } catch {
      setStatus('not_subscribed')
    } finally {
      setChecking(false)
    }
  }, [])

  useEffect(() => { check() }, [check])

  async function handleConnectTelegram() {
    setLinking(true)
    try {
      const res = await fetch('/api/telegram-link', { method: 'POST' })
      const data = await res.json()
      if (data.url) {
        window.open(data.url, '_blank')
        const interval = setInterval(async () => {
          const r = await fetch('/api/channel-check')
          const d = await r.json()
          if (d.reason !== 'no_telegram') {
            clearInterval(interval)
            setStatus('not_subscribed')
          }
        }, 3000)
        setTimeout(() => clearInterval(interval), 120000)
      }
    } finally {
      setLinking(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className="w-6 h-6 border-2 border-violet-400/40 border-t-violet-400 rounded-full animate-spin" />
      </div>
    )
  }

  if (status === 'ok') return <>{children}</>

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg)] px-4">
      <div className="w-full max-w-md bg-[var(--bg-card)] border border-[var(--border2)] rounded-2xl p-8 shadow-2xl shadow-black/60 text-center">
        <div className="text-5xl mb-4">📣</div>
        <h2 className="text-xl font-bold text-[var(--text-base)] mb-2">{t.title}</h2>
        <p className="text-sm text-[var(--text-muted)] mb-8">{t.desc}</p>

        <div className="space-y-4 text-left">
          {/* Step 1: Connect Telegram */}
          <div className={`rounded-xl border p-4 ${status !== 'no_telegram' ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-[var(--border2)]'}`}>
            <p className="text-xs font-semibold text-[var(--text-dim)] mb-3">{t.step1}</p>
            {status !== 'no_telegram' ? (
              <p className="text-sm text-emerald-400">{t.connected}</p>
            ) : (
              <button
                onClick={handleConnectTelegram}
                disabled={linking}
                className="w-full py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-sm font-semibold transition-colors disabled:opacity-60"
              >
                {linking ? '⏳...' : t.connectBtn}
              </button>
            )}
          </div>

          {/* Step 2: Join channel */}
          <div className={`rounded-xl border p-4 ${status === 'no_telegram' ? 'opacity-40 pointer-events-none' : 'border-[var(--border2)]'}`}>
            <p className="text-xs font-semibold text-[var(--text-dim)] mb-3">{t.step2}</p>
            <a
              href={CHANNEL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold text-center transition-colors mb-3"
            >
              {t.joinBtn}
            </a>
            <button
              onClick={() => check(true)}
              disabled={checking}
              className="w-full py-2 rounded-xl border border-[var(--border2)] text-sm text-[var(--text-dim)] hover:text-[var(--text-base)] hover:border-violet-500/50 transition-colors disabled:opacity-60"
            >
              {checking ? t.checking : t.checkBtn}
            </button>
            {notYet && (
              <p className="text-xs text-red-400 mt-2 text-center">{t.notYet}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
