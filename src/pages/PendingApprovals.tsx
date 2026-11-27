import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFilings } from '../lib/useFilings'
import { applyFilters, emptyFilters, Filters } from '../components/Filters'
import { Badge, Card, Empty, Loading, PageHeader, StatusBadge, Table, Td } from '../components/ui'
import { date, daysSince } from '../lib/format'
import { yearPath, type Filing, type FilingStatus } from '../lib/types'

const SHOWN: FilingStatus[] = ['emailed_waiting', 'client_confirmed', 'client_modified_ach', 'client_modified_method']
const needsUltraTax = (f: Filing) => f.payment_lines.some((l) => l.response === 'modified' && l.new_method === 'efw' && !l.entered_in_ultratax_at)
// Top: modified and UltraTax not updated -> waiting longest -> ready to file
const rank = (f: Filing) => (needsUltraTax(f) || f.status === 'client_modified_method' ? 0 : f.status === 'emailed_waiting' ? 1 : 2)

export function PendingApprovals() {
  const nav = useNavigate()
  const { filings, loading, error } = useFilings((q) => q.in('status', SHOWN))
  const [flt, setFlt] = useState(emptyFilters)
  const rows = applyFilters(filings, flt).sort((a, b) => rank(a) - rank(b) || (a.email_sent_at ?? '').localeCompare(b.email_sent_at ?? ''))

  return (
    <>
      <PageHeader title="Pending approvals" sub="Emailed to the client, not filed yet" />
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <Filters filings={filings} value={flt} onChange={setFlt} statuses={SHOWN} />
      <Card>
        {loading ? <Loading /> : !rows.length ? <Empty title="Nothing pending" /> : (
          <Table head={['Client', 'Year', 'Stage', 'Status', 'Emailed', 'Waiting', 'Next step']}>
            {rows.map((f) => (
              <tr key={f.id} onClick={() => nav(yearPath(f))} className="cursor-pointer hover:bg-zinc-50">
                <Td><div className="font-medium">{f.entities.name}</div><div className="text-xs text-zinc-500">{f.entities.client_groups?.name}</div></Td>
                <Td className="tabular-nums">{f.tax_year}</Td>
                <Td className="capitalize">{f.stage}</Td>
                <Td><StatusBadge status={f.status} /></Td>
                <Td className="text-zinc-600">{date(f.email_sent_at)}</Td>
                <Td className="tabular-nums text-zinc-600">{f.status === 'emailed_waiting' ? `${daysSince(f.email_sent_at)} days` : '—'}</Td>
                <Td>
                  {needsUltraTax(f) ? <Badge tone="red">Enter new bank in UltraTax</Badge>
                    : f.status === 'client_modified_method' ? <Badge tone="amber">Karbon comment to preparer</Badge>
                      : f.status === 'client_confirmed' ? <Badge tone="green">Final pull → file</Badge>
                        : <span className="text-zinc-400">Wait for client</span>}
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  )
}
