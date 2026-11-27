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
    <div className="flex min-h-screen items-center justify-center bg-zinc-50">
      <div className="w-96 rounded-2xl border border-zinc-200 bg-white p-10 text-center shadow-sm">
        <div className="mx-auto mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-900 text-sm font-bold text-white">S</div>
        <h1 className="text-xl font-semibold tracking-tight">Payment Control</h1>
        <p className="mb-8 mt-1 text-sm text-zinc-500">Schapira CPA</p>
        {!supabaseConfigured ? (
          <p className="text-sm text-red-600">Supabase is not connected yet (build variables missing).</p>
        ) : sent ? (
          <p className="text-sm text-zinc-700">Check your email for a sign-in link.</p>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <input
              type="email" required placeholder="you@schapiracpa.com" value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border-0 px-3 py-2.5 text-sm shadow-sm ring-1 ring-inset ring-zinc-300 focus:ring-2 focus:ring-zinc-900 focus:outline-none"
            />
            <button className="w-full rounded-lg bg-zinc-900 py-2.5 text-sm font-medium text-white hover:bg-zinc-800">
              Email me a sign-in link
            </button>
            {error && <p className="text-xs text-red-600">{error}</p>}
          </form>
        )}
      </div>
    </div>
  )
}
