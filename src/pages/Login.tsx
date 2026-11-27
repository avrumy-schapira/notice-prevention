import { useState } from 'react'
import { signIn } from '../lib/auth'
import { supabaseConfigured } from '../lib/supabase'

export function Login() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const clean = email.trim().toLowerCase()
    if (!clean.endsWith('@schapiracpa.com')) return setError('Use your schapiracpa.com email.')
    const { error } = await signIn(clean)
    if (error) return setError(error.message)
    setError(null)
    setSent(true)
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-80 rounded-lg border border-slate-200 bg-white p-8 text-center">
        <h1 className="mb-1 text-lg font-semibold">Payment &amp; Filing Control</h1>
        <p className="mb-6 text-sm text-slate-500">Schapira CPA</p>
        {!supabaseConfigured ? (
          <p className="text-sm text-red-600">Supabase is not connected yet (build variables missing).</p>
        ) : sent ? (
          <p className="text-sm text-slate-700">Check your email for a sign-in link.</p>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <input
              type="email" required placeholder="you@schapiracpa.com" value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <button className="w-full rounded-md bg-slate-900 py-2 text-sm font-medium text-white hover:bg-slate-700">
              Email me a sign-in link
            </button>
            {error && <p className="text-xs text-red-600">{error}</p>}
          </form>
        )}
      </div>
    </div>
  )
}
