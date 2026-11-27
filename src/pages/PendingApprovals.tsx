import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useFilings } from '../lib/useFilings'
import { applyFilters, emptyFilters, Filters } from '../components/Filters'
import { Card, Dot, Empty, Loading, Main, PageHeader, Sub, Table, Td, Tr, days, stageLabel } from '../components/ui'
import { date, daysSince } from '../lib/format'
import { yearPath, type Filing, type FilingStatus } from '../lib/types'

const SHOWN: FilingStatus[] = ['emailed_waiting', 'client_confirmed', 'client_modified_ach', 'client_modified_method']
const needsUltraTax = (f: Filing) => f.payment_lines.some((l) => l.response === 'modified' && l.new_method === 'efw' && !l.entered_in_ultratax_at)
const rank = (f: Filing) => (needsUltraTax(f) || f.status === 'client_modified_method' ? 0 : f.status === 'emailed_waiting' ? 1 : 2)

function NextStep({ f }: { f: Filing }) {
  if (needsUltraTax(f)) return <Dot tone="red">Enter new bank in UltraTax</Dot>
  if (f.status === 'client_modified_method') return <Dot tone="amber">Ask preparer about new method</Dot>
  if (f.status === 'client_confirmed') return <Dot tone="green">Ready: final pull and file</Dot>
  return <Dot tone="zinc">Waiting for the client</Dot>
}

export function PendingApprovals() {
  const nav = useNavigate()
  const { filings, loading, error } = useFilings((q) => q.in('status', SHOWN))
  const [flt, setFlt] = useState(emptyFilters)
  const rows = applyFilters(filings, flt).sort((a, b) => rank(a) - rank(b) || (a.email_sent_at ?? '').localeCompare(b.email_sent_at ?? ''))

  return (
    <>
      <PageHeader title="Client approvals" sub="Emails sent before filing, and whether the client answered. What needs you is on top." />
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <Filters filings={filings} value={flt} onChange={setFlt} statuses={SHOWN} />
      <Card>
        {loading ? <Loading /> : !rows.length ? <Empty title="Nothing waiting on clients" /> : (
          <Table cols={[['Client'], ['Year', '150px'], ['Emailed', '130px'], ['Waiting', '110px', 'right'], ['Next step', '270px'], ['', '90px', 'right']]}>
            {rows.map((f) => (
              <Tr key={f.id} onClick={() => nav(yearPath(f))}>
                <Td><Main>{f.entities.name}</Main><Sub>{f.entities.client_groups?.name ?? 'Not in a client group'}</Sub></Td>
                <Td><Main>{f.tax_year}</Main><Sub>{stageLabel(f.stage)}</Sub></Td>
                <Td className="text-zinc-600">{date(f.email_sent_at)}</Td>
                <Td right className="tabular-nums text-zinc-600">{days(daysSince(f.email_sent_at))}</Td>
                <Td><NextStep f={f} /></Td>
                <Td right><span className="inline-flex items-center gap-1 text-sm font-medium text-zinc-900">Open<ArrowRight className="h-4 w-4" /></span></Td>
              </Tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  )
}
