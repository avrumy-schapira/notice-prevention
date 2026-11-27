import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CalendarRange, ChevronRight, CreditCard, Landmark, Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { date, person } from '../lib/format'
import type { FilingStatus } from '../lib/types'
import { Badge, Button, Card, Empty, Loading, PageHeader, Select, StatusBadge } from '../components/ui'
import { Tabs, useTab } from '../components/Tabs'
import { PlansList } from '../components/Plans'
import { EntityBankInfo } from '../components/BankInfo'

type E = {
  id: string; name: string; client_id: string | null; return_type: string | null; assigned_preparer: string | null
  karbon_url: string | null; karbon_status: string | null; email: string | null; phone: string | null
  client_groups: { id: string; name: string } | null
  filings: { id: string; tax_year: number; stage: 'extension' | 'return'; status: FilingStatus; filed_at: string | null }[]
}
const TABS = ['years', 'plans', 'banks'] as const

export function EntityPage() {
  const { id } = useParams()
  const nav = useNavigate()
  const { profile, session } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const [e, setE] = useState<E | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useTab(TABS)
  const lastYear = new Date().getFullYear() - 1
  const [newYear, setNewYear] = useState(String(lastYear))
  const [newStage, setNewStage] = useState<'extension' | 'return'>('extension')

  const load = useCallback(() => {
    supabase.from('entities')
      .select('id, name, client_id, return_type, assigned_preparer, karbon_url, karbon_status, email, phone, client_groups(id, name), filings(id, tax_year, stage, status, filed_at)')
      .eq('id', id!).single()
      .then(({ data, error }) => { setE(data as unknown as E); setError(error?.message ?? null) })
  }, [id])
  useEffect(() => { load() }, [load])

  const start = async () => {
    const { error } = await supabase.from('filings').insert({ entity_id: id, tax_year: Number(newYear), stage: newStage })
    if (error && !error.message.includes('duplicate')) return alert(error.message)
    await supabase.from('activity_log').insert({ entity_id: id, actor: session?.user.id, action: 'started_' + newStage, details: { year: Number(newYear) } })
    nav(`/entity/${id}/${newYear}?stage=${newStage}`)
  }

  if (error) return <p className="text-sm text-red-600">{error}</p>
  if (!e) return <Loading />
  const years = [...new Set(e.filings.map((f) => f.tax_year))].sort((a, b) => b - a)
  const group = e.client_groups

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Clients', to: '/clients' }, { label: group?.name ?? 'Not in a client group', to: `/clients/${group?.id ?? 'none'}` }, { label: e.name }]}
        title={e.name}
        sub={<span className="flex items-center gap-3">
          <span className="font-mono">{e.client_id ?? 'No client ID'}</span>
          <span className="text-zinc-300">·</span><span>{e.return_type ?? 'Return type from UltraTax'}</span>
          <span className="text-zinc-300">·</span><span>{person(e.assigned_preparer)}</span>
          {e.karbon_status && <Badge tone={e.karbon_status.startsWith('Client') ? 'green' : 'amber'}>{e.karbon_status}</Badge>}
        </span>}
      />

      <Tabs value={tab} onChange={setTab} tabs={[
        { id: 'years', label: 'Tax years', icon: <CalendarRange className="h-4 w-4" /> },
        { id: 'plans', label: 'Payment plans', icon: <CreditCard className="h-4 w-4" /> },
        { id: 'banks', label: 'Banks & info', icon: <Landmark className="h-4 w-4" /> },
      ]} />

      {tab === 'years' && (
        <>
          {isAdmin && (
            <div className="mb-4 flex items-center justify-end gap-2">
              <span className="text-sm text-zinc-500">Start</span>
              <Select value={newYear} onChange={setNewYear}>{[lastYear + 1, lastYear, lastYear - 1].map((y) => <option key={y}>{y}</option>)}</Select>
              <Select value={newStage} onChange={(v) => setNewStage(v as 'extension' | 'return')}><option value="extension">Extension</option><option value="return">Return</option></Select>
              <Button variant="primary" onClick={start}><Plus className="h-4 w-4" />Start</Button>
            </div>
          )}
          {!years.length ? (
            <Card><Empty title="No tax years yet">{isAdmin ? 'Returns assigned to you in Karbon show up in Work. You can also start one here.' : 'The admin starts a year when the extension or return is being prepared.'}</Empty></Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {years.map((y) => {
                const ext = e.filings.find((f) => f.tax_year === y && f.stage === 'extension')
                const ret = e.filings.find((f) => f.tax_year === y && f.stage === 'return')
                return (
                  <Link key={y} to={`/entity/${e.id}/${y}`} className="group">
                    <Card className="p-5 transition group-hover:border-zinc-300 group-hover:shadow-md">
                      <div className="mb-4 flex items-center justify-between">
                        <span className="text-xl font-semibold tracking-tight">{y}</span>
                        <ChevronRight className="h-4 w-4 text-zinc-300 group-hover:text-zinc-500" />
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-between"><span className="text-zinc-500">Extension</span>{ext ? <StatusBadge status={ext.status} /> : <span className="text-zinc-300">—</span>}</div>
                        <div className="flex items-center justify-between"><span className="text-zinc-500">Return</span>{ret ? <StatusBadge status={ret.status} /> : <span className="text-zinc-300">—</span>}</div>
                        {ret?.filed_at && <div className="pt-1 text-xs text-zinc-400">Return filed {date(ret.filed_at)}</div>}
                      </div>
                    </Card>
                  </Link>
                )
              })}
            </div>
          )}
        </>
      )}
      {tab === 'plans' && <PlansList entityId={e.id} />}
      {tab === 'banks' && <EntityBankInfo entity={e} />}
    </>
  )
}
