import type { Filing } from '../lib/types'
import { STATUS_LABEL, type FilingStatus } from '../lib/types'

export type FilterState = { status: string; preparer: string; stage: string; group: string; search: string; payDate?: string }
export const emptyFilters: FilterState = { status: '', preparer: '', stage: '', group: '', search: '', payDate: '' }

export function applyFilters(filings: Filing[], f: FilterState) {
  const s = f.search.trim().toLowerCase()
  return filings.filter((x) =>
    (!f.status || x.status === f.status) &&
    (!f.preparer || x.entities.assigned_preparer === f.preparer) &&
    (!f.stage || x.stage === f.stage) &&
    (!f.group || x.entities.client_groups?.name === f.group) &&
    (!s || [x.entities.name, x.entities.client_id, x.entities.client_groups?.name].some((v) => v?.toLowerCase().includes(s))),
  )
}

const uniq = (a: (string | null | undefined)[]) => [...new Set(a.filter(Boolean) as string[])].sort()

export function Filters({ filings, value, onChange, statuses, showPayDate }: {
  filings: Filing[]; value: FilterState; onChange: (f: FilterState) => void; statuses?: FilingStatus[]; showPayDate?: boolean
}) {
  const set = (k: keyof FilterState) => (e: { target: { value: string } }) => onChange({ ...value, [k]: e.target.value })
  const sel = 'rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm'
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      <input className={`${sel} w-56`} placeholder="Search client or ID" value={value.search} onChange={set('search')} />
      <select className={sel} value={value.status} onChange={set('status')}>
        <option value="">All statuses</option>
        {(statuses ?? (Object.keys(STATUS_LABEL) as FilingStatus[])).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
      </select>
      <select className={sel} value={value.preparer} onChange={set('preparer')}>
        <option value="">All preparers</option>
        {uniq(filings.map((f) => f.entities.assigned_preparer)).map((p) => <option key={p}>{p}</option>)}
      </select>
      <select className={sel} value={value.stage} onChange={set('stage')}>
        <option value="">Extension + return</option>
        <option value="extension">Extension</option>
        <option value="return">Return</option>
      </select>
      <select className={sel} value={value.group} onChange={set('group')}>
        <option value="">All client groups</option>
        {uniq(filings.map((f) => f.entities.client_groups?.name)).map((g) => <option key={g}>{g}</option>)}
      </select>
      {showPayDate && (
        <input type="date" className={sel} value={value.payDate} onChange={set('payDate')} title="Payment date" />
      )}
    </div>
  )
}
