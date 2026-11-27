import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { date, money } from '../lib/format'
import { markPayment, WHO, type PlanPayment } from '../components/Plans'
import { Button, Card, Empty, Loading, Main, PageHeader, SearchBox, Select, Sub, Table, Td, Tr } from '../components/ui'

type Row = PlanPayment & { payment_plans: { id: string; department: string; tax_year: number; entity_id: string; bank_accounts: { last4: string } | null; entities: { name: string; client_groups: { name: string } | null } } }

export function UpcomingPayments() {
  const nav = useNavigate()
  const { session } = useAuth()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [who, setWho] = useState('')
  const [dept, setDept] = useState('')
  const [q, setQ] = useState('')
  const [range, setRange] = useState('30')

  const load = useCallback(async () => {
    const until = new Date(Date.now() + Number(range) * 86_400_000).toISOString().slice(0, 10)
    const { data } = await supabase.from('plan_payments')
      .select('*, payment_plans!inner(id, department, tax_year, entity_id, bank_accounts(last4), entities(name, client_groups(name)))')
      .eq('status', 'scheduled').lte('due_date', until).order('due_date')
    setRows((data as unknown as Row[]) ?? [])
  }, [range])
  useEffect(() => { load() }, [load])

  const today = new Date().toISOString().slice(0, 10)
  const filtered = useMemo(() => (rows ?? []).filter((r) =>
    (!who || r.who_pays === who) && (!dept || r.payment_plans.department === dept) &&
    (!q || [r.payment_plans.entities.name, r.payment_plans.entities.client_groups?.name].some((v) => v?.toLowerCase().includes(q.toLowerCase())))), [rows, who, dept, q])
  const groups = [
    { title: 'Late', tone: 'text-red-700', list: filtered.filter((r) => r.due_date < today) },
    { title: 'Due today', tone: 'text-amber-700', list: filtered.filter((r) => r.due_date === today) },
    { title: 'Coming up', tone: 'text-zinc-900', list: filtered.filter((r) => r.due_date > today) },
  ].filter((g) => g.list.length)
  const depts = [...new Set((rows ?? []).map((r) => r.payment_plans.department))].sort()
  const act = async (p: Row, s: 'made' | 'missed') => { if (await markPayment(p, s, session?.user.id)) load() }

  return (
    <>
      <PageHeader title="Upcoming payments" sub="Estimated payments to make. Client payments count only once we have his confirmation." />
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <SearchBox value={q} onChange={setQ} placeholder="Search client" width="w-64" />
        <Select value={who} onChange={setWho} width="w-44"><option value="">Anyone pays</option><option value="richelle">Richelle pays</option><option value="client">Client pays</option></Select>
        <Select value={dept} onChange={setDept} width="w-48"><option value="">All departments</option>{depts.map((d) => <option key={d}>{d}</option>)}</Select>
        <Select value={range} onChange={setRange} width="w-44"><option value="7">Next 7 days</option><option value="30">Next 30 days</option><option value="90">Next 90 days</option><option value="400">Rest of the year</option></Select>
      </div>
      {!rows ? <Card><Loading /></Card> : !groups.length ? <Card><Empty title="No payments due">Set up a payment plan on an entity’s Payments tab.</Empty></Card> : (
        <div className="space-y-8">
          {groups.map((g) => (
            <section key={g.title}>
              <div className="mb-3 flex h-8 items-center gap-3">
                <h2 className={`text-base font-semibold ${g.tone}`}>{g.title}</h2>
                <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium tabular-nums text-zinc-600">{g.list.length}</span>
              </div>
              <Card>
                <Table cols={[['Client'], ['Payment', '170px'], ['Amount', '120px', 'right'], ['Date', '120px'], ['Paid by', '150px'], ['', '230px', 'right']]}>
                  {g.list.map((r) => (
                    <Tr key={r.id} onClick={() => nav(`/entity/${r.payment_plans.entity_id}?tab=payments`)}>
                      <Td><Main>{r.payment_plans.entities.name}</Main><Sub>{r.payment_plans.entities.client_groups?.name ?? 'Not in a client group'}</Sub></Td>
                      <Td><Main>{r.payment_plans.department}</Main><Sub>{r.payment_plans.tax_year} estimate</Sub></Td>
                      <Td right className="font-medium tabular-nums">{money(r.amount)}</Td>
                      <Td className="text-zinc-600">{date(r.due_date)}</Td>
                      <Td><Main>{WHO[r.who_pays]}</Main><Sub>{r.payment_plans.bank_accounts ? `•••• ${r.payment_plans.bank_accounts.last4}` : 'No bank set'}</Sub></Td>
                      <Td right>
                        <span className="inline-flex gap-2">
                          {r.due_date <= today && <Button onClick={() => act(r, 'missed')}>Missed</Button>}
                          <Button variant="primary" onClick={() => act(r, 'made')}>{r.who_pays === 'client' ? 'Got proof' : 'Paid'}</Button>
                        </span>
                      </Td>
                    </Tr>
                  ))}
                </Table>
              </Card>
            </section>
          ))}
        </div>
      )}
    </>
  )
}
