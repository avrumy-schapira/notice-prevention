import { useCallback, useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { Button, Card, Empty, Loading, PageHeader } from '../components/ui'
import { FilingPanel } from '../components/FilingPanel'

type Info = { name: string; client_groups: { id: string; name: string } | null; filings: { id: string; tax_year: number; stage: 'extension' | 'return' }[] }

export function YearPage() {
  const { id, year } = useParams()
  const [params, setParams] = useSearchParams()
  const { profile, session } = useAuth()
  const [info, setInfo] = useState<Info | null>(null)

  const load = useCallback(() => {
    supabase.from('entities').select('name, client_groups(id, name), filings(id, tax_year, stage)').eq('id', id!).single()
      .then(({ data }) => setInfo(data as unknown as Info))
  }, [id])
  useEffect(() => { load() }, [load])

  if (!info) return <Loading />
  const filings = info.filings.filter((f) => f.tax_year === Number(year))
  const stage = (params.get('stage') as 'extension' | 'return') ?? (filings.find((f) => f.stage === 'return') ? 'return' : 'extension')
  const current = filings.find((f) => f.stage === stage)

  const start = async () => {
    const { error } = await supabase.from('filings').insert({ entity_id: id, tax_year: Number(year), stage })
    if (error) return alert(error.message)
    await supabase.from('activity_log').insert({ entity_id: id, actor: session?.user.id, action: 'started_' + stage, details: { year: Number(year) } })
    load()
  }

  const tab = (s: 'extension' | 'return', label: string) => (
    <button onClick={() => setParams({ stage: s })}
      className={`relative px-1 pb-3 text-sm font-medium transition ${stage === s ? 'text-zinc-900' : 'text-zinc-500 hover:text-zinc-800'}`}>
      {label}
      {stage === s && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-zinc-900" />}
    </button>
  )

  return (
    <>
      <PageHeader
        crumbs={[
          { label: 'Clients', to: '/clients' },
          { label: info.client_groups?.name ?? 'Not in a client group', to: `/clients/${info.client_groups?.id ?? 'none'}` },
          { label: info.name, to: `/entity/${id}` },
          { label: String(year) },
        ]}
        title={`${info.name} · ${year}`}
      />
      <div className="mb-6 flex gap-6 border-b border-zinc-200">
        {tab('extension', 'Extension')}
        {tab('return', 'Return')}
      </div>
      {current ? <FilingPanel key={current.id} filingId={current.id} /> : (
        <Card>
          <Empty title={`No ${stage} for ${year} yet`}>
            {profile?.role === 'admin' ? <span className="mt-4 inline-block"><Button variant="primary" onClick={start}><Plus className="h-4 w-4" />Start {stage}</Button></span> : 'The admin starts it when it is being prepared.'}
          </Empty>
        </Card>
      )}
    </>
  )
}
