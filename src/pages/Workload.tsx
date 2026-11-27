import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, RefreshCw } from 'lucide-react'
import { useFilings } from '../lib/useFilings'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { syncKarbon } from '../lib/karbon'
import { applyFilters, emptyFilters, Filters } from '../components/Filters'
import { Button, Card, Loading, PageHeader, StageBadge, Sub, Table, Td, Tr } from '../components/ui'
import { date, daysSince, person } from '../lib/format'
import { yearPath, type Filing, type FilingStatus } from '../lib/types'

type W = { karbon_key: string; stage: 'extension' | 'return' | null; title: string; work_type: string | null; tax_year: number | null; secondary_status: string | null; primary_status: string | null; first_seen_at: string; entity_id: string | null; entities: { name: string; client_groups: { name: string } | null } | null }

// Her steps, in order. Each filing sits in the step its status says.
const STEPS: { n: number; title: string; next: string; statuses: FilingStatus[] }[] = [
  { n: 1, title: 'Pull from UltraTax', next: 'Open it and press Pull', statuses: ['not_started'] },
  { n: 2, title: 'Flags to clear', next: 'Karbon comment to the preparer, wait for “Approved” or “OK”', statuses: ['pulled_flags_open'] },
  { n: 3, title: 'Email the client', next: 'Check recipients, attach the return, send', statuses: ['ready_to_email'] },
  { n: 4, title: 'Waiting on the client', next: 'Nothing to do until he answers', statuses: ['emailed_waiting'] },
  { n: 5, title: 'Client made changes', next: 'New bank: Enter in UltraTax · New method: Karbon comment to preparer', statuses: ['client_modified_ach', 'client_modified_method'] },
  { n: 6, title: 'Ready to file', next: 'Final pull, e-file, Mark as filed', statuses: ['client_confirmed'] },
]

const since = (f: Filing) => f.email_sent_at ?? f.last_pull_at ?? null

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

  const open = async (w: W) => {
    if (!w.entity_id || !w.tax_year) return
    const stage = w.stage ?? 'return'
    const { error } = await supabase.from('filings').insert({ entity_id: w.entity_id, tax_year: w.tax_year, stage })
    if (error && !error.message.includes('duplicate')) return alert(error.message)
    if (!error) await supabase.from('activity_log').insert({ entity_id: w.entity_id, actor: session?.user.id, action: 'started_' + stage, details: { year: w.tax_year, karbon: w.title } })
    reload()
    nav(`/entity/${w.entity_id}/${w.tax_year}?stage=${stage}`)
  }

  const started = new Set(filings.map((x) => `${x.entities.id}|${x.tax_year}|${x.stage}`))
  const s = f.search.trim().toLowerCase()
  const newWork = (work ?? []).filter((w) => !(w.entity_id && started.has(`${w.entity_id}|${w.tax_year}|${w.stage}`)))
    .filter((w) => (!f.stage || w.stage === f.stage) && (!f.group || w.entities?.client_groups?.name === f.group)
      && (!s || [w.entities?.name, w.entities?.client_groups?.name].some((v) => v?.toLowerCase().includes(s))))
  const rows = applyFilters(filings, f)

  const stepRows = (statuses: FilingStatus[]) =>
    rows.filter((x) => statuses.includes(x.status)).sort((a, b) => (since(a) ?? a.id).localeCompare(since(b) ?? b.id))

  return (
    <>
      <PageHeader title="Work" sub="Returns to check, email and file, by step. Oldest first in each step."
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
                <div className="mb-3 flex h-9 items-center gap-3">
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${count ? 'bg-zinc-900 text-white' : 'bg-zinc-200 text-zinc-500'}`}>{step.n}</span>
                  <h2 className={`text-base font-semibold ${count ? 'text-zinc-900' : 'text-zinc-400'}`}>{step.title}</h2>
                  <span className="text-sm tabular-nums text-zinc-400">{count}</span>
                  <span className="ml-auto text-sm text-zinc-500">{step.next}</span>
                </div>
                {count === 0 ? null : (
                  <Card>
                    <Table cols={[['Client', '28%'], ['Year', '80px'], ['Type', '120px'], ['Status'], ['Since', '130px'], ['Waiting', '90px'], ['Preparer', '120px'], ['', '96px', 'right']]}>
                      {karbon.map((w) => (
                        <Tr key={w.karbon_key}>
                          <Td><div className="truncate font-medium">{w.entities?.name ?? <span className="text-red-600">Not matched to a client</span>}</div><Sub>{w.entities?.client_groups?.name}</Sub></Td>
                          <Td className="tabular-nums">{w.tax_year ?? '—'}</Td>
                          <Td><StageBadge stage={w.stage} /></Td>
                          <Td className="text-zinc-600"><FileText className="mr-1.5 inline h-4 w-4 align-[-3px] text-zinc-400" />New · {w.secondary_status ?? w.primary_status}</Td>
                          <Td className="text-zinc-600">{date(w.first_seen_at)}</Td>
                          <Td className="tabular-nums text-zinc-600">{daysSince(w.first_seen_at)}d</Td>
                          <Td className="text-zinc-400">—</Td>
                          <Td right className="overflow-visible">{isAdmin && w.entity_id && w.tax_year ? <Button variant="primary" onClick={() => open(w)}>Open</Button> : null}</Td>
                        </Tr>
                      ))}
                      {list.map((x) => (
                        <Tr key={x.id} onClick={() => nav(yearPath(x))}>
                          <Td><div className="truncate font-medium">{x.entities.name}</div><Sub>{x.entities.client_groups?.name}</Sub></Td>
                          <Td className="tabular-nums">{x.tax_year}</Td>
                          <Td><StageBadge stage={x.stage} /></Td>
                          <Td className="text-zinc-600">{x.status === 'client_modified_ach' ? 'Changed bank' : x.status === 'client_modified_method' ? 'Changed payment method' : x.status === 'not_started' ? 'Opened, not pulled' : '—'}</Td>
                          <Td className="text-zinc-600">{date(since(x))}</Td>
                          <Td className="tabular-nums text-zinc-600">{since(x) ? `${daysSince(since(x))}d` : '—'}</Td>
                          <Td className="text-zinc-600">{person(x.entities.assigned_preparer)}</Td>
                          <Td />
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
