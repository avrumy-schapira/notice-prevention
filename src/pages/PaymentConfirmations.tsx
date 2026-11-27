import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFilings } from '../lib/useFilings'
import { supabase } from '../lib/supabase'
import { applyFilters, emptyFilters, Filters } from '../components/Filters'
import { Button, Card, Dot, Empty, Loading, Main, PageHeader, Sub, Table, Td, Tr, stageLabel } from '../components/ui'
import { date, method, money } from '../lib/format'
import { yearPath, type Filing, type PaymentLine } from '../lib/types'

type Row = { filing: Filing; line: PaymentLine }
const notPaid = (l: PaymentLine) => l.manual_payment_needed || l.client_paid_response === 'not_paid'
const rank = (l: PaymentLine) => (notPaid(l) ? 0 : l.client_paid_response == null ? 1 : 2)

export function PaymentConfirmations() {
  const nav = useNavigate()
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
      <PageHeader title="Payment confirmations" sub="Return payments whose date has passed. Not paid is on top." />
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <Filters filings={filings} value={flt} onChange={setFlt} showPayDate hideStatus />
      <Card>
        {loading ? <Loading /> : !rows.length ? <Empty title="All payments are confirmed" /> : (
          <Table cols={[['Client'], ['Payment', '190px'], ['Amount', '120px', 'right'], ['Date', '120px'], ['Client says', '140px'], ['', '200px', 'right']]}>
            {rows.map(({ filing, line }) => (
              <Tr key={line.id} onClick={() => nav(yearPath(filing))}>
                <Td><Main>{filing.entities.name}</Main><Sub>{filing.tax_year} {stageLabel(filing.stage).toLowerCase()}</Sub></Td>
                <Td><Main>{line.department}</Main><Sub>{method(line.new_method ?? line.method)}{(line.new_last4 ?? line.bank_last4) ? ` · •••• ${line.new_last4 ?? line.bank_last4}` : ''}</Sub></Td>
                <Td right className="font-medium tabular-nums">{money(line.amount)}</Td>
                <Td className="text-zinc-600">{date(line.payment_date)}</Td>
                <Td>{notPaid(line) ? <Dot tone="red">Not paid</Dot> : line.client_paid_response === 'paid' ? <Dot tone="green">Paid</Dot> : <Dot tone="zinc">No answer</Dot>}</Td>
                <Td right>
                  {notPaid(line)
                    ? <Button disabled={busy === line.id} onClick={() => mark(line.id, 'manual_paid')}>Paid manually</Button>
                    : <Button disabled={busy === line.id} onClick={() => mark(line.id, 'verified')}>Verified on site</Button>}
                </Td>
              </Tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  )
}
