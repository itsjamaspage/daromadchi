/* eslint-disable react-hooks/set-state-in-effect */
'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Bug, Lightbulb, Send, ChevronLeft, ChevronRight, CheckCircle, Paperclip } from 'lucide-react'
import { useLang } from '@/app/providers'

type Mode = 'bug' | 'idea' | null

const LABELS = {
  uz: {
    tab: 'Fikr',
    title: 'Fikr-mulohaza',
    bug: 'Xato bildirish',
    bugDesc: "Nimadir noto'g'ri ishlayaptimi?",
    idea: "G'oya taklif qilish",
    ideaDesc: 'Yangi imkoniyat yoki takomillashtirish?',
    placeholder: { bug: "Xatoni tavsiflang...", idea: "G'oyangizni yozing..." },
    send: 'Yuborish',
    sending: 'Yuborilmoqda...',
    thanks: 'Rahmat! Xabaringiz qabul qilindi.',
    back: 'Orqaga',
    attach: 'Rasm biriktirish',
    removeImg: "Rasmni o'chirish",
  },
  ru: {
    tab: 'Отзыв',
    title: 'Обратная связь',
    bug: 'Сообщить об ошибке',
    bugDesc: 'Что-то работает неправильно?',
    idea: 'Предложить идею',
    ideaDesc: 'Новая функция или улучшение?',
    placeholder: { bug: 'Опишите ошибку...', idea: 'Опишите идею...' },
    send: 'Отправить',
    sending: 'Отправка...',
    thanks: 'Спасибо! Ваше сообщение получено.',
    back: 'Назад',
    attach: 'Прикрепить скриншот',
    removeImg: 'Удалить изображение',
  },
  en: {
    tab: 'Feedback',
    title: 'Feedback',
    bug: 'Report a mistake',
    bugDesc: 'Something not working right?',
    idea: 'Suggest an idea',
    ideaDesc: 'New feature or improvement?',
    placeholder: { bug: 'Describe the issue...', idea: 'Describe your idea...' },
    send: 'Send',
    sending: 'Sending...',
    thanks: 'Thank you! Your message was received.',
    back: 'Back',
    attach: 'Attach screenshot',
    removeImg: 'Remove image',
  },
}

export default function FeedbackWidget() {
  const { lang } = useLang()
  const t = LABELS[lang] ?? LABELS.uz
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<Mode>(null)
  const [text, setText] = useState('')
  const [image, setImage] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Open on first visit, auto-close after 2s
  useEffect(() => {
    const closed = sessionStorage.getItem('feedback-closed')
    if (!closed) {
      setOpen(true)
      setTimeout(() => {
        setOpen(false)
        sessionStorage.setItem('feedback-closed', '1')
      }, 2000)
    }
  }, [])

  const handleClose = () => {
    setOpen(false)
    sessionStorage.setItem('feedback-closed', '1')
  }

  const handleOpen = () => {
    setOpen(true)
    sessionStorage.removeItem('feedback-closed')
  }

  const handleSelectMode = (m: Mode) => {
    setMode(m)
    setText('')
    setImage(null)
    setSent(false)
    setTimeout(() => textRef.current?.focus(), 50)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setImage(ev.target?.result as string)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleSubmit = async () => {
    if (!text.trim()) return
    setSending(true)
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: mode, message: text.trim(), image }),
      })
    } catch {}
    setSending(false)
    setSent(true)
    setTimeout(() => {
      setSent(false)
      setText('')
      setImage(null)
      setMode(null)
    }, 2500)
  }

  return (
    <div className="fixed right-0 top-1/2 -translate-y-1/2 z-50 flex items-center gap-0 pointer-events-none">

      {/* Panel */}
      <div
        className="pointer-events-auto transition-all duration-300 ease-in-out overflow-hidden"
        style={{
          width: open ? 272 : 0,
          opacity: open ? 1 : 0,
        }}
      >
        <div className="w-[272px] rounded-l-2xl border-y border-l shadow-2xl"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border2)' }}>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b"
            style={{ borderColor: 'var(--border)' }}>
            <span className="font-semibold text-sm" style={{ color: 'var(--text-base)' }}>
              {t.title}
            </span>
            <button onClick={handleClose}
              className="w-6 h-6 rounded-lg flex items-center justify-center transition-colors"
              style={{ color: 'var(--text-muted)' }}>
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-3">
            {sent ? (
              <div className="py-6 flex flex-col items-center gap-2 text-center">
                <CheckCircle className="w-8 h-8" style={{ color: 'var(--c1)' }} />
                <p className="text-sm font-medium" style={{ color: 'var(--text-base)' }}>{t.thanks}</p>
              </div>
            ) : mode === null ? (
              /* Mode selection */
              <div className="flex flex-col gap-2">
                <button onClick={() => handleSelectMode('bug')}
                  className="flex items-start gap-3 p-3 rounded-xl border text-left transition-all hover:border-[var(--c1)] group"
                  style={{ background: 'var(--bg-card2)', borderColor: 'var(--border)' }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: 'rgba(255,80,80,0.10)', border: '1px solid rgba(255,80,80,0.2)' }}>
                    <Bug className="w-4 h-4 text-red-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-xs" style={{ color: 'var(--text-base)' }}>{t.bug}</p>
                    <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{t.bugDesc}</p>
                  </div>
                </button>

                <button onClick={() => handleSelectMode('idea')}
                  className="flex items-start gap-3 p-3 rounded-xl border text-left transition-all hover:border-[var(--c1)] group"
                  style={{ background: 'var(--bg-card2)', borderColor: 'var(--border)' }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: 'rgba(250,200,0,0.10)', border: '1px solid rgba(250,200,0,0.2)' }}>
                    <Lightbulb className="w-4 h-4 text-amber-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-xs" style={{ color: 'var(--text-base)' }}>{t.idea}</p>
                    <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{t.ideaDesc}</p>
                  </div>
                </button>
              </div>
            ) : (
              /* Text input */
              <div className="flex flex-col gap-2">
                <button onClick={() => setMode(null)}
                  className="flex items-center gap-1 text-xs transition-colors"
                  style={{ color: 'var(--text-muted)' }}>
                  <ChevronLeft className="w-3.5 h-3.5" /> {t.back}
                </button>
                <div className="flex items-center gap-2 mb-1">
                  {mode === 'bug'
                    ? <Bug className="w-4 h-4 text-red-400" />
                    : <Lightbulb className="w-4 h-4 text-amber-400" />}
                  <span className="font-semibold text-xs" style={{ color: 'var(--text-base)' }}>
                    {mode === 'bug' ? t.bug : t.idea}
                  </span>
                </div>
                <textarea
                  ref={textRef}
                  value={text}
                  onChange={e => setText(e.target.value)}
                  placeholder={mode === 'bug' ? t.placeholder.bug : t.placeholder.idea}
                  rows={4}
                  className="w-full rounded-xl text-xs p-3 resize-none outline-none border transition-colors"
                  style={{
                    background: 'var(--bg-input)',
                    borderColor: 'var(--border2)',
                    color: 'var(--text-base)',
                  }}
                />
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
                {image ? (
                  <div className="relative rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border2)' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={image} alt="screenshot" className="w-full max-h-32 object-cover" />
                    <button
                      onClick={() => setImage(null)}
                      title={t.removeImg}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="flex items-center gap-1.5 text-xs transition-colors py-1"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <Paperclip className="w-3.5 h-3.5" /> {t.attach}
                  </button>
                )}
                <button
                  onClick={handleSubmit}
                  disabled={!text.trim() || sending}
                  className="flex items-center justify-center gap-2 w-full py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-40"
                  style={{ background: 'var(--c1)', color: '#fff' }}>
                  {sending ? t.sending : <><Send className="w-3.5 h-3.5" /> {t.send}</>}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tab trigger */}
      <button
        onClick={open ? handleClose : handleOpen}
        className="pointer-events-auto flex items-center gap-1.5 px-2.5 py-3 rounded-l-xl border-y border-l transition-all"
        style={{
          background: 'var(--bg-card)',
          borderColor: 'var(--border2)',
          color: 'var(--text-muted)',
          writingMode: 'vertical-rl',
          textOrientation: 'mixed',
          transform: 'rotate(180deg)',
        }}>
        {open
          ? <ChevronRight className="w-3 h-3" style={{ transform: 'rotate(180deg)' }} />
          : <ChevronLeft className="w-3 h-3" style={{ transform: 'rotate(180deg)' }} />}
        <span className="text-[11px] font-semibold tracking-wide">{t.tab}</span>
      </button>
    </div>
  )
}
