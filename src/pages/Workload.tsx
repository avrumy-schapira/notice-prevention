import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useFilings } from '../lib/useFilings'
import { applyFilters, emptyFilters, Filters } from '../components/Filters'
import { Card, Empty, PageHeader, StatusBadge, Td, Th } from '../components/ui'
import { date } from '../lib/format'
import type { Filing, FilingStatus } from '../lib/types'

const PART1: FilingStatus[] = ['not_started', 'pulled_flags_open', 'ready_to_email']
const PART2: FilingStatus[] = ['emailed_waiting', 'client_confirmed', 'client_modified_ach', 'client_modified_method']

function Table({ rows }: { rows: Filing[] }) {
  if (!rows.length) return <Empty>Nothing here.</Empty>
  return (
    <table className="w-full">
      <thead className="border-b border-slate-200"><tr><Th>Client</Th><Th>Group</Th><Th>Year</Th><Th>Stage</Th><Th>Status</Th><Th>Last pull</Th><Th>Preparer</Th></tr></thead>
      <tbody>
        {rows.map((f) => (
          <tr key={f.id} className="border-b border-slate-100 hover:bg-slate-50">
            <Td><Link className="font-medium text-slate-900 underline-offset-2 hover:underline" to={`/filing/${f.id}`}>{f.entities.name}</Link> <span className="text-xs text-slate-400">{f.entities.client_id}</span></Td>
            <Td>{f.entities.client_groups?.name ?? '—'}</Td>
            <Td>{f.tax_year}</Td>
            <Td className="capitalize">{f.stage}</Td>
            <Td><StatusBadge status={f.status} /></Td>
            <Td>{date(f.last_pull_at)}</Td>
            <Td>{f.entities.assigned_preparer ?? '—'}</Td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function Workload() {
  const { filings, loading, error } = useFilings((q) => q.neq('status', 'filed'))
  const [f, setF] = useState(emptyFilters)
  const rows = applyFilters(filings, f)
  return (
    <>
      <PageHeader title="Admin workload" sub="Stays here until marked filed" />
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <Filters filings={filings} value={f} onChange={setF} statuses={[...PART1, ...PART2]} />
      <h2 className="mb-2 text-sm font-semibold text-slate-700">Part 1 — before the email</h2>
      <Card className="mb-6">{loading ? <Empty>Loading…</Empty> : <Table rows={rows.filter((x) => PART1.includes(x.status))} />}</Card>
      <h2 className="mb-2 text-sm font-semibold text-slate-700">Part 2 — filing day, after the client responds</h2>
      <Card>{loading ? <Empty>Loading…</Empty> : <Table rows={rows.filter((x) => PART2.includes(x.status))} />}</Card>
    </>
  )
}
