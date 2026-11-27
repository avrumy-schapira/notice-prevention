import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, RefreshCw } from 'lucide-react'
import { useFilings } from '../lib/useFilings'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { syncKarbon } from '../lib/karbon'
import { applyFilters, emptyFilters, Filters } from '../components/Filters'
import { Badge, Button, Card, Empty, Loading, PageHeader, SectionTitle, StatusBadge, Table, Td } from '../components/ui'
import { date, person } from '../lib/format'
import { yearPath, type Filing, type FilingStatus } from '../lib/types'

const PART1: FilingStatus[] = ['not_started', 'pulled_flags_open', 'ready_to_email']
const PART2: FilingStatus[] = ['emailed_waiting', 'client_confirmed', 'client_modified_ach', 'client_modified_method']

type W = { karbon_key: string; stage: 'extension' | 'return' | null; title: string; work_type: string | null; tax_year: number | null; return_type: string | null; primary_status: string | null; secondary_status: string | null; due_date: string | null; entity_id: string | null; entities: { name: string; client_groups: { name: string } | null } | null }

function Rows({ rows }: { rows: Filing[] }) {
  const nav = useNavigate()
  if (!rows.length) return <Empty title="Nothing here" />
  return (
    <Table head={['Client', 'Year', 'Stage', 'Status', 'Last pull', 'Preparer']}>
      {rows.map((f) => (
        <tr key={f.id} onClick={() => nav(yearPath(f))} className="cursor-pointer hover:bg-zinc-50">
          <Td><div className="font-medium">{f.entities.name}</div><div className="text-xs text-zinc-500">{f.entities.client_groups?.name}</div></Td>
          <Td className="tabular-nums">{f.tax_year}</Td>
          <Td className="capitalize">{f.stage}</Td>
          <Td><StatusBadge status={f.status} /></Td>
          <Td className="text-zinc-600">{date(f.last_pull_at)}</Td>
          <Td className="text-zinc-600">{person(f.entities.assigned_preparer)}</Td>
        </tr>
      ))}
    </Table>
  )
}

export function Workload() {
  const nav = useNavigate()
  const { profile, session } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const { filings, loading, error, reload } = useFilings((q) => q.neq('status', 'filed'))
  const [f, setF] = useState(emptyFilters)
  const [work, setWork] = useState<W[] | null>(null)
  const [syncing, setSyncing] = useState(false)

  const loadWork = useCallback(async () => {
    const { data } = await supabase.from('karbon_work_items').select('*, entities(name, client_groups(name))').order('first_seen_at')
    setWork((data as W[]) ?? [])
  }, [])
  useEffect(() => { loadWork() }, [loadWork])

  const sync = async () => { setSyncing(true); try { await syncKarbon(); await loadWork() } catch (e) { alert((e as Error).message) } setSyncing(false) }

  const open = async (w: W, stage: 'extension' | 'return') => {
    if (!w.entity_id || !w.tax_year) return
    const { error } = await supabase.from('filings').insert({ entity_id: w.entity_id, tax_year: w.tax_year, stage })
    if (error && !error.message.includes('duplicate')) return alert(error.message)
    if (!error) await supabase.from('activity_log').insert({ entity_id: w.entity_id, actor: session?.user.id, action: 'started_' + stage, details: { year: w.tax_year, karbon: w.title } })
    reload()
    nav(`/entity/${w.entity_id}/${w.tax_year}?stage=${stage}`)
  }

  const started = new Set(filings.map((x) => `${x.entities.id}|${x.tax_year}|${x.stage}`))
  const newWork = (work ?? []).filter((w) => !(w.entity_id && started.has(`${w.entity_id}|${w.tax_year}|${w.stage}`)))
  const rows = applyFilters(filings, f)

  return (
    <>
      <PageHeader title="Work" sub="Returns to check, email and file"
        right={<Button onClick={sync} disabled={syncing}><RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />Refresh from Karbon</Button>} />

      <SectionTitle right={<span className="text-xs text-zinc-500">From “Send Return / Ext to Client” in Karbon until Completed</span>}>New from Karbon {newWork.length > 0 && <Badge tone="blue">{newWork.length}</Badge>}</SectionTitle>
      <Card className="mb-8">
        {!work ? <Loading /> : !newWork.length ? <Empty title="Nothing new from Karbon" /> : (
          <Table head={['Client', 'Karbon work', 'Tax year', 'Type', 'Status in Karbon', '']}>
            {newWork.map((w) => (
              <tr key={w.karbon_key}>
                <Td><div className="font-medium">{w.entities?.name ?? <span className="text-red-600">Not matched to a client</span>}</div><div className="text-xs text-zinc-500">{w.entities?.client_groups?.name}</div></Td>
                <Td><div className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5 text-zinc-400" />{w.title}</div><div className="text-xs text-zinc-500">{w.work_type}</div></Td>
                <Td className="tabular-nums">{w.tax_year ?? '—'}</Td>
                <Td><Badge tone={w.stage === 'extension' ? 'violet' : 'blue'}>{w.stage === 'extension' ? 'Extension' : 'Return'}</Badge></Td>
                <Td className="text-xs text-zinc-600">{w.secondary_status ?? w.primary_status}</Td>
                <Td className="whitespace-nowrap text-right">
                  {isAdmin && w.entity_id && w.tax_year ? <Button size="sm" variant="primary" onClick={() => open(w, w.stage ?? 'return')}>Open</Button> : null}
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <Filters filings={filings} value={f} onChange={setF} statuses={[...PART1, ...PART2]} />
      <SectionTitle>Before the email</SectionTitle>
      <Card className="mb-8">{loading ? <Loading /> : <Rows rows={rows.filter((x) => PART1.includes(x.status))} />}</Card>
      <SectionTitle>After the client responds</SectionTitle>
      <Card>{loading ? <Loading /> : <Rows rows={rows.filter((x) => PART2.includes(x.status))} />}</Card>
    </>
  )
}
