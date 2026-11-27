import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { date, money } from '../lib/format'
import { markPayment, paymentState, WHO, type PlanPayment } from '../components/Plans'
import { Button, Card, Empty, Loading, PageHeader, SearchBox, SectionTitle, Select, Sub, Table, Td, Tr } from '../components/ui'

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
    <Table cols={[['Client'], ['Department', '140px'], ['Amount', '120px', 'right'], ['Date', '130px'], ['Who pays', '140px'], ['Status', '110px'], ['', '230px', 'right']]}>
      {list.map((r) => (
        <Tr key={r.id}>
          <Td><Link to={`/entity/${r.payment_plans.entity_id}?tab=payments`} className="block truncate font-medium hover:underline">{r.payment_plans.entities.name}</Link><Sub>{r.payment_plans.entities.client_groups?.name}</Sub></Td>
          <Td><div className="truncate">{r.payment_plans.department}</div><Sub>{r.payment_plans.tax_year}</Sub></Td>
          <Td right className="font-medium tabular-nums">{money(r.amount)}</Td>
          <Td className="tabular-nums">{date(r.due_date)}</Td>
          <Td><div>{WHO[r.who_pays]}</div><Sub>{r.payment_plans.bank_accounts ? `from •••• ${r.payment_plans.bank_accounts.last4}` : 'no bank set'}</Sub></Td>
          <Td>{paymentState(r)}</Td>
          <Td right className="overflow-visible">
            <span className="inline-flex gap-2">
              {r.due_date <= today && <Button onClick={() => act(r, 'missed')}><X />Missed</Button>}
              <Button variant="primary" onClick={() => act(r, 'made')}><Check />{r.who_pays === 'client' ? 'Got confirmation' : 'Made'}</Button>
            </span>
          </Td>
        </Tr>
      ))}
    </Table>
  )

  return (
    <>
      <PageHeader title="Upcoming payments" sub="Estimated payments to be made. Richelle marks each one complete; client payments count once we get his confirmation." />
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <SearchBox value={q} onChange={setQ} placeholder="Search client" width="w-64" />
        <Select value={who} onChange={setWho} width="w-44"><option value="">Anyone pays</option><option value="richelle">Richelle pays</option><option value="client">Client pays</option></Select>
        <Select value={dept} onChange={setDept} width="w-48"><option value="">All departments</option>{depts.map((d) => <option key={d}>{d}</option>)}</Select>
        <Select value={days} onChange={setDays} width="w-44"><option value="7">Next 7 days</option><option value="30">Next 30 days</option><option value="90">Next 90 days</option><option value="400">Rest of the year</option></Select>
      </div>
      {!rows ? <Card><Loading /></Card> : !filtered.length ? <Card><Empty title="No payments due">Set up payment plans on a client’s Payment plans tab.</Empty></Card> : (
        <div className="space-y-8">
          {overdue.length > 0 && <section><SectionTitle>Not done on time</SectionTitle><Card>{table(overdue)}</Card></section>}
          {dueToday.length > 0 && <section><SectionTitle>Due today</SectionTitle><Card>{table(dueToday)}</Card></section>}
          {upcoming.length > 0 && <section><SectionTitle>Coming up</SectionTitle><Card>{table(upcoming)}</Card></section>}
        </div>
      )}
    </>
  )
}
