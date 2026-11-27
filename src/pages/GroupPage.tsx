import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Building2, ChevronRight, CreditCard, Landmark, Receipt } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { date, method, money, person } from '../lib/format'
import type { FilingStatus } from '../lib/types' // status of the filing a line belongs to
import { Badge, Card, Empty, Loading, PageHeader, SearchBox, Table, Td } from '../components/ui'
import { Tabs, useTab } from '../components/Tabs'
import { PlansList } from '../components/Plans'
import { EntityBankInfo } from '../components/BankInfo'

type E = { id: string; name: string; client_id: string | null; return_type: string | null; assigned_preparer: string | null; karbon_status: string | null; email: string | null; phone: string | null }
type Line = { id: string; department: string; tax_type: string; direction: string | null; amount: number | null; method: string | null; payment_date: string | null; bank_last4: string | null; response: string; payment_status: string;
  filings: { tax_year: number; stage: string; status: FilingStatus; entity_id: string; entities: { name: string } } }

const TABS = ['entities', 'payments', 'plans', 'banks'] as const

export function GroupPage() {
  const { groupId } = useParams()
  const nav = useNavigate()
  const none = groupId === 'none'
  const [name, setName] = useState('')
  const [ents, setEnts] = useState<E[] | null>(null)
  const [q, setQ] = useState('')
  const [tab, setTab] = useTab(TABS)
  const [lines, setLines] = useState<Line[] | null>(null)

  useEffect(() => {
    let query = supabase.from('entities').select('id, name, client_id, return_type, assigned_preparer, karbon_status, email, phone')
      .or('karbon_status.is.null,karbon_status.not.in.(Inactive,Internal)').order('name')
    query = none ? query.is('client_group_id', null) : query.eq('client_group_id', groupId!)
    query.then(({ data }) => setEnts((data as E[]) ?? []))
    if (none) setName('Not in a client group')
    else supabase.from('client_groups').select('name').eq('id', groupId!).single().then(({ data }) => setName(data?.name ?? ''))
  }, [groupId, none])

  const ids = useMemo(() => (ents ?? []).map((e) => e.id), [ents])
  useEffect(() => {
    if (tab !== 'payments' || !ids.length) return
    supabase.from('payment_lines').select('id, department, tax_type, direction, amount, method, payment_date, bank_last4, response, payment_status, filings!inner(tax_year, stage, status, entity_id, entities(name))')
      .in('filings.entity_id', ids).then(({ data }) => setLines((data as unknown as Line[]) ?? []))
  }, [tab, ids])

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase()
    return (ents ?? []).filter((e) => !s || e.name.toLowerCase().includes(s) || e.client_id?.toLowerCase().includes(s))
  }, [ents, q])

  const sortedLines = [...(lines ?? [])].sort((a, b) => b.filings.tax_year - a.filings.tax_year || (a.payment_date ?? '').localeCompare(b.payment_date ?? ''))

  return (
    <>
      <PageHeader crumbs={[{ label: 'Clients', to: '/clients' }, { label: name }]} title={name || '…'}
        sub={ents ? `${ents.length} active ${ents.length === 1 ? 'entity' : 'entities'}` : undefined}
        right={tab === 'entities' && ents && ents.length > 8 ? <SearchBox value={q} onChange={setQ} placeholder="Search entities" /> : undefined} />

      <Tabs value={tab} onChange={setTab} tabs={[
        { id: 'entities', label: 'Entities', icon: <Building2 className="h-4 w-4" /> },
        { id: 'payments', label: 'Return payments', icon: <Receipt className="h-4 w-4" /> },
        { id: 'plans', label: 'Payment plans', icon: <CreditCard className="h-4 w-4" /> },
        { id: 'banks', label: 'Banks & info', icon: <Landmark className="h-4 w-4" /> },
      ]} counts={{ entities: ents?.length }} />

      {!ents ? <Card><Loading /></Card> : tab === 'entities' ? (
        <Card>
          {!shown.length ? <Empty title="No active entities" /> : (
            <Table head={['Entity', 'Client ID', 'Return', 'Preparer', 'Karbon', '']}>
              {shown.map((e) => (
                <tr key={e.id} className="group cursor-pointer hover:bg-zinc-50" onClick={() => nav(`/entity/${e.id}`)}>
                  <Td><Link to={`/entity/${e.id}`} className="font-medium text-zinc-900">{e.name}</Link></Td>
                  <Td className="font-mono text-xs text-zinc-600">{e.client_id ?? '—'}</Td>
                  <Td>{e.return_type ?? <span className="text-zinc-300">—</span>}</Td>
                  <Td className="text-zinc-600">{person(e.assigned_preparer)}</Td>
                  <Td>{e.karbon_status ? <Badge tone={e.karbon_status.startsWith('Client') ? 'green' : 'amber'}>{e.karbon_status}</Badge> : <span className="text-zinc-300">—</span>}</Td>
                  <Td className="w-8"><ChevronRight className="h-4 w-4 text-zinc-300 group-hover:text-zinc-500" /></Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      ) : tab === 'payments' ? (
        <Card>
          {!lines ? <Loading /> : !sortedLines.length ? <Empty title="No return payments yet">They appear after the agent pulls an extension or return.</Empty> : (
            <Table head={['Entity', 'Year', 'Department', 'Amount', 'Method', 'Date', 'Client', 'Payment']}>
              {sortedLines.map((l) => (
                <tr key={l.id} className="cursor-pointer hover:bg-zinc-50" onClick={() => nav(`/entity/${l.filings.entity_id}/${l.filings.tax_year}?stage=${l.filings.stage}`)}>
                  <Td className="font-medium">{l.filings.entities.name}</Td>
                  <Td className="capitalize">{l.filings.tax_year} {l.filings.stage === 'extension' ? 'ext' : 'return'}</Td>
                  <Td><div>{l.department}</div><div className="text-xs text-zinc-500">{l.tax_type}</div></Td>
                  <Td className={`tabular-nums ${l.direction === 'refund' ? 'text-emerald-700' : 'font-medium'}`}>{l.direction === 'refund' ? 'Refund ' : ''}{money(l.amount)}</Td>
                  <Td>{method(l.method)}{l.bank_last4 && <span className="text-zinc-400"> · {l.bank_last4}</span>}</Td>
                  <Td className="tabular-nums">{date(l.payment_date)}</Td>
                  <Td>{l.response === 'confirmed' ? <Badge tone="green">Confirmed</Badge> : l.response === 'modified' ? <Badge tone="amber">Changed</Badge> : <Badge>Waiting</Badge>}</Td>
                  <Td>{l.direction === 'refund' ? '—' : l.payment_status === 'pending' ? <Badge>Pending</Badge> : <Badge tone="green">{l.payment_status === 'verified' ? 'Verified' : 'Paid manually'}</Badge>}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      ) : tab === 'plans' ? (
        <PlansList entityIds={ids} showEntity />
      ) : (
        <div>{ents.map((e) => <EntityBankInfo key={e.id} entity={e} compact />)}</div>
      )}
    </>
  )
}
