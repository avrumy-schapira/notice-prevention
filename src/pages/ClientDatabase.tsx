import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Card, Empty, PageHeader, StatusBadge, Td, Th } from '../components/ui'
import type { FilingStatus } from '../lib/types'

type Row = {
  id: string; name: string; client_id: string | null; return_type: string | null; assigned_preparer: string | null
  client_groups: { name: string } | null
  filings: { id: string; tax_year: number; stage: 'extension' | 'return'; status: FilingStatus }[]
}

export function ClientDatabase() {
  const [params, setParams] = useSearchParams()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const q = params.get('q') ?? ''

  useEffect(() => {
    supabase
      .from('entities')
      .select('id, name, client_id, return_type, assigned_preparer, client_groups(name), filings(id, tax_year, stage, status)')
      .order('name')
      .then(({ data, error }) => {
        setRows((data as unknown as Row[]) ?? [])
        setError(error?.message ?? null)
        setLoading(false)
      })
  }, [])

  const groups = useMemo(() => {
    const s = q.trim().toLowerCase()
    const hit = rows.filter((r) => !s || [r.name, r.client_id, r.client_groups?.name].some((v) => v?.toLowerCase().includes(s)))
    const m = new Map<string, Row[]>()
    for (const r of hit) {
      const g = r.client_groups?.name ?? '(No group)'
      m.set(g, [...(m.get(g) ?? []), r])
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [rows, q])

  return (
    <>
      <PageHeader
        title="Client database"
        sub="Group → entity → year → extension / return"
        right={<input className="w-64 rounded-md border border-slate-300 px-2 py-1.5 text-sm" placeholder="Search client, ID or group"
          value={q} onChange={(e) => setParams(e.target.value ? { q: e.target.value } : {})} />}
      />
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      {loading ? <Card><Empty>Loading…</Empty></Card> : !groups.length ? <Card><Empty>No clients found.</Empty></Card> :
        groups.map(([group, ents]) => (
          <Card key={group} className="mb-4">
            <div className="border-b border-slate-200 px-3 py-2 text-sm font-semibold">{group}</div>
            <table className="w-full">
              <thead><tr><Th>Entity</Th><Th>Client ID</Th><Th>Return</Th><Th>Preparer</Th><Th>Filings</Th></tr></thead>
              <tbody>
                {ents.map((e) => (
                  <tr key={e.id} className="border-t border-slate-100 align-top">
                    <Td><Link className="font-medium hover:underline" to={`/entity/${e.id}`}>{e.name}</Link></Td>
                    <Td>{e.client_id ?? '—'}</Td>
                    <Td>{e.return_type ?? '—'}</Td>
                    <Td>{e.assigned_preparer ?? '—'}</Td>
                    <Td>
                      <div className="flex flex-wrap gap-2">
                        {[...e.filings].sort((a, b) => b.tax_year - a.tax_year || a.stage.localeCompare(b.stage)).map((f) => (
                          <Link key={f.id} to={`/filing/${f.id}`} className="inline-flex items-center gap-1 text-xs hover:underline">
                            {f.tax_year} {f.stage === 'extension' ? 'Ext' : 'Return'} <StatusBadge status={f.status} />
                          </Link>
                        ))}
                        {!e.filings.length && <span className="text-xs text-slate-400">none</span>}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        ))}
    </>
  )
}
