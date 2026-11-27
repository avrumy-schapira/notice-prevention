import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, RefreshCw, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { lastSync, syncKarbon } from '../lib/karbon'
import { dateTime } from '../lib/format'
import { Button, Card, Empty, Loading, PageHeader, SearchBox } from '../components/ui'

type G = { id: string; name: string; entity_count: number }

export function ClientsPage() {
  const { profile } = useAuth()
  const canSync = profile?.role === 'admin' || profile?.role === 'manager'
  const [groups, setGroups] = useState<G[] | null>(null)
  const [noGroup, setNoGroup] = useState(0)
  const [q, setQ] = useState('')
  const [synced, setSynced] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const load = useCallback(async () => {
    const [{ data }, { count }, last] = await Promise.all([
      supabase.from('client_group_list').select('id, name, entity_count').order('name'),
      supabase.from('entities').select('id', { count: 'exact', head: true }).is('client_group_id', null).or('karbon_status.is.null,karbon_status.not.in.(Inactive,Internal)'),
      lastSync(),
    ])
    setGroups((data as G[]) ?? [])
    setNoGroup(count ?? 0)
    setSynced(last)
  }, [])
  useEffect(() => { load() }, [load])

  const sync = async () => {
    setSyncing(true); setMsg(null)
    try { setMsg({ ok: true, text: await syncKarbon() }); await load() }
    catch (e) { setMsg({ ok: false, text: (e as Error).message }) }
    setSyncing(false)
  }

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase()
    return (groups ?? []).filter((g) => !s || g.name.toLowerCase().includes(s))
  }, [groups, q])

  return (
    <>
      <PageHeader
        title="Clients"
        sub={`${groups?.length ?? '…'} active client groups from Karbon${synced ? ` · last synced ${dateTime(synced)}` : ''}`}
        right={<>
          <SearchBox value={q} onChange={setQ} placeholder="Search client groups" />
          {canSync && <Button onClick={sync} disabled={syncing}><RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />{syncing ? 'Syncing…' : 'Sync Karbon'}</Button>}
        </>}
      />
      {msg && <div className={`mb-4 rounded-lg px-4 py-2.5 text-sm ${msg.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>{msg.text}</div>}

      <Card>
        {!groups ? <Loading /> : !shown.length ? <Empty title="No client groups found" /> : (
          <ul className="divide-y divide-zinc-100">
            {shown.map((g) => (
              <li key={g.id}>
                <Link to={`/clients/${g.id}`} className="group flex items-center gap-4 px-5 py-3.5 transition hover:bg-zinc-50">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 text-xs font-semibold text-zinc-600">
                    {g.name.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 font-medium text-zinc-900">{g.name}</div>
                  <div className="flex items-center gap-1.5 text-sm text-zinc-500"><Users className="h-4 w-4" />{g.entity_count}</div>
                  <ChevronRight className="h-4 w-4 text-zinc-300 transition group-hover:text-zinc-500" />
                </Link>
              </li>
            ))}
            {noGroup > 0 && !q && (
              <li>
                <Link to="/clients/none" className="group flex items-center gap-4 px-5 py-3.5 transition hover:bg-zinc-50">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-dashed border-zinc-300 text-xs text-zinc-400">—</div>
                  <div className="flex-1 font-medium text-zinc-500">Not in a client group</div>
                  <div className="flex items-center gap-1.5 text-sm text-zinc-500"><Users className="h-4 w-4" />{noGroup}</div>
                  <ChevronRight className="h-4 w-4 text-zinc-300" />
                </Link>
              </li>
            )}
          </ul>
        )}
      </Card>
    </>
  )
}
