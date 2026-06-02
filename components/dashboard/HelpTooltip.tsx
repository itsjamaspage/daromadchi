'use client'

import { useState } from 'react'
import { X, HelpCircle } from 'lucide-react'
import { useLang } from '@/app/providers'
import { helpContent, type HelpSection } from '@/lib/help-tooltips'

interface Props {
  section: HelpSection
  className?: string
}

export default function HelpTooltip({ section, className = '' }: Props) {
  const [open, setOpen] = useState(false)
  const { lang } = useLang()

  const content = helpContent[section]?.[lang] ?? helpContent[section]?.uz
  if (!content) return null

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title={content.title}
        className={`inline-flex items-center justify-center w-6 h-6 rounded-full border border-violet-500/40 bg-violet-500/10 text-violet-400 hover:border-violet-400/70 hover:bg-violet-500/20 hover:text-violet-300 transition-all flex-shrink-0 ${className}`}
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Modal */}
          <div className="relative w-full max-w-sm bg-[#0f0f1e] border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/60 overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-violet-500/15 border border-violet-500/25 flex items-center justify-center flex-shrink-0">
                  <HelpCircle className="w-3.5 h-3.5 text-violet-400" />
                </div>
                <h2 className="text-white font-semibold text-sm">{content.title}</h2>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-slate-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/[0.05]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* What it does */}
              <Section label={sectionLabel(lang, 'what')} color="violet">
                <p className="text-slate-300 text-xs leading-relaxed">{content.what}</p>
              </Section>

              {/* How it helps */}
              <Section label={sectionLabel(lang, 'why')} color="emerald">
                <p className="text-slate-300 text-xs leading-relaxed">{content.why}</p>
              </Section>

              {/* How to use */}
              <Section label={sectionLabel(lang, 'how')} color="amber">
                <p className="text-slate-300 text-xs leading-relaxed">{content.how}</p>
              </Section>

              {/* Data collection steps */}
              <Section label={sectionLabel(lang, 'steps')} color="cyan">
                <ol className="space-y-2">
                  {content.steps.map(s => (
                    <li key={s.step} className="flex items-start gap-2.5">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-cyan-500/15 border border-cyan-500/25 text-cyan-400 text-[10px] font-bold flex items-center justify-center mt-0.5">
                        {s.step}
                      </span>
                      <span className="text-slate-300 text-xs leading-relaxed">{s.text}</span>
                    </li>
                  ))}
                </ol>
              </Section>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-white/[0.05]">
              <button
                onClick={() => setOpen(false)}
                className="w-full py-2 rounded-xl bg-violet-600/20 border border-violet-500/30 text-violet-300 text-xs font-semibold hover:bg-violet-600/30 transition-all"
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
  const colors = {
    violet: 'text-violet-400 border-violet-500/20 bg-violet-500/5',
    emerald: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5',
    amber:   'text-amber-400 border-amber-500/20 bg-amber-500/5',
    cyan:    'text-cyan-400 border-cyan-500/20 bg-cyan-500/5',
  }
  return (
    <div className={`rounded-xl border px-3.5 py-3 ${colors[color]}`}>
      <p className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${colors[color].split(' ')[0]}`}>
        {label}
      </p>
      {children}
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
