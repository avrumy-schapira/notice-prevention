import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { signOut, useAuth } from '../lib/auth'

export function Layout() {
  const { profile } = useAuth()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const canSeeWorkload = profile?.role === 'admin' || profile?.role === 'manager'
  const link = ({ isActive }: { isActive: boolean }) =>
    `rounded-md px-3 py-1.5 text-sm font-medium ${isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-6 py-3">
          <span className="mr-4 font-semibold">Payment &amp; Filing Control</span>
          {canSeeWorkload && <NavLink to="/workload" className={link}>Admin workload</NavLink>}
          <NavLink to="/approvals" className={link}>Pending approvals</NavLink>
          <NavLink to="/payments" className={link}>Payment confirmations</NavLink>
          <NavLink to="/clients" className={link}>Client database</NavLink>
          <form
            className="ml-auto"
            onSubmit={(e) => { e.preventDefault(); nav(`/clients?q=${encodeURIComponent(q)}`) }}
          >
            <input
              className="w-56 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              placeholder="Search all returns"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </form>
          <span className="ml-3 text-xs text-slate-500">{profile?.email} · {profile?.role}</span>
          <button onClick={signOut} className="ml-2 text-xs text-slate-500 underline">Sign out</button>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-6">
        <Outlet />
      </main>
    </div>
  )
}
