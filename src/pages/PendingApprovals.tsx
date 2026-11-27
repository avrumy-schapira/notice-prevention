import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useFilings } from '../lib/useFilings'
import { applyFilters, emptyFilters, Filters } from '../components/Filters'
import { Card, Empty, PageHeader, Pill, StatusBadge, Td, Th } from '../components/ui'
import { date, daysSince } from '../lib/format'
import type { Filing, FilingStatus } from '../lib/types'

const SHOWN: FilingStatus[] = ['emailed_waiting', 'client_confirmed', 'client_modified_ach', 'client_modified_method']

const needsUltraTax = (f: Filing) =>
  f.payment_lines.some((l) => l.response === 'modified' && l.new_method === 'efw' && !l.entered_in_ultratax_at)

// Top: modified + UltraTax not updated -> waiting longest -> ready to file
function rank(f: Filing) {
  if (needsUltraTax(f) || f.status === 'client_modified_method') return 0
  if (f.status === 'emailed_waiting') return 1
  return 2
}

export function PendingApprovals() {
  const { filings, loading, error } = useFilings((q) => q.in('status', SHOWN))
  const [flt, setFlt] = useState(emptyFilters)
  const rows = applyFilters(filings, flt).sort((a, b) =>
    rank(a) - rank(b) || (a.email_sent_at ?? '').localeCompare(b.email_sent_at ?? ''))

  return (
    <>
      <PageHeader title="Pending approvals" sub="Emailed to the client, not yet filed" />
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <Filters filings={filings} value={flt} onChange={setFlt} statuses={SHOWN} />
      <Card>
        {loading ? <Empty>Loading…</Empty> : !rows.length ? <Empty>Nothing pending.</Empty> : (
          <table className="w-full">
            <thead className="border-b border-slate-200"><tr><Th>Client</Th><Th>Year</Th><Th>Stage</Th><Th>Status</Th><Th>Sent</Th><Th>Days waiting</Th><Th>Attention</Th></tr></thead>
            <tbody>
              {rows.map((f) => (
                <tr key={f.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <Td><Link className="font-medium hover:underline" to={`/filing/${f.id}`}>{f.entities.name}</Link> <span className="text-xs text-slate-400">{f.entities.client_id}</span></Td>
                  <Td>{f.tax_year}</Td>
                  <Td className="capitalize">{f.stage}</Td>
                  <Td><StatusBadge status={f.status} /></Td>
                  <Td>{date(f.email_sent_at)}</Td>
                  <Td>{f.status === 'emailed_waiting' ? daysSince(f.email_sent_at) ?? '—' : '—'}</Td>
                  <Td>
                    {needsUltraTax(f) && <Pill tone="red">New ACH not in UltraTax</Pill>}
                    {f.status === 'client_modified_method' && <Pill tone="amber">Method changed — Karbon</Pill>}
                    {f.status === 'client_confirmed' && <Pill tone="green">Ready: final pull → file</Pill>}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  )
}
