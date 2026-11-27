import type { Filing } from '../lib/types'
import { STATUS_LABEL, type FilingStatus } from '../lib/types'
import { person } from '../lib/format'
import { SearchBox, Select } from './ui'

export type FilterState = { status: string; preparer: string; stage: string; group: string; search: string; payDate?: string }
export const emptyFilters: FilterState = { status: '', preparer: '', stage: '', group: '', search: '', payDate: '' }

export function applyFilters(filings: Filing[], f: FilterState) {
  const s = f.search.trim().toLowerCase()
  return filings.filter((x) =>
    (!f.status || x.status === f.status) &&
    (!f.preparer || x.entities.assigned_preparer === f.preparer) &&
    (!f.stage || x.stage === f.stage) &&
    (!f.group || x.entities.client_groups?.name === f.group) &&
    (!s || [x.entities.name, x.entities.client_id, x.entities.client_groups?.name].some((v) => v?.toLowerCase().includes(s))))
}

const uniq = (a: (string | null | undefined)[]) => [...new Set(a.filter(Boolean) as string[])].sort()

export function Filters({ filings, value, onChange, statuses, showPayDate }: {
  filings: Filing[]; value: FilterState; onChange: (f: FilterState) => void; statuses?: FilingStatus[]; showPayDate?: boolean
}) {
  const set = (k: keyof FilterState) => (v: string) => onChange({ ...value, [k]: v })
  return (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      <SearchBox value={value.search} onChange={set('search')} placeholder="Search client or ID" />
      <Select value={value.status} onChange={set('status')}>
        <option value="">All statuses</option>
        {(statuses ?? (Object.keys(STATUS_LABEL) as FilingStatus[])).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
      </Select>
      <Select value={value.preparer} onChange={set('preparer')}>
        <option value="">All preparers</option>
        {uniq(filings.map((f) => f.entities.assigned_preparer)).map((p) => <option key={p} value={p}>{person(p)}</option>)}
      </Select>
      <Select value={value.stage} onChange={set('stage')}>
        <option value="">Extension + return</option>
        <option value="extension">Extension</option>
        <option value="return">Return</option>
      </Select>
      <Select value={value.group} onChange={set('group')}>
        <option value="">All client groups</option>
        {uniq(filings.map((f) => f.entities.client_groups?.name)).map((g) => <option key={g}>{g}</option>)}
      </Select>
      {showPayDate && (
        <input type="date" value={value.payDate} onChange={(e) => set('payDate')(e.target.value)} title="Payment date"
          className="rounded-lg border-0 bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-inset ring-zinc-300 focus:ring-2 focus:ring-zinc-900 focus:outline-none" />
      )}
    </div>
  )
}
