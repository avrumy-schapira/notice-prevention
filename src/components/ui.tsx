import type { ReactNode } from 'react'
import { STATUS_LABEL, type FilingStatus } from '../lib/types'

const STATUS_COLOR: Record<FilingStatus, string> = {
  not_started: 'bg-slate-100 text-slate-700',
  pulled_flags_open: 'bg-amber-100 text-amber-800',
  ready_to_email: 'bg-sky-100 text-sky-800',
  emailed_waiting: 'bg-slate-100 text-slate-700',
  client_confirmed: 'bg-emerald-100 text-emerald-800',
  client_modified_ach: 'bg-orange-100 text-orange-800',
  client_modified_method: 'bg-orange-100 text-orange-800',
  filed: 'bg-slate-200 text-slate-600',
}

export const StatusBadge = ({ status }: { status: FilingStatus }) => (
  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[status]}`}>
    {STATUS_LABEL[status]}
  </span>
)

export const Pill = ({ children, tone = 'slate' }: { children: ReactNode; tone?: 'slate' | 'red' | 'amber' | 'green' }) => {
  const c = { slate: 'bg-slate-100 text-slate-700', red: 'bg-red-100 text-red-800', amber: 'bg-amber-100 text-amber-800', green: 'bg-emerald-100 text-emerald-800' }[tone]
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${c}`}>{children}</span>
}

export const PageHeader = ({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) => (
  <div className="mb-5 flex items-end justify-between gap-4">
    <div>
      <h1 className="text-xl font-semibold">{title}</h1>
      {sub && <p className="text-sm text-slate-500">{sub}</p>}
    </div>
    {right}
  </div>
)

export const Card = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <div className={`rounded-lg border border-slate-200 bg-white ${className}`}>{children}</div>
)

export const Empty = ({ children }: { children: ReactNode }) => (
  <div className="px-4 py-10 text-center text-sm text-slate-500">{children}</div>
)

export const Th = ({ children }: { children?: ReactNode }) => (
  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate-500">{children}</th>
)
export const Td = ({ children, className = '' }: { children?: ReactNode; className?: string }) => (
  <td className={`px-3 py-2 text-sm ${className}`}>{children}</td>
)

export const Button = ({ children, onClick, variant = 'secondary', disabled }: {
  children: ReactNode; onClick?: () => void; variant?: 'primary' | 'secondary'; disabled?: boolean
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${
      variant === 'primary' ? 'bg-slate-900 text-white hover:bg-slate-700' : 'border border-slate-300 bg-white hover:bg-slate-50'
    }`}
  >
    {children}
  </button>
)
