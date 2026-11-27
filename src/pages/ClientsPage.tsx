import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { lastSync, syncKarbon } from '../lib/karbon'
import { dateTime } from '../lib/format'
import { Button, Card, Empty, Loading, PageHeader, SearchBox } from '../components/ui'

type G = { id: string; name: string; entity_count: number }
type E = { id: string; name: string; client_id: string | null; client_groups: { name: string } | null }

const ACTIVE = 'karbon_status.is.null,karbon_status.not.in.(Inactive,Internal)'

function Row({ to, title, sub, right }: { to: string; title: string; sub?: string | null; right?: string | number }) {
  return (
    <li>
      <Link to={to} className="group flex h-12 items-center gap-4 px-5 hover:bg-zinc-50">
        <div className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-900">{title}{sub && <span className="ml-2 font-normal text-zinc-500">{sub}</span>}</div>
        {right != null && <span className="w-16 text-right text-sm tabular-nums text-zinc-400">{right}</span>}
        <ChevronRight className="h-4 w-4 shrink-0 text-zinc-300 group-hover:text-zinc-600" />
      </Link>
    </li>
  )
}

export function ClientsPage() {
  const { profile } = useAuth()
  const canSync = profile?.role === 'admin' || profile?.role === 'manager'
  const [groups, setGroups] = useState<G[] | null>(null)
  const [noGroup, setNoGroup] = useState(0)
  const [q, setQ] = useState('')
  const [ents, setEnts] = useState<E[]>([])
  const [synced, setSynced] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const load = useCallback(async () => {
    const [{ data }, { count }, last] = await Promise.all([
      supabase.from('client_group_list').select('id, name, entity_count').order('name'),
      supabase.from('entities').select('id', { count: 'exact', head: true }).is('client_group_id', null).or(ACTIVE),
      lastSync(),
    ])
    setGroups((data as G[]) ?? []); setNoGroup(count ?? 0); setSynced(last)
  }, [])
  useEffect(() => { load() }, [load])

  // Entity search (name or client ID), debounced
  useEffect(() => {
    const s = q.trim()
    if (s.length < 2) { setEnts([]); return }
    const t = setTimeout(() => {
      const like = `%${s.replace(/[%_,()]/g, ' ')}%`
      supabase.from('entities').select('id, name, client_id, client_groups(name)').or(`name.ilike.${like},client_id.ilike.${like}`).or(ACTIVE).order('name').limit(30)
        .then(({ data }) => setEnts((data as unknown as E[]) ?? []))
    }, 250)
    return () => clearTimeout(t)
  }, [q])

  const sync = async () => {
    setSyncing(true); setMsg(null)
    try { setMsg({ ok: true, text: await syncKarbon() }); await load() } catch (e) { setMsg({ ok: false, text: (e as Error).message }) }
    setSyncing(false)
  }

  const shownGroups = useMemo(() => {
    const s = q.trim().toLowerCase()
    return (groups ?? []).filter((g) => !s || g.name.toLowerCase().includes(s))
  }, [groups, q])
  const searching = q.trim().length >= 2

  return (
    <>
      <PageHeader title="Clients"
        sub={`${groups?.length ?? '…'} active client groups${synced ? ` · Karbon synced ${dateTime(synced)}` : ''}`}
        right={<>
          <SearchBox value={q} onChange={setQ} placeholder="Search groups and entities" width="w-80" />
          {canSync && <Button onClick={sync} disabled={syncing}><RefreshCw className={syncing ? 'animate-spin' : ''} />{syncing ? 'Syncing' : 'Sync Karbon'}</Button>}
        </>} />
      {msg && <div className={`mb-4 rounded-lg border px-4 py-3 text-sm ${msg.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'}`}>{msg.text}</div>}

      {searching && (
        <>
          <h2 className="mb-2 text-sm font-semibold text-zinc-700">Entities</h2>
          <Card className="mb-6">
            {!ents.length ? <Empty title="No entities match" /> : (
              <ul className="divide-y divide-zinc-100">
                {ents.map((e) => <Row key={e.id} to={`/entity/${e.id}`} title={e.name} sub={e.client_groups?.name ?? 'Not in a client group'} />)}
              </ul>
            )}
          </Card>
          <h2 className="mb-2 text-sm font-semibold text-zinc-700">Client groups</h2>
        </>
      )}

      <Card>
        {!groups ? <Loading rows={10} /> : !shownGroups.length ? <Empty title="No client groups match" /> : (
          <ul className="divide-y divide-zinc-100">
            {shownGroups.map((g) => <Row key={g.id} to={`/clients/${g.id}`} title={g.name} right={g.entity_count} />)}
            {noGroup > 0 && !searching && <Row to="/clients/none" title="Not in a client group" right={noGroup} />}
          </ul>
        )}
      </Card>
    </>
  )
}
