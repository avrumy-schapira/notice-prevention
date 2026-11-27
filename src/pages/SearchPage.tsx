import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Card, Empty, Loading, PageHeader, StatusBadge } from '../components/ui'
import type { FilingStatus } from '../lib/types'

type G = { id: string; name: string }
type E = { id: string; name: string; client_id: string | null; client_groups: { name: string } | null; filings: { tax_year: number; stage: string; status: FilingStatus }[] }

export function SearchPage() {
  const [params] = useSearchParams()
  const q = params.get('q') ?? ''
  const [res, setRes] = useState<{ groups: G[]; ents: E[] } | null>(null)

  useEffect(() => {
    setRes(null)
    const like = `%${q.replace(/[%_,()]/g, ' ')}%`
    Promise.all([
      supabase.from('client_group_list').select('id, name').ilike('name', like).order('name').limit(20),
      supabase.from('entities').select('id, name, client_id, client_groups(name), filings(tax_year, stage, status)')
        .or(`name.ilike.${like},client_id.ilike.${like}`).or('karbon_status.is.null,karbon_status.not.in.(Inactive,Internal)').order('name').limit(50),
    ]).then(([g, e]) => setRes({ groups: (g.data as G[]) ?? [], ents: (e.data as unknown as E[]) ?? [] }))
  }, [q])

  return (
    <>
      <PageHeader title={`Results for “${q}”`} sub="Client groups, entities and all their returns, including filed" />
      {!res ? <Card><Loading /></Card> : !res.groups.length && !res.ents.length ? <Card><Empty title="Nothing found" /></Card> : (
        <div className="space-y-6">
          {res.groups.length > 0 && (
            <Card>
              <div className="border-b border-zinc-100 px-5 py-2.5 text-xs font-medium text-zinc-500">Client groups</div>
              <ul className="divide-y divide-zinc-100">
                {res.groups.map((g) => <li key={g.id}><Link to={`/clients/${g.id}`} className="block px-5 py-3 font-medium hover:bg-zinc-50">{g.name}</Link></li>)}
              </ul>
            </Card>
          )}
          {res.ents.length > 0 && (
            <Card>
              <div className="border-b border-zinc-100 px-5 py-2.5 text-xs font-medium text-zinc-500">Entities</div>
              <ul className="divide-y divide-zinc-100">
                {res.ents.map((e) => (
                  <li key={e.id}>
                    <Link to={`/entity/${e.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-zinc-50">
                      <div className="flex-1"><div className="font-medium">{e.name}</div><div className="text-xs text-zinc-500">{e.client_groups?.name ?? 'Not in a client group'} · <span className="font-mono">{e.client_id ?? 'no ID'}</span></div></div>
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {e.filings.sort((a, b) => b.tax_year - a.tax_year).slice(0, 3).map((f, i) => (
                          <span key={i} className="flex items-center gap-1.5 text-xs text-zinc-500">{f.tax_year} {f.stage === 'extension' ? 'Ext' : 'Return'} <StatusBadge status={f.status} /></span>
                        ))}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
    </>
  )
}
