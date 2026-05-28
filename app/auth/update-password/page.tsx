'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { TrendingUp, Lock, Eye, EyeOff, Loader2, CheckCircle } from 'lucide-react'

export default function UpdatePasswordPage() {
  const [password, setPassword]       = useState('')
  const [confirm,  setConfirm]        = useState('')
  const [showPw,   setShowPw]         = useState(false)
  const [loading,  setLoading]        = useState(false)
  const [error,    setError]          = useState('')
  const [success,  setSuccess]        = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('Parol kamida 6 belgi bo\'lishi kerak'); return
    }
    if (password !== confirm) {
      setError('Parollar mos kelmadi'); return
    }

    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError(error.message); setLoading(false)
    } else {
      setSuccess(true)
      setTimeout(() => router.push('/dashboard'), 2000)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: '#07070f' }}>

      <div className="absolute top-1/4 left-1/4 w-80 h-80 rounded-full bg-violet-600/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full bg-indigo-600/8 blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-7">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 mb-4 shadow-xl shadow-violet-500/30">
            <TrendingUp className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white">Daromadchi</h1>
          <p className="mt-1 text-sm text-slate-500">Uzum Market tahlil paneli</p>
        </div>

        <div className="rounded-2xl p-8 shadow-2xl border"
          style={{ background: '#0e0e1a', borderColor: 'rgba(255,255,255,0.07)' }}>

          {success ? (
            <div className="text-center py-6 space-y-4">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-2">
                <CheckCircle className="w-7 h-7 text-emerald-400" />
              </div>
              <p className="font-semibold text-white">Parol muvaffaqiyatli o'zgartirildi!</p>
              <p className="text-sm text-slate-500">Dashboard'ga yo'naltirilmoqda...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="mb-2">
                <h2 className="text-base font-bold text-white mb-1">Yangi parol o'rnatish</h2>
                <p className="text-xs text-slate-500">Kamida 6 belgilik yangi parol kiriting</p>
              </div>

              <div>
                <label className="block text-xs font-medium mb-2 text-slate-400">Yangi parol</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required minLength={6}
                    placeholder="••••••••"
                    className="w-full rounded-xl pl-10 pr-10 py-3 text-sm outline-none transition-all text-white"
                    style={{ background: '#1c1c2e', border: '1px solid rgba(255,255,255,0.08)' }}
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-2 text-slate-400">Parolni tasdiqlang</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    required minLength={6}
                    placeholder="••••••••"
                    className="w-full rounded-xl pl-10 pr-4 py-3 text-sm outline-none transition-all text-white"
                    style={{ background: '#1c1c2e', border: '1px solid rgba(255,255,255,0.08)' }}
                  />
                </div>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading}
                className="w-full text-white font-bold rounded-xl py-3 text-sm transition-all flex items-center justify-center gap-2 mt-1 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', boxShadow: '0 8px 24px rgba(124,58,237,0.3)' }}>
                {loading
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Saqlanmoqda...</>
                  : 'Parolni saqlash'
                }
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
