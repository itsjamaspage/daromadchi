/* eslint-disable react-hooks/set-state-in-effect */
'use client'

import { useEffect, useState } from 'react'
import { useLang } from '@/app/providers'

const CHANNEL_URL = 'https://t.me/daromadchi_uz'

const labels = {
  uz: {
    title: "Kanalga a'zo bo'ling",
    desc: "Daromadchidan foydalanish uchun Telegram kanalimizga a'zo bo'lishingiz shart.",
    joinBtn: "@daromadchi_uz kanaliga kirish →",
    doneBtn: "A'zo bo'ldim ✓",
    funnyTitle: "Qara, agar aldagan bo'lsang 😤",
    funnyDesc: "Kanalda ko'rishni umid qilamiz! Yaxshi foydalaning 🚀",
  },
  ru: {
    title: "Подпишитесь на канал",
    desc: "Для использования Daromadchi необходимо подписаться на наш Telegram-канал.",
    joinBtn: "Перейти в канал @daromadchi_uz →",
    doneBtn: "Я подписался ✓",
    funnyTitle: "Смотри, если обманул 😤",
    funnyDesc: "Надеемся увидеть тебя в канале! Пользуйся с умом 🚀",
  },
  en: {
    title: "Subscribe to the channel",
    desc: "To use Daromadchi, you must subscribe to our Telegram channel.",
    joinBtn: "Open @daromadchi_uz channel →",
    doneBtn: "I subscribed ✓",
    funnyTitle: "Hey, if you lied... 😤",
    funnyDesc: "We hope to see you in the channel! Use it well 🚀",
  },
}

export default function ChannelGate({ children }: { children: React.ReactNode }) {
  const { lang } = useLang()
  const t = labels[lang as keyof typeof labels] ?? labels.uz

  const [passed, setPassed] = useState<boolean | null>(null)
  const [showPopup, setShowPopup] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('channel_passed')
    setPassed(stored === 'true')
  }, [])

  function handleDone() {
    setShowPopup(true)
    setTimeout(() => {
      localStorage.setItem('channel_passed', 'true')
      setShowPopup(false)
      setPassed(true)
    }, 2200)
  }

  if (passed !== false) return <>{children}</>

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg)] px-4">
      {showPopup && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[var(--bg-card)] border border-amber-500/40 rounded-2xl p-8 shadow-2xl text-center max-w-sm mx-4 animate-bounce-in">
            <div className="text-6xl mb-4">😤</div>
            <h3 className="text-lg font-bold text-amber-400 mb-2">{t.funnyTitle}</h3>
            <p className="text-sm text-[var(--text-muted)]">{t.funnyDesc}</p>
          </div>
        </div>
      )}

      <div className="w-full max-w-md bg-[var(--bg-card)] border border-[var(--border2)] rounded-2xl p-8 shadow-2xl shadow-black/60 text-center">
        <div className="text-5xl mb-4">📣</div>
        <h2 className="text-xl font-bold text-[var(--text-base)] mb-2">{t.title}</h2>
        <p className="text-sm text-[var(--text-muted)] mb-8">{t.desc}</p>

        <div className="space-y-3">
          <a
            href={CHANNEL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full py-3 rounded-xl bg-[var(--c1)] hover:bg-[#6aabf0] text-white text-sm font-semibold text-center transition-colors"
          >
            {t.joinBtn}
          </a>
          <button
            onClick={handleDone}
            disabled={showPopup}
            className="w-full py-3 rounded-xl border border-emerald-500/50 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-sm font-semibold transition-colors disabled:opacity-60"
          >
            {t.doneBtn}
          </button>
        </div>
      </div>
    </div>
  )
}
