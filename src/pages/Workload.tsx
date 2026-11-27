import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, RefreshCw } from 'lucide-react'
import { useFilings } from '../lib/useFilings'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { syncKarbon } from '../lib/karbon'
import { applyFilters, emptyFilters, Filters } from '../components/Filters'
import { Button, Card, Loading, Main, PageHeader, Sub, Table, Td, Tr, days, stageLabel } from '../components/ui'
import { daysSince, person } from '../lib/format'
import { yearPath, type Filing, type FilingStatus } from '../lib/types'

type W = { karbon_key: string; stage: 'extension' | 'return' | null; title: string; tax_year: number | null; first_seen_at: string; entity_id: string | null
  entities: { name: string; assigned_preparer: string | null; client_groups: { name: string } | null } | null }

const STEPS: { n: number; title: string; next: string; statuses: FilingStatus[] }[] = [
  { n: 1, title: 'Pull from UltraTax', next: 'Open it and press Pull', statuses: ['not_started'] },
  { n: 2, title: 'Flags to clear', next: 'Comment to the preparer in Karbon, wait for OK', statuses: ['pulled_flags_open'] },
  { n: 3, title: 'Email the client', next: 'Check recipients, attach the return, send', statuses: ['ready_to_email'] },
  { n: 4, title: 'Waiting on the client', next: 'Nothing to do until he answers', statuses: ['emailed_waiting'] },
  { n: 5, title: 'Client made changes', next: 'Enter the new bank in UltraTax, or ask the preparer', statuses: ['client_modified_ach', 'client_modified_method'] },
  { n: 6, title: 'Ready to file', next: 'Final pull, e-file, mark as filed', statuses: ['client_confirmed'] },
]
const since = (f: Filing) => f.email_sent_at ?? f.last_pull_at ?? null
const COLS: [string, string?, 'right'?][] = [['Client'], ['Year', '150px'], ['Preparer', '150px'], ['In this step', '130px', 'right'], ['', '120px', 'right']]

export function Workload() {
  const nav = useNavigate()
  const { session, profile } = useAuth()
  const { filings, loading, error, reload } = useFilings((q) => q.neq('status', 'filed'))
  const [f, setF] = useState(emptyFilters)
  const [work, setWork] = useState<W[] | null>(null)
  const [syncing, setSyncing] = useState(false)

  const loadWork = useCallback(async () => {
    const { data } = await supabase.from('karbon_work_items').select('*, entities(name, assigned_preparer, client_groups(name))').not('entity_id', 'is', null).order('first_seen_at')
    setWork((data as W[]) ?? [])
  }, [])
  useEffect(() => { loadWork() }, [loadWork])

  const sync = async () => { setSyncing(true); try { await syncKarbon(); await loadWork() } catch (e) { alert((e as Error).message) } setSyncing(false) }

  const open = async (w: W) => {
    if (!w.entity_id || !w.tax_year) return
    if (profile?.role !== 'admin') return nav(`/entity/${w.entity_id}`)
    const stage = w.stage ?? 'return'
    const { error } = await supabase.from('filings').insert({ entity_id: w.entity_id, tax_year: w.tax_year, stage })
    if (error && !error.message.includes('duplicate')) return alert(error.message)
    if (!error) await supabase.from('activity_log').insert({ entity_id: w.entity_id, actor: session?.user.id, action: 'started_' + stage, details: { year: w.tax_year } })
    reload()
    nav(`/entity/${w.entity_id}/${w.tax_year}?stage=${stage}`)
  }

  const started = new Set(filings.map((x) => `${x.entities.id}|${x.tax_year}|${x.stage}`))
  const s = f.search.trim().toLowerCase()
  const newWork = (work ?? []).filter((w) => !started.has(`${w.entity_id}|${w.tax_year}|${w.stage}`))
    .filter((w) => (!f.stage || w.stage === f.stage) && (!f.group || w.entities?.client_groups?.name === f.group) && (!f.preparer || w.entities?.assigned_preparer === f.preparer)
      && (!s || [w.entities?.name, w.entities?.client_groups?.name].some((v) => v?.toLowerCase().includes(s))))
  const rows = applyFilters(filings, f)
  const stepRows = (st: FilingStatus[]) => rows.filter((x) => st.includes(x.status)).sort((a, b) => (since(a) ?? '').localeCompare(since(b) ?? ''))

  return (
    <>
      <PageHeader title="Work" sub="Every return and extension, by step. Oldest first."
        right={<Button onClick={sync} disabled={syncing}><RefreshCw className={syncing ? 'animate-spin' : ''} />Refresh from Karbon</Button>} />
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <Filters filings={filings} value={f} onChange={setF} hideStatus />

      {loading || !work ? <Card><Loading /></Card> : (
        <div className="space-y-8">
          {STEPS.map((step) => {
            const list = stepRows(step.statuses)
            const karbon = step.n === 1 ? newWork : []
            const count = list.length + karbon.length
            return (
              <section key={step.n}>
                <div className="mb-3 flex h-8 items-center gap-3">
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${count ? 'bg-zinc-900 text-white' : 'bg-zinc-200 text-zinc-500'}`}>{step.n}</span>
                  <h2 className={`text-base font-semibold ${count ? 'text-zinc-900' : 'text-zinc-400'}`}>{step.title}</h2>
                  <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium tabular-nums text-zinc-600">{count}</span>
                  <span className="ml-auto text-sm text-zinc-500">{step.next}</span>
                </div>
                {count > 0 && (
                  <Card>
                    <Table cols={COLS}>
                      {karbon.map((w) => (
                        <Tr key={w.karbon_key} onClick={() => open(w)}>
                          <Td><Main>{w.entities?.name}</Main><Sub>{w.entities?.client_groups?.name ?? 'Not in a client group'}</Sub></Td>
                          <Td><Main>{w.tax_year}</Main><Sub>{stageLabel(w.stage)}</Sub></Td>
                          <Td className="text-zinc-600">{person(w.entities?.assigned_preparer)}</Td>
                          <Td right className="tabular-nums text-zinc-600">{days(daysSince(w.first_seen_at))}</Td>
                          <Td right><span className="inline-flex items-center gap-1 text-sm font-medium text-zinc-900">Open<ArrowRight className="h-4 w-4" /></span></Td>
                        </Tr>
                      ))}
                      {list.map((x) => (
                        <Tr key={x.id} onClick={() => nav(yearPath(x))}>
                          <Td><Main>{x.entities.name}</Main><Sub>{x.entities.client_groups?.name ?? 'Not in a client group'}</Sub></Td>
                          <Td><Main>{x.tax_year}</Main><Sub>{stageLabel(x.stage)}{x.status === 'client_modified_ach' ? ' · new bank' : x.status === 'client_modified_method' ? ' · new method' : ''}</Sub></Td>
                          <Td className="text-zinc-600">{person(x.entities.assigned_preparer)}</Td>
                          <Td right className="tabular-nums text-zinc-600">{days(daysSince(since(x)))}</Td>
                          <Td right><span className="inline-flex items-center gap-1 text-sm font-medium text-zinc-900">Open<ArrowRight className="h-4 w-4" /></span></Td>
                        </Tr>
                      ))}
                    </Table>
                  </Card>
                )}
              </section>
            )
          })}
        </div>
      )}
    </>
  )
}
