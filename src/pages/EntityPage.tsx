import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CalendarRange, ChevronRight, Landmark, Wallet } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { person } from '../lib/format'
import type { FilingStatus } from '../lib/types'
import { Card, Empty, Loading, PageHeader, SectionTitle, StatusBadge } from '../components/ui'
import { Tabs, useTab } from '../components/Tabs'
import { PlansList } from '../components/Plans'
import { EntityBankInfo } from '../components/BankInfo'
import { ReturnPayments } from '../components/ReturnPayments'

type E = {
  id: string; name: string; client_id: string | null; return_type: string | null; assigned_preparer: string | null
  karbon_status: string | null; email: string | null; phone: string | null
  client_groups: { id: string; name: string } | null
  filings: { id: string; tax_year: number; stage: 'extension' | 'return'; status: FilingStatus }[]
}
const TABS = ['years', 'payments', 'bank'] as const

export function EntityPage() {
  const { id } = useParams()
  const [e, setE] = useState<E | null>(null)
  const [tab, setTab] = useTab(TABS)

  useEffect(() => {
    supabase.from('entities').select('id, name, client_id, return_type, assigned_preparer, karbon_status, email, phone, client_groups(id, name), filings(id, tax_year, stage, status)')
      .eq('id', id!).single().then(({ data }) => setE(data as unknown as E))
  }, [id])

  if (!e) return <Card><Loading /></Card>
  const years = [...new Set(e.filings.map((f) => f.tax_year))].sort((a, b) => b - a)
  const group = e.client_groups

  return (
    <>
      <PageHeader crumbs={[{ label: 'Clients', to: '/clients' }, { label: group?.name ?? 'Not in a client group', to: `/clients/${group?.id ?? 'none'}` }, { label: e.name }]}
        title={e.name}
        sub={[e.client_id, e.return_type, person(e.assigned_preparer)].filter((x) => x && x !== '—').join('  ·  ')} />
      <Tabs value={tab} onChange={setTab} tabs={[
        { id: 'years', label: 'Tax years', icon: <CalendarRange />, count: years.length },
        { id: 'payments', label: 'Payments', icon: <Wallet /> },
        { id: 'bank', label: 'Bank & info', icon: <Landmark /> },
      ]} />

      {tab === 'years' && (
        <Card>
          {!years.length ? <Empty title="No tax years yet">A year shows here once its extension or return comes into Work from Karbon.</Empty> : (
            <ul className="divide-y divide-zinc-100">
              {years.map((y) => {
                const ext = e.filings.find((f) => f.tax_year === y && f.stage === 'extension')
                const ret = e.filings.find((f) => f.tax_year === y && f.stage === 'return')
                return (
                  <li key={y}>
                    <Link to={`/entity/${e.id}/${y}`} className="group grid h-14 grid-cols-[120px_1fr_1fr_24px] items-center gap-4 px-5 hover:bg-zinc-50">
                      <span className="text-base font-semibold tabular-nums">{y}</span>
                      <span className="flex items-center gap-3 text-sm"><span className="w-20 text-zinc-500">Extension</span>{ext ? <StatusBadge status={ext.status} /> : <span className="text-zinc-300">—</span>}</span>
                      <span className="flex items-center gap-3 text-sm"><span className="w-20 text-zinc-500">Return</span>{ret ? <StatusBadge status={ret.status} /> : <span className="text-zinc-300">—</span>}</span>
                      <ChevronRight className="h-4 w-4 text-zinc-300 group-hover:text-zinc-600" />
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      )}
      {tab === 'payments' && (
        <div className="space-y-8">
          <section><SectionTitle>Return payments</SectionTitle><ReturnPayments entityIds={[e.id]} /></section>
          <section><PlansList entityId={e.id} /></section>
        </div>
      )}
      {tab === 'bank' && <EntityBankInfo entity={e} />}
    </>
  )
}
