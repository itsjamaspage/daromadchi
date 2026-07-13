'use client'

import { useState } from 'react'
import { X, HelpCircle } from 'lucide-react'
import { useLang } from '@/app/providers'
import { helpContent, type HelpSection } from '@/lib/help-tooltips'

interface Props {
  section: HelpSection
  className?: string
  /** 'badge' = violet circle (page headers); 'plain' = subtle icon (sidebar). */
  variant?: 'badge' | 'plain'
}

export default function HelpTooltip({ section, className = '', variant = 'badge' }: Props) {
  const [open, setOpen] = useState(false)
  const { lang } = useLang()

  const content = helpContent[section]?.[lang] ?? helpContent[section]?.uz
  if (!content) return null

  const triggerClass = variant === 'plain'
    ? `inline-flex items-center justify-center w-5 h-5 rounded-md text-[var(--text-muted)] hover:text-[var(--c1)] hover:bg-[var(--bg-card2)] transition-all flex-shrink-0 ${className}`
    : `inline-flex items-center justify-center w-6 h-6 rounded-full border border-[var(--border)] bg-[var(--bg-card2)] text-[var(--c1)] hover:border-violet-400/70 hover:bg-[#6aabf0]/20 hover:text-[var(--c1)] transition-all flex-shrink-0 ${className}`

  return (
    <>
      <button
        onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(true) }}
        title={content.title}
        aria-label={content.title}
        className={triggerClass}
      >
        <HelpCircle className={variant === 'plain' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Modal */}
          <div className="relative w-full max-w-sm bg-[var(--bg-card)] border border-[var(--border2)] rounded-2xl shadow-2xl shadow-black/60 overflow-hidden" style={{ whiteSpace: 'normal' }}>
            {/* Header */}
            <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-[var(--bg-card2)] border border-[var(--border)] flex items-center justify-center flex-shrink-0">
                  <HelpCircle className="w-3.5 h-3.5 text-[var(--c1)]" />
                </div>
                <h2 className="text-[var(--text-base)] font-semibold text-sm">{content.title}</h2>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-base)] transition-colors p-1 rounded-lg hover:bg-[var(--bg-card2)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* What it does */}
              <Section label={sectionLabel(lang, 'what')} color="violet">
                <p className="text-[var(--text-dim)] text-sm leading-relaxed">{content.what}</p>
              </Section>

              {/* How it helps */}
              <Section label={sectionLabel(lang, 'why')} color="emerald">
                <p className="text-[var(--text-dim)] text-sm leading-relaxed">{content.why}</p>
              </Section>

              {/* How to use */}
              <Section label={sectionLabel(lang, 'how')} color="amber">
                <p className="text-[var(--text-dim)] text-sm leading-relaxed">{content.how}</p>
              </Section>

              {/* Data collection steps */}
              <Section label={sectionLabel(lang, 'steps')} color="cyan">
                <ol className="space-y-2">
                  {content.steps.map(s => (
                    <li key={s.step} className="flex items-start gap-2.5">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-cyan-500/15 border border-cyan-500/25 text-cyan-400 text-[10px] font-bold flex items-center justify-center mt-0.5">
                        {s.step}
                      </span>
                      <span className="text-[var(--text-dim)] text-sm leading-relaxed">{s.text}</span>
                    </li>
                  ))}
                </ol>
              </Section>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-[var(--border)]">
              <button
                onClick={() => setOpen(false)}
                className="w-full py-2 rounded-xl bg-[var(--bg-card2)] border border-[var(--border)] text-xs font-semibold hover:bg-[var(--c1)]/30 transition-all"
                style={{ color: 'var(--c1)' }}
              >
                {lang === 'ru' ? 'Понятно' : lang === 'en' ? 'Got it' : 'Tushunarli'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function Section({
  label, color, children,
}: {
  label: string
  color: 'violet' | 'emerald' | 'amber' | 'cyan'
  children: React.ReactNode
}) {
  const cfg = {
    violet: { border: 'var(--border)', bg: 'var(--bg-card2)', dot: 'var(--c1)',   text: 'var(--c1)'   },
    emerald: { border: 'rgba(52,211,153,0.25)',  bg: 'rgba(52,211,153,0.07)',  dot: '#34d399',   text: '#34d399'   },
    amber:   { border: 'rgba(251,191,36,0.25)',  bg: 'rgba(251,191,36,0.07)',  dot: '#fbbf24',   text: '#f59e0b'   },
    cyan:    { border: 'rgba(34,211,238,0.25)',  bg: 'rgba(34,211,238,0.07)',  dot: '#22d3ee',   text: '#22d3ee'   },
  }[color]
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${cfg.border}`, background: cfg.bg }}>
      <div className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: `1px solid ${cfg.border}` }}>
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cfg.dot }} />
        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: cfg.text }}>
          {label}
        </p>
      </div>
      <div className="px-4 py-3">
        {children}
      </div>
    </div>
  )
}

function sectionLabel(lang: string, key: 'what' | 'why' | 'how' | 'steps') {
  const labels: Record<string, Record<string, string>> = {
    uz: {
      what:  'Nima qiladi',
      why:   'Nima uchun foydali',
      how:   'Qanday foydalanish',
      steps: "Ma'lumotlar qanday to'planadi",
    },
    ru: {
      what:  'Что делает',
      why:   'Почему полезно',
      how:   'Как использовать',
      steps: 'Как собираются данные',
    },
    en: {
      what:  'What it does',
      why:   'Why it helps',
      how:   'How to use it',
      steps: 'How data is collected',
    },
  }
  return labels[lang]?.[key] ?? labels.uz[key]
}
