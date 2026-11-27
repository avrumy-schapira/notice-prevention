import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { person } from '../lib/format'
import { Badge, Card, Empty, Loading, PageHeader, SearchBox, Table, Td } from '../components/ui'

type E = { id: string; name: string; client_id: string | null; return_type: string | null; assigned_preparer: string | null; karbon_status: string | null }

export function GroupPage() {
  const { groupId } = useParams()
  const nav = useNavigate()
  const none = groupId === 'none'
  const [name, setName] = useState('')
  const [ents, setEnts] = useState<E[] | null>(null)
  const [q, setQ] = useState('')

  useEffect(() => {
    let query = supabase.from('entities').select('id, name, client_id, return_type, assigned_preparer, karbon_status').order('name')
    query = none ? query.is('client_group_id', null) : query.eq('client_group_id', groupId!)
    query.then(({ data }) => setEnts((data as E[]) ?? []))
    if (none) setName('Not in a client group')
    else supabase.from('client_groups').select('name').eq('id', groupId!).single().then(({ data }) => setName(data?.name ?? ''))
  }, [groupId, none])

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase()
    return (ents ?? []).filter((e) => !s || e.name.toLowerCase().includes(s) || e.client_id?.toLowerCase().includes(s))
  }, [ents, q])

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Clients', to: '/clients' }, { label: name }]}
        title={name || '…'}
        sub={ents ? `${ents.length} ${ents.length === 1 ? 'entity' : 'entities'}` : undefined}
        right={ents && ents.length > 8 ? <SearchBox value={q} onChange={setQ} placeholder="Search entities" /> : undefined}
      />
      <Card>
        {!ents ? <Loading /> : !shown.length ? <Empty title="No entities" /> : (
          <Table head={['Entity', 'Client ID', 'Return', 'Preparer', 'Karbon', '']}>
            {shown.map((e) => (
              <tr key={e.id} className="group cursor-pointer hover:bg-zinc-50" onClick={() => nav(`/entity/${e.id}`)}>
                <Td><Link to={`/entity/${e.id}`} className="font-medium text-zinc-900 hover:underline">{e.name}</Link></Td>
                <Td className="font-mono text-xs text-zinc-600">{e.client_id ?? '—'}</Td>
                <Td>{e.return_type ?? <span className="text-zinc-400">—</span>}</Td>
                <Td className="text-zinc-600">{person(e.assigned_preparer)}</Td>
                <Td>{e.karbon_status ? <Badge tone={e.karbon_status === 'Inactive' ? 'zinc' : e.karbon_status.startsWith('Client') ? 'green' : 'amber'}>{e.karbon_status}</Badge> : '—'}</Td>
                <Td className="w-8"><Link to={`/entity/${e.id}`}><ChevronRight className="h-4 w-4 text-zinc-300 group-hover:text-zinc-500" /></Link></Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  )
}
