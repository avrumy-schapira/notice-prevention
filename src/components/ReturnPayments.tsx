import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { date, method, money } from '../lib/format'
import { Badge, Card, Empty, Loading, StageBadge, Sub, Table, Td, Tr } from './ui'

type Line = { id: string; department: string; tax_type: string; direction: string | null; amount: number | null; method: string | null; payment_date: string | null; bank_last4: string | null; response: string; payment_status: string
  filings: { tax_year: number; stage: string; entity_id: string; entities: { name: string } } }

export function ReturnPayments({ entityIds, showEntity }: { entityIds: string[]; showEntity?: boolean }) {
  const nav = useNavigate()
  const [lines, setLines] = useState<Line[] | null>(null)
  const key = entityIds.join(',')
  useEffect(() => {
    if (!entityIds.length) { setLines([]); return }
    supabase.from('payment_lines').select('id, department, tax_type, direction, amount, method, payment_date, bank_last4, response, payment_status, filings!inner(tax_year, stage, entity_id, entities(name))')
      .in('filings.entity_id', entityIds).then(({ data }) => setLines(((data as unknown as Line[]) ?? []).sort((a, b) => b.filings.tax_year - a.filings.tax_year || (a.payment_date ?? '').localeCompare(b.payment_date ?? ''))))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return (
    <Card>
      {!lines ? <Loading rows={3} /> : !lines.length ? <Empty title="No return payments yet">They show here after an extension or return is pulled from UltraTax.</Empty> : (
        <Table cols={showEntity
          ? [['Entity'], ['Year', '140px'], ['Department', '150px'], ['Amount', '120px', 'right'], ['Method', '140px'], ['Date', '130px'], ['Client', '110px'], ['Payment', '100px']]
          : [['Year', '170px'], ['Department'], ['Amount', '130px', 'right'], ['Method', '170px'], ['Date', '130px'], ['Client', '120px'], ['Payment', '110px']]}>
          {lines.map((l) => (
            <Tr key={l.id} onClick={() => nav(`/entity/${l.filings.entity_id}/${l.filings.tax_year}?stage=${l.filings.stage}`)}>
              {showEntity && <Td className="font-medium">{l.filings.entities.name}</Td>}
              <Td><span className="mr-2 tabular-nums">{l.filings.tax_year}</span><StageBadge stage={l.filings.stage} /></Td>
              <Td><div className="truncate">{l.department}</div><Sub>{l.tax_type}</Sub></Td>
              <Td right className={`tabular-nums ${l.direction === 'refund' ? 'text-emerald-700' : 'font-medium'}`}>{l.direction === 'refund' ? '−' : ''}{money(l.amount)}</Td>
              <Td>{l.direction === 'refund' ? 'Refund' : method(l.method)}{l.bank_last4 && <span className="text-zinc-400"> ·{l.bank_last4}</span>}</Td>
              <Td className="tabular-nums">{date(l.payment_date)}</Td>
              <Td>{l.response === 'confirmed' ? <Badge tone="green">Confirmed</Badge> : l.response === 'modified' ? <Badge tone="amber">Changed</Badge> : <Badge>Waiting</Badge>}</Td>
              <Td>{l.direction === 'refund' ? <span className="text-zinc-300">—</span> : l.payment_status === 'pending' ? <Badge>Pending</Badge> : <Badge tone="green">{l.payment_status === 'verified' ? 'Verified' : 'Paid'}</Badge>}</Td>
            </Tr>
          ))}
        </Table>
      )}
    </Card>
  )
}
