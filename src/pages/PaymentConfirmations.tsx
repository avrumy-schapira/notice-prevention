import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useFilings } from '../lib/useFilings'
import { supabase } from '../lib/supabase'
import { applyFilters, emptyFilters, Filters } from '../components/Filters'
import { Button, Card, Empty, PageHeader, Pill, Td, Th } from '../components/ui'
import { date, method, money } from '../lib/format'
import type { Filing, PaymentLine } from '../lib/types'

type Row = { filing: Filing; line: PaymentLine }

const rank = (l: PaymentLine) =>
  l.client_paid_response === 'not_paid' || l.manual_payment_needed ? 0 : l.client_paid_response == null ? 1 : 2

export function PaymentConfirmations() {
  const { filings, loading, error, reload } = useFilings()
  const [flt, setFlt] = useState(emptyFilters)
  const [busy, setBusy] = useState<string | null>(null)
  const today = new Date().toISOString().slice(0, 10)

  const rows: Row[] = applyFilters(filings, flt)
    .flatMap((filing) => filing.payment_lines.map((line) => ({ filing, line })))
    .filter(({ line }) =>
      line.direction === 'due' && line.payment_status === 'pending' &&
      line.payment_date != null && line.payment_date < today &&
      (!flt.payDate || line.payment_date === flt.payDate))
    .sort((a, b) => rank(a.line) - rank(b.line) || (a.line.payment_date ?? '').localeCompare(b.line.payment_date ?? ''))

  const mark = async (id: string, status: 'verified' | 'manual_paid') => {
    setBusy(id)
    const { error } = await supabase.rpc('set_payment_status', { p_line: id, p_status: status })
    if (error) alert(error.message)
    setBusy(null)
    reload()
  }

  return (
    <>
      <PageHeader title="Payment confirmations" sub="Payment date passed, not yet verified" />
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <Filters filings={filings} value={flt} onChange={setFlt} showPayDate />
      <Card>
        {loading ? <Empty>Loading…</Empty> : !rows.length ? <Empty>No payments waiting for confirmation.</Empty> : (
          <table className="w-full">
            <thead className="border-b border-slate-200"><tr><Th>Client</Th><Th>Department</Th><Th>Amount</Th><Th>Method</Th><Th>Bank</Th><Th>Payment date</Th><Th>Client says</Th><Th></Th></tr></thead>
            <tbody>
              {rows.map(({ filing, line }) => (
                <tr key={line.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <Td><Link className="font-medium hover:underline" to={`/filing/${filing.id}`}>{filing.entities.name}</Link> <span className="text-xs text-slate-400">{filing.tax_year} {filing.stage}</span></Td>
                  <Td>{line.department} <span className="text-xs text-slate-500">{line.tax_type}{line.owner ? ` (${line.owner})` : ''}</span></Td>
                  <Td>{money(line.amount)}</Td>
                  <Td>{method(line.new_method ?? line.method)}</Td>
                  <Td>{line.new_last4 ?? line.bank_last4 ? `…${line.new_last4 ?? line.bank_last4}` : '—'}</Td>
                  <Td>{date(line.payment_date)}</Td>
                  <Td>
                    {line.manual_payment_needed || line.client_paid_response === 'not_paid'
                      ? <Pill tone="red">Not paid — manual payment needed</Pill>
                      : line.client_paid_response === 'paid' ? <Pill tone="green">Paid</Pill> : <Pill>No response</Pill>}
                  </Td>
                  <Td className="whitespace-nowrap text-right">
                    <span className="inline-flex gap-2">
                      <Button disabled={busy === line.id} onClick={() => mark(line.id, 'verified')}>Verified on state site</Button>
                      {(line.manual_payment_needed || line.client_paid_response === 'not_paid') &&
                        <Button disabled={busy === line.id} onClick={() => mark(line.id, 'manual_paid')}>Manual payment done</Button>}
                    </span>
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
