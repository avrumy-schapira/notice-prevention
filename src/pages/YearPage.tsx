import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { FileText, Clock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Card, Empty, Loading, PageHeader } from '../components/ui'
import { Tabs, useTab } from '../components/Tabs'
import { FilingPanel } from '../components/FilingPanel'

type Info = { name: string; client_groups: { id: string; name: string } | null; filings: { id: string; tax_year: number; stage: 'extension' | 'return' }[] }
const STAGES = ['extension', 'return'] as const

export function YearPage() {
  const { id, year } = useParams()
  const [info, setInfo] = useState<Info | null>(null)
  useEffect(() => {
    supabase.from('entities').select('name, client_groups(id, name), filings(id, tax_year, stage)').eq('id', id!).single().then(({ data }) => setInfo(data as unknown as Info))
  }, [id])
  const [stage, setStage] = useTab(STAGES, 'stage')

  if (!info) return <Card><Loading /></Card>
  const current = info.filings.find((f) => f.tax_year === Number(year) && f.stage === stage)

  return (
    <>
      <PageHeader crumbs={[
        { label: 'Clients', to: '/clients' },
        { label: info.client_groups?.name ?? 'Not in a client group', to: `/clients/${info.client_groups?.id ?? 'none'}` },
        { label: info.name, to: `/entity/${id}` },
        { label: String(year) },
      ]} title={`${info.name} · ${year}`} />
      <Tabs value={stage} onChange={setStage} tabs={[{ id: 'extension', label: 'Extension', icon: <Clock /> }, { id: 'return', label: 'Return', icon: <FileText /> }]} />
      {current ? <FilingPanel key={current.id} filingId={current.id} /> : (
        <Card><Empty title={`No ${stage} for ${year}`}>It shows here once Karbon reaches “{stage === 'extension' ? 'Ext - Send to Client' : 'Send Return to Client'}” and the admin opens it from Work.</Empty></Card>
      )}
    </>
  )
}
