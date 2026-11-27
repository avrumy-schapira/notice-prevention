import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFilings } from '../lib/useFilings'
import { applyFilters, emptyFilters, Filters } from '../components/Filters'
import { Card, Empty, Loading, PageHeader, SectionTitle, StatusBadge, Table, Td } from '../components/ui'
import { date, person } from '../lib/format'
import { yearPath, type Filing, type FilingStatus } from '../lib/types'

const PART1: FilingStatus[] = ['not_started', 'pulled_flags_open', 'ready_to_email']
const PART2: FilingStatus[] = ['emailed_waiting', 'client_confirmed', 'client_modified_ach', 'client_modified_method']

function Rows({ rows }: { rows: Filing[] }) {
  const nav = useNavigate()
  if (!rows.length) return <Empty title="Nothing here" />
  return (
    <Table head={['Client', 'Year', 'Stage', 'Status', 'Last pull', 'Preparer']}>
      {rows.map((f) => (
        <tr key={f.id} onClick={() => nav(yearPath(f))} className="cursor-pointer hover:bg-zinc-50">
          <Td><div className="font-medium">{f.entities.name}</div><div className="text-xs text-zinc-500">{f.entities.client_groups?.name}</div></Td>
          <Td className="tabular-nums">{f.tax_year}</Td>
          <Td className="capitalize">{f.stage}</Td>
          <Td><StatusBadge status={f.status} /></Td>
          <Td className="text-zinc-600">{date(f.last_pull_at)}</Td>
          <Td className="text-zinc-600">{person(f.entities.assigned_preparer)}</Td>
        </tr>
      ))}
    </Table>
  )
}

export function Workload() {
  const { filings, loading, error } = useFilings((q) => q.neq('status', 'filed'))
  const [f, setF] = useState(emptyFilters)
  const rows = applyFilters(filings, f)
  return (
    <>
      <PageHeader title="Admin workload" sub="Each extension and return stays here until it's marked filed. Start one from the client's page." />
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <Filters filings={filings} value={f} onChange={setF} statuses={[...PART1, ...PART2]} />
      <SectionTitle>Before the email</SectionTitle>
      <Card className="mb-8">{loading ? <Loading /> : <Rows rows={rows.filter((x) => PART1.includes(x.status))} />}</Card>
      <SectionTitle>After the client responds</SectionTitle>
      <Card>{loading ? <Loading /> : <Rows rows={rows.filter((x) => PART2.includes(x.status))} />}</Card>
    </>
  )
}
