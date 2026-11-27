import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { date, money } from '../lib/format'
import { markPayment, paymentState, WHO, type PlanPayment } from '../components/Plans'
import { Button, Card, Empty, Loading, PageHeader, SearchBox, SectionTitle, Select, Table, Td } from '../components/ui'

type Row = PlanPayment & { payment_plans: { id: string; department: string; tax_year: number; entity_id: string; bank_accounts: { last4: string } | null; entities: { name: string; client_groups: { name: string } | null } } }

export function UpcomingPayments() {
  const { session } = useAuth()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [who, setWho] = useState('')
  const [dept, setDept] = useState('')
  const [q, setQ] = useState('')
  const [days, setDays] = useState('30')

  const load = useCallback(async () => {
    const until = new Date(Date.now() + Number(days) * 86_400_000).toISOString().slice(0, 10)
    const { data } = await supabase.from('plan_payments')
      .select('*, payment_plans!inner(id, department, tax_year, entity_id, bank_accounts(last4), entities(name, client_groups(name)))')
      .eq('status', 'scheduled').lte('due_date', until).order('due_date')
    setRows((data as unknown as Row[]) ?? [])
  }, [days])
  useEffect(() => { load() }, [load])

  const today = new Date().toISOString().slice(0, 10)
  const filtered = useMemo(() => (rows ?? []).filter((r) =>
    (!who || r.who_pays === who) && (!dept || r.payment_plans.department === dept) &&
    (!q || [r.payment_plans.entities.name, r.payment_plans.entities.client_groups?.name].some((v) => v?.toLowerCase().includes(q.toLowerCase())))), [rows, who, dept, q])
  const overdue = filtered.filter((r) => r.due_date < today)
  const dueToday = filtered.filter((r) => r.due_date === today)
  const upcoming = filtered.filter((r) => r.due_date > today)
  const depts = [...new Set((rows ?? []).map((r) => r.payment_plans.department))].sort()

  const act = async (p: Row, s: 'made' | 'missed') => { if (await markPayment(p, s, session?.user.id)) load() }

  const table = (list: Row[]) => (
    <Table head={['Client', 'Department', 'Amount', 'Date', 'Who pays', 'From', 'Status', '']}>
      {list.map((r) => (
        <tr key={r.id} className="hover:bg-zinc-50">
          <Td><Link to={`/entity/${r.payment_plans.entity_id}?tab=plans`} className="font-medium hover:underline">{r.payment_plans.entities.name}</Link><div className="text-xs text-zinc-500">{r.payment_plans.entities.client_groups?.name}</div></Td>
          <Td>{r.payment_plans.department} <span className="text-xs text-zinc-400">{r.payment_plans.tax_year}</span></Td>
          <Td className="font-medium tabular-nums">{money(r.amount)}</Td>
          <Td className="tabular-nums">{date(r.due_date)}</Td>
          <Td>{WHO[r.who_pays]}</Td>
          <Td className="tabular-nums text-zinc-600">{r.payment_plans.bank_accounts ? `•••• ${r.payment_plans.bank_accounts.last4}` : '—'}</Td>
          <Td>{paymentState(r)}</Td>
          <Td className="whitespace-nowrap text-right">
            <span className="inline-flex gap-1">
              <Button size="sm" variant="primary" onClick={() => act(r, 'made')}><Check className="h-3.5 w-3.5" />{r.who_pays === 'client' ? 'Confirmation received' : 'Made'}</Button>
              {r.due_date <= today && <Button size="sm" variant="ghost" onClick={() => act(r, 'missed')}><X className="h-3.5 w-3.5" />Missed</Button>}
            </span>
          </Td>
        </tr>
      ))}
    </Table>
  )

  return (
    <>
      <PageHeader title="Upcoming payments" sub="Estimated payments to be made. Richelle marks each one complete; client payments count once we get his confirmation." />
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <SearchBox value={q} onChange={setQ} placeholder="Search client" />
        <Select value={who} onChange={setWho}><option value="">Anyone pays</option><option value="richelle">Richelle pays</option><option value="client">Client pays</option></Select>
        <Select value={dept} onChange={setDept}><option value="">All departments</option>{depts.map((d) => <option key={d}>{d}</option>)}</Select>
        <Select value={days} onChange={setDays}><option value="7">Next 7 days</option><option value="30">Next 30 days</option><option value="90">Next 90 days</option><option value="400">Rest of the year</option></Select>
      </div>
      {!rows ? <Card><Loading /></Card> : !filtered.length ? <Card><Empty title="No payments due">Set up payment plans on a client’s Payment plans tab.</Empty></Card> : (
        <div className="space-y-8">
          {overdue.length > 0 && <section><SectionTitle>Not done on time</SectionTitle><Card className="border-red-200">{table(overdue)}</Card></section>}
          {dueToday.length > 0 && <section><SectionTitle>Due today</SectionTitle><Card>{table(dueToday)}</Card></section>}
          {upcoming.length > 0 && <section><SectionTitle>Coming up</SectionTitle><Card>{table(upcoming)}</Card></section>}
        </div>
      )}
    </>
  )
}
