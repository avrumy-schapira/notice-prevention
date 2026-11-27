import { NavLink, Outlet } from 'react-router-dom'
import { Building2, ClipboardList, Hourglass, BadgeCheck, CalendarClock, LogOut, Settings } from 'lucide-react'
import { signOut, useAuth } from '../lib/auth'

export function Layout() {
  const { profile } = useAuth()
  const manager = profile?.role === 'admin' || profile?.role === 'manager'
  const item = ({ isActive }: { isActive: boolean }) =>
    `flex h-10 items-center gap-3 rounded-lg px-3 text-[14px] font-medium transition-colors [&>svg]:h-[18px] [&>svg]:w-[18px] ${isActive ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'}`

  return (
    <div className="flex h-full">
      <aside className="flex w-64 shrink-0 flex-col border-r border-zinc-200 bg-white">
        <div className="flex h-16 items-center gap-3 border-b border-zinc-100 px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-sm font-bold text-white">S</div>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-zinc-900">Payment Control</div>
            <div className="text-xs text-zinc-500">Schapira CPA</div>
          </div>
        </div>

        <nav className="flex flex-1 flex-col p-3">
          <NavLink to="/clients" className={({ isActive }) =>
            `flex h-11 items-center gap-3 rounded-lg px-3 text-[15px] font-semibold transition-colors ${isActive ? 'bg-zinc-900 text-white' : 'text-zinc-900 hover:bg-zinc-100'}`}>
            <Building2 className="h-5 w-5" /> Clients
          </NavLink>

          <div className="mt-5 space-y-1">
            {manager && <NavLink to="/work" className={item}><ClipboardList /> Work</NavLink>}
            <NavLink to="/approvals" className={item}><Hourglass /> Client approvals</NavLink>
            <NavLink to="/payments" className={item}><BadgeCheck /> Payment confirmations</NavLink>
            <NavLink to="/upcoming" className={item}><CalendarClock /> Upcoming payments</NavLink>
          </div>

          <div className="mt-auto space-y-1 border-t border-zinc-100 pt-3">
            {profile?.role === 'admin' && <NavLink to="/settings" className={item}><Settings /> Settings</NavLink>}
            <div className="flex h-12 items-center gap-3 px-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold uppercase text-zinc-700">{profile?.email?.[0]}</div>
              <div className="min-w-0 flex-1 leading-tight">
                <div className="truncate text-sm font-medium">{profile?.full_name ?? profile?.email?.split('@')[0]}</div>
                <div className="text-xs capitalize text-zinc-500">{profile?.role}</div>
              </div>
              <button onClick={signOut} title="Sign out" className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900"><LogOut className="h-4 w-4" /></button>
            </div>
          </div>
        </nav>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto bg-zinc-50">
        <div className="mx-auto max-w-6xl px-10 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
