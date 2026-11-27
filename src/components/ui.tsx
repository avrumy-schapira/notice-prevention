import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Search } from 'lucide-react'
import { STATUS_LABEL, type FilingStatus } from '../lib/types'

/* One look everywhere: 14px text, 36px controls, 8px radius, fixed-width tables. */

type Tone = 'zinc' | 'blue' | 'green' | 'amber' | 'red' | 'violet'
const TONE: Record<Tone, string> = {
  zinc: 'bg-zinc-100 text-zinc-700',
  blue: 'bg-blue-50 text-blue-700',
  green: 'bg-emerald-50 text-emerald-700',
  amber: 'bg-amber-50 text-amber-800',
  red: 'bg-red-50 text-red-700',
  violet: 'bg-violet-50 text-violet-700',
}

export const Badge = ({ children, tone = 'zinc' }: { children: ReactNode; tone?: Tone; dot?: boolean }) => (
  <span className={`inline-flex h-6 items-center whitespace-nowrap rounded-md px-2 text-xs font-medium ${TONE[tone]}`}>{children}</span>
)

const STATUS_TONE: Record<FilingStatus, Tone> = {
  not_started: 'zinc', pulled_flags_open: 'amber', ready_to_email: 'blue', emailed_waiting: 'violet',
  client_confirmed: 'green', client_modified_ach: 'amber', client_modified_method: 'amber', filed: 'zinc',
}
export const StatusBadge = ({ status }: { status: FilingStatus }) => <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
export const StageBadge = ({ stage }: { stage: string | null | undefined }) =>
  <Badge tone={stage === 'extension' ? 'violet' : 'blue'}>{stage === 'extension' ? 'Extension' : 'Return'}</Badge>

export const Crumbs = ({ items }: { items: { label: string; to?: string }[] }) => (
  <nav className="mb-2 flex h-5 items-center gap-1 text-sm text-zinc-500">
    {items.map((c, i) => (
      <span key={i} className="flex min-w-0 items-center gap-1">
        {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-zinc-300" />}
        {c.to ? <Link to={c.to} className="truncate hover:text-zinc-900">{c.label}</Link> : <span className="truncate text-zinc-700">{c.label}</span>}
      </span>
    ))}
  </nav>
)

export const PageHeader = ({ title, sub, right, crumbs }: { title: ReactNode; sub?: ReactNode; right?: ReactNode; crumbs?: { label: string; to?: string }[] }) => (
  <div className="mb-6">
    {crumbs && <Crumbs items={crumbs} />}
    <div className="flex min-h-9 items-center justify-between gap-4">
      <h1 className="truncate text-2xl font-semibold tracking-tight text-zinc-900">{title}</h1>
      {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
    </div>
    {sub && <p className="mt-1 text-sm text-zinc-500">{sub}</p>}
  </div>
)

export const Card = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <div className={`overflow-hidden rounded-lg border border-zinc-200 bg-white ${className}`}>{children}</div>
)

export const SectionTitle = ({ children, right }: { children: ReactNode; right?: ReactNode }) => (
  <div className="mb-3 flex h-9 items-center justify-between">
    <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-900">{children}</h2>
    {right && <div className="flex items-center gap-2">{right}</div>}
  </div>
)

export const Empty = ({ title, children }: { title: string; children?: ReactNode }) => (
  <div className="px-6 py-12 text-center">
    <p className="text-sm font-medium text-zinc-700">{title}</p>
    {children && <p className="mt-1 text-sm text-zinc-500">{children}</p>}
  </div>
)

export const Loading = ({ rows = 5 }: { rows?: number }) => (
  <div className="divide-y divide-zinc-100">
    {Array.from({ length: rows }).map((_, i) => <div key={i} className="flex h-12 items-center px-4"><div className="h-3 w-1/3 animate-pulse rounded bg-zinc-100" /></div>)}
  </div>
)

/* Tables: fixed layout so columns never move. cols = [label, width] */
export type Col = [label: string, width?: string, align?: 'right']
export const Table = ({ cols, children }: { cols: Col[]; children: ReactNode }) => (
  <table className="w-full table-fixed text-sm">
    <colgroup>{cols.map(([, w], i) => <col key={i} style={w ? { width: w } : undefined} />)}</colgroup>
    <thead>
      <tr className="h-10 border-b border-zinc-200 bg-zinc-50/70">
        {cols.map(([l, , a], i) => <th key={i} className={`px-4 text-xs font-medium text-zinc-500 ${a === 'right' ? 'text-right' : 'text-left'}`}>{l}</th>)}
      </tr>
    </thead>
    <tbody className="divide-y divide-zinc-100">{children}</tbody>
  </table>
)
export const Tr = ({ children, onClick, className = '' }: { children: ReactNode; onClick?: () => void; className?: string }) => (
  <tr onClick={onClick} className={`h-12 ${onClick ? 'cursor-pointer hover:bg-zinc-50' : ''} ${className}`}>{children}</tr>
)
export const Td = ({ children, className = '', right }: { children?: ReactNode; className?: string; right?: boolean }) => (
  <td className={`truncate px-4 ${right ? 'text-right' : ''} ${className}`}>{children}</td>
)
export const Sub = ({ children }: { children: ReactNode }) => <div className="truncate text-xs text-zinc-500">{children}</div>

export const Button = ({ children, onClick, variant = 'secondary', disabled, title }: {
  children: ReactNode; onClick?: () => void; variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; disabled?: boolean; title?: string; size?: string
}) => {
  const v = {
    primary: 'bg-zinc-900 text-white hover:bg-zinc-800 border border-zinc-900',
    secondary: 'bg-white text-zinc-800 border border-zinc-300 hover:bg-zinc-50',
    ghost: 'border border-transparent text-zinc-600 hover:bg-zinc-100',
    danger: 'bg-white text-red-600 border border-zinc-300 hover:bg-red-50',
  }[variant]
  return (
    <button onClick={(e) => { e.stopPropagation(); onClick?.() }} disabled={disabled} title={title}
      className={`inline-flex h-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 [&>svg]:h-4 [&>svg]:w-4 ${v}`}>
      {children}
    </button>
  )
}

export const control = 'h-9 rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900'

export const SearchBox = ({ value, onChange, placeholder, width = 'w-72' }: { value: string; onChange: (v: string) => void; placeholder: string; width?: string }) => (
  <div className={`relative ${width}`}>
    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`${control} w-full pl-9`} />
  </div>
)

export const Select = ({ value, onChange, children, width = '' }: { value: string; onChange: (v: string) => void; children: ReactNode; width?: string }) => (
  <select value={value} onChange={(e) => onChange(e.target.value)} className={`${control} pr-8 ${width}`}>{children}</select>
)

export const Stat = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className="min-w-0">
    <div className="text-xs font-medium text-zinc-500">{label}</div>
    <div className="mt-1 truncate text-sm text-zinc-900">{value ?? '—'}</div>
  </div>
)
