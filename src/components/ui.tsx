import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Search } from 'lucide-react'
import { STATUS_LABEL, type FilingStatus } from '../lib/types'

type Tone = 'zinc' | 'blue' | 'green' | 'amber' | 'red' | 'violet'
const TONE: Record<Tone, string> = {
  zinc: 'bg-zinc-100 text-zinc-700 ring-zinc-200',
  blue: 'bg-blue-50 text-blue-700 ring-blue-200',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
  violet: 'bg-violet-50 text-violet-700 ring-violet-200',
}

export const Badge = ({ children, tone = 'zinc', dot }: { children: ReactNode; tone?: Tone; dot?: boolean }) => (
  <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TONE[tone]}`}>
    {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />}
    {children}
  </span>
)

const STATUS_TONE: Record<FilingStatus, Tone> = {
  not_started: 'zinc',
  pulled_flags_open: 'amber',
  ready_to_email: 'blue',
  emailed_waiting: 'violet',
  client_confirmed: 'green',
  client_modified_ach: 'amber',
  client_modified_method: 'amber',
  filed: 'zinc',
}
export const StatusBadge = ({ status }: { status: FilingStatus }) => <Badge tone={STATUS_TONE[status]} dot>{STATUS_LABEL[status]}</Badge>

export const Crumbs = ({ items }: { items: { label: string; to?: string }[] }) => (
  <nav className="mb-3 flex items-center gap-1 text-sm text-zinc-500">
    {items.map((c, i) => (
      <span key={i} className="flex items-center gap-1">
        {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-zinc-300" />}
        {c.to ? <Link to={c.to} className="hover:text-zinc-900">{c.label}</Link> : <span className="text-zinc-900">{c.label}</span>}
      </span>
    ))}
  </nav>
)

export const PageHeader = ({ title, sub, right, crumbs }: { title: ReactNode; sub?: ReactNode; right?: ReactNode; crumbs?: { label: string; to?: string }[] }) => (
  <div className="mb-8">
    {crumbs && <Crumbs items={crumbs} />}
    <div className="flex items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {sub && <p className="mt-1 text-sm text-zinc-500">{sub}</p>}
      </div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  </div>
)

export const Card = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <div className={`rounded-xl border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${className}`}>{children}</div>
)

export const SectionTitle = ({ children, right }: { children: ReactNode; right?: ReactNode }) => (
  <div className="mb-3 flex items-center justify-between">
    <h2 className="text-sm font-semibold text-zinc-900">{children}</h2>
    {right}
  </div>
)

export const Empty = ({ title, children }: { title: string; children?: ReactNode }) => (
  <div className="px-6 py-14 text-center">
    <p className="text-sm font-medium text-zinc-900">{title}</p>
    {children && <p className="mt-1 text-sm text-zinc-500">{children}</p>}
  </div>
)

export const Loading = () => (
  <div className="space-y-2 p-4">
    {[0, 1, 2, 3].map((i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-zinc-100" />)}
  </div>
)

export const Table = ({ head, children }: { head: ReactNode[]; children: ReactNode }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-zinc-200">
          {head.map((h, i) => <th key={i} className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500">{h}</th>)}
        </tr>
      </thead>
      <tbody className="divide-y divide-zinc-100">{children}</tbody>
    </table>
  </div>
)
export const Td = ({ children, className = '' }: { children?: ReactNode; className?: string }) => (
  <td className={`px-4 py-3 align-middle ${className}`}>{children}</td>
)

export const Button = ({ children, onClick, variant = 'secondary', disabled, title, size = 'md' }: {
  children: ReactNode; onClick?: () => void; variant?: 'primary' | 'secondary' | 'ghost'; disabled?: boolean; title?: string; size?: 'sm' | 'md'
}) => {
  const v = {
    primary: 'bg-zinc-900 text-white hover:bg-zinc-800 shadow-sm',
    secondary: 'bg-white text-zinc-900 ring-1 ring-inset ring-zinc-300 hover:bg-zinc-50 shadow-sm',
    ghost: 'text-zinc-600 hover:bg-zinc-100',
  }[variant]
  const s = size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-2 text-sm'
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      className={`inline-flex items-center gap-1.5 rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${v} ${s}`}>
      {children}
    </button>
  )
}

export const SearchBox = ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) => (
  <div className="relative">
    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      className="w-72 rounded-lg border-0 bg-white py-2 pl-9 pr-3 text-sm shadow-sm ring-1 ring-inset ring-zinc-300 placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-900 focus:outline-none" />
  </div>
)

export const Select = ({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: ReactNode }) => (
  <select value={value} onChange={(e) => onChange(e.target.value)}
    className="rounded-lg border-0 bg-white py-2 pl-3 pr-8 text-sm shadow-sm ring-1 ring-inset ring-zinc-300 focus:ring-2 focus:ring-zinc-900 focus:outline-none">
    {children}
  </select>
)

export const Stat = ({ label, value }: { label: string; value: ReactNode }) => (
  <div>
    <div className="text-xs font-medium text-zinc-500">{label}</div>
    <div className="mt-1 text-sm text-zinc-900">{value ?? '—'}</div>
  </div>
)
