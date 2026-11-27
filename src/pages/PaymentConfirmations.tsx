import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useFilings } from '../lib/useFilings'
import { supabase } from '../lib/supabase'
import { applyFilters, emptyFilters, Filters } from '../components/Filters'
import { Badge, Button, Card, Empty, Loading, PageHeader, Sub, Table, Td, Tr } from '../components/ui'
import { date, method, money } from '../lib/format'
import { yearPath, type Filing, type PaymentLine } from '../lib/types'

type Row = { filing: Filing; line: PaymentLine }
const needsManual = (l: PaymentLine) => l.manual_payment_needed || l.client_paid_response === 'not_paid'
// Top: not paid / manual payment needed -> no response -> client confirmed paid
const rank = (l: PaymentLine) => (needsManual(l) ? 0 : l.client_paid_response == null ? 1 : 2)

export function PaymentConfirmations() {
  const { filings, loading, error, reload } = useFilings()
  const [flt, setFlt] = useState(emptyFilters)
  const [busy, setBusy] = useState<string | null>(null)
  const today = new Date().toISOString().slice(0, 10)

  const rows: Row[] = applyFilters(filings, flt)
    .flatMap((filing) => filing.payment_lines.map((line) => ({ filing, line })))
    .filter(({ line }) => line.direction === 'due' && line.payment_status === 'pending' && line.payment_date != null && line.payment_date < today && (!flt.payDate || line.payment_date === flt.payDate))
    .sort((a, b) => rank(a.line) - rank(b.line) || (a.line.payment_date ?? '').localeCompare(b.line.payment_date ?? ''))

  const mark = async (id: string, status: 'verified' | 'manual_paid') => {
    setBusy(id)
    const { error } = await supabase.rpc('set_payment_status', { p_line: id, p_status: status })
    if (error) alert(error.message)
    setBusy(null); reload()
  }

  return (
    <>
      <PageHeader title="Payment confirmations" sub="Payment date passed and not verified yet" />
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <Filters filings={filings} value={flt} onChange={setFlt} showPayDate />
      <Card>
        {loading ? <Loading /> : !rows.length ? <Empty title="All payments verified" /> : (
          <Table cols={[['Client'], ['Department', '16%'], ['Amount', '130px', 'right'], ['Method', '170px'], ['Date', '130px'], ['Client says', '120px'], ['', '330px', 'right']]}>
            {rows.map(({ filing, line }) => (
              <Tr key={line.id}>
                <Td><Link to={yearPath(filing)} className="block truncate font-medium hover:underline">{filing.entities.name}</Link><Sub>{filing.tax_year} {filing.stage}</Sub></Td>
                <Td><div className="truncate">{line.department}</div><Sub>{line.tax_type}</Sub></Td>
                <Td right className="font-medium tabular-nums">{money(line.amount)}</Td>
                <Td>{method(line.new_method ?? line.method)}{(line.new_last4 ?? line.bank_last4) && <span className="text-zinc-500"> · •••• {line.new_last4 ?? line.bank_last4}</span>}</Td>
                <Td className="tabular-nums">{date(line.payment_date)}</Td>
                <Td>{needsManual(line) ? <Badge tone="red">Not paid</Badge> : line.client_paid_response === 'paid' ? <Badge tone="green">Paid</Badge> : <Badge>No response</Badge>}</Td>
                <Td right className="overflow-visible">
                  <span className="inline-flex gap-2">
                    {needsManual(line) && <Button disabled={busy === line.id} onClick={() => mark(line.id, 'manual_paid')}>Paid manually</Button>}
                    <Button variant="primary" disabled={busy === line.id} onClick={() => mark(line.id, 'verified')}>Verified on state site</Button>
                  </span>
                </Td>
              </Tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  )
}
