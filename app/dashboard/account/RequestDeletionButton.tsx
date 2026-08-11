'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'

type Lang = 'uz' | 'ru' | 'en'

const T: Record<Lang, {
  title: string
  desc: string
  button: string
  confirmQ: string
  confirm: string
  cancel: string
  sending: string
  done: string
  error: string
}> = {
  uz: {
    title: "Hisobni o'chirish",
    desc: "Hisobingiz va shaxsiy ma'lumotlaringizni o'chirishni so'rashingiz mumkin. So'rov qabul qilinadi va qayta ishlanadi. Moliyaviy hujjatlar qonun talabiga ko'ra saqlanadi.",
    button: "Hisobni o'chirishni so'rash",
    confirmQ: "Hisobni o'chirishni so'rashni tasdiqlaysizmi?",
    confirm: 'Ha, so\'rov yuborish',
    cancel: 'Bekor qilish',
    sending: 'Yuborilmoqda…',
    done: "So'rovingiz qabul qilindi va tez orada qayta ishlanadi.",
    error: "Xatolik yuz berdi. Keyinroq qayta urinib ko'ring.",
  },
  ru: {
    title: 'Удаление аккаунта',
    desc: 'Вы можете запросить удаление вашего аккаунта и персональных данных. Запрос будет принят и обработан. Финансовые документы сохраняются в соответствии с требованиями закона.',
    button: 'Запросить удаление аккаунта',
    confirmQ: 'Подтвердить запрос на удаление аккаунта?',
    confirm: 'Да, отправить запрос',
    cancel: 'Отмена',
    sending: 'Отправка…',
    done: 'Ваш запрос принят и будет обработан в ближайшее время.',
    error: 'Произошла ошибка. Попробуйте позже.',
  },
  en: {
    title: 'Account deletion',
    desc: 'You can request deletion of your account and personal data. The request will be received and processed. Financial records are retained as required by law.',
    button: 'Request account deletion',
    confirmQ: 'Confirm your account-deletion request?',
    confirm: 'Yes, send request',
    cancel: 'Cancel',
    sending: 'Sending…',
    done: 'Your request has been received and will be processed shortly.',
    error: 'Something went wrong. Please try again later.',
  },
}

export default function RequestDeletionButton({ lang }: { lang: Lang }) {
  const t = T[lang] ?? T.uz
  const [confirming, setConfirming] = useState(false)
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')

  async function submit() {
    setState('sending')
    try {
      const res = await fetch('/api/account/request-deletion', { method: 'POST' })
      setState(res.ok ? 'done' : 'error')
    } catch {
      setState('error')
    } finally {
      setConfirming(false)
    }
  }

  return (
    <div className="bg-[var(--bg-card2)] border border-[var(--border)] rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-[var(--border)] flex items-center gap-3">
        <Trash2 className="w-4 h-4" style={{ color: '#ef4444' }} />
        <p className="text-[var(--text-base)] font-semibold text-sm">{t.title}</p>
      </div>
      <div className="p-6">
        <p className="text-[var(--text-muted)] text-xs mb-4 leading-relaxed">{t.desc}</p>

        {state === 'done' ? (
          <p className="text-sm font-medium" style={{ color: '#10b981' }}>✓ {t.done}</p>
        ) : confirming ? (
          <div className="flex flex-col gap-3">
            <p className="text-[var(--text-base)] text-sm font-medium">{t.confirmQ}</p>
            <div className="flex items-center gap-2">
              <button
                onClick={submit}
                disabled={state === 'sending'}
                className="text-sm font-semibold px-4 py-2 rounded-xl transition-colors disabled:opacity-60"
                style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.4)' }}
              >
                {state === 'sending' ? t.sending : t.confirm}
              </button>
              <button
                onClick={() => { setConfirming(false); setState('idle') }}
                disabled={state === 'sending'}
                className="text-sm font-medium px-4 py-2 rounded-xl border border-[var(--border)] transition-colors hover:bg-[var(--bg-card)]"
                style={{ color: 'var(--text-muted)' }}
              >
                {t.cancel}
              </button>
            </div>
            {state === 'error' && <p className="text-xs" style={{ color: '#ef4444' }}>{t.error}</p>}
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="text-sm font-medium px-4 py-2 rounded-xl transition-colors"
            style={{ color: '#ef4444', border: '1px solid rgba(239,68,68,0.4)' }}
          >
            {t.button}
          </button>
        )}
      </div>
    </div>
  )
}
