import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Building2, ChevronRight, Wallet } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Card, Empty, Loading, PageHeader, SearchBox, SectionTitle } from '../components/ui'
import { Tabs, useTab } from '../components/Tabs'
import { PlansList } from '../components/Plans'
import { ReturnPayments } from '../components/ReturnPayments'

type E = { id: string; name: string }
const TABS = ['entities', 'payments'] as const

export function GroupPage() {
  const { groupId } = useParams()
  const none = groupId === 'none'
  const [name, setName] = useState('')
  const [ents, setEnts] = useState<E[] | null>(null)
  const [q, setQ] = useState('')
  const [tab, setTab] = useTab(TABS)

  useEffect(() => {
    let query = supabase.from('entities').select('id, name').or('karbon_status.is.null,karbon_status.not.in.(Inactive,Internal)').order('name')
    query = none ? query.is('client_group_id', null) : query.eq('client_group_id', groupId!)
    query.then(({ data }) => setEnts((data as E[]) ?? []))
    if (none) setName('Not in a client group')
    else supabase.from('client_groups').select('name').eq('id', groupId!).single().then(({ data }) => setName(data?.name ?? ''))
  }, [groupId, none])

  const ids = useMemo(() => (ents ?? []).map((e) => e.id), [ents])
  const shown = (ents ?? []).filter((e) => !q.trim() || e.name.toLowerCase().includes(q.trim().toLowerCase()))

  return (
    <>
      <PageHeader crumbs={[{ label: 'Clients', to: '/clients' }, { label: name }]} title={name || ' '}
        right={tab === 'entities' && (ents?.length ?? 0) > 10 ? <SearchBox value={q} onChange={setQ} placeholder="Search entities" /> : undefined} />
      <Tabs value={tab} onChange={setTab} tabs={[
        { id: 'entities', label: 'Entities', icon: <Building2 />, count: ents?.length },
        { id: 'payments', label: 'Payments', icon: <Wallet /> },
      ]} />

      {tab === 'entities' ? (
        <Card>
          {!ents ? <Loading /> : !shown.length ? <Empty title="No entities" /> : (
            <ul className="divide-y divide-zinc-100">
              {shown.map((e) => (
                <li key={e.id}>
                  <Link to={`/entity/${e.id}`} className="group flex h-12 items-center px-5 hover:bg-zinc-50">
                    <span className="flex-1 truncate text-sm font-medium text-zinc-900">{e.name}</span>
                    <ChevronRight className="h-4 w-4 text-zinc-300 group-hover:text-zinc-600" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : (
        <div className="space-y-8">
          <section><SectionTitle>Return payments</SectionTitle><ReturnPayments entityIds={ids} showEntity /></section>
          <section><PlansList entityIds={ids} showEntity /></section>
        </div>
      )}
    </>
  )
}
