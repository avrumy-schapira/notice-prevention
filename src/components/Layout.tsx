import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { Building2, ClipboardList, Hourglass, BadgeCheck, CalendarClock, LogOut, Search, Settings } from 'lucide-react'
import { signOut, useAuth } from '../lib/auth'

export function Layout() {
  const { profile } = useAuth()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const canSeeWorkload = profile?.role === 'admin' || profile?.role === 'manager'

  const small = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition ${isActive ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900'}`

  return (
    <div className="flex h-full">
      <aside className="flex w-64 shrink-0 flex-col border-r border-zinc-200 bg-white">
        <div className="flex items-center gap-2.5 px-5 pb-4 pt-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-xs font-bold text-white">S</div>
          <div className="leading-tight">
            <div className="text-sm font-semibold">Payment Control</div>
            <div className="text-xs text-zinc-500">Schapira CPA</div>
          </div>
        </div>

        <form className="px-3 pb-3" onSubmit={(e) => { e.preventDefault(); if (q.trim()) nav(`/search?q=${encodeURIComponent(q.trim())}`) }}>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search all returns"
              className="w-full rounded-lg border-0 bg-zinc-100 py-2 pl-8 pr-2 text-sm placeholder:text-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-900 focus:outline-none" />
          </div>
        </form>

        <nav className="px-3">
          <NavLink to="/clients" className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-semibold transition ${isActive ? 'bg-zinc-900 text-white' : 'text-zinc-900 hover:bg-zinc-100'}`}>
            <Building2 className="h-5 w-5" /> Clients
          </NavLink>

          <div className="mt-6 px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Work</div>
          <div className="space-y-0.5">
            {canSeeWorkload && <NavLink to="/work" className={small}><ClipboardList className="h-4 w-4" /> Work</NavLink>}
            <NavLink to="/approvals" className={small}><Hourglass className="h-4 w-4" /> Client approvals</NavLink>
            <NavLink to="/payments" className={small}><BadgeCheck className="h-4 w-4" /> Payment confirmations</NavLink>
            <NavLink to="/upcoming" className={small}><CalendarClock className="h-4 w-4" /> Upcoming payments</NavLink>
            {profile?.role === 'admin' && <NavLink to="/settings" className={small}><Settings className="h-4 w-4" /> Settings</NavLink>}
          </div>
        </nav>

        <div className="mt-auto border-t border-zinc-200 p-3">
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold uppercase text-zinc-700">
              {profile?.email?.[0]}
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-sm font-medium">{profile?.full_name ?? profile?.email?.split('@')[0]}</div>
              <div className="text-xs capitalize text-zinc-500">{profile?.role}</div>
            </div>
            <button onClick={signOut} title="Sign out" className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-10 py-10">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
