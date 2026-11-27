import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Card, Empty, PageHeader, StatusBadge, Td, Th } from '../components/ui'
import { date } from '../lib/format'
import type { FilingStatus } from '../lib/types'

type E = {
  id: string; name: string; client_id: string | null; return_type: string | null; assigned_preparer: string | null; karbon_url: string | null
  client_groups: { name: string } | null
  email_recipients: { id: string; email: string; name: string | null }[]
  last_used_banks: { id: string; last4: string | null; account_type: string | null; source: string | null; recorded_at: string }[]
  filings: { id: string; tax_year: number; stage: string; status: FilingStatus; filed_at: string | null }[]
}

export function EntityPage() {
  const { id } = useParams()
  const [e, setE] = useState<E | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('entities')
      .select('id, name, client_id, return_type, assigned_preparer, karbon_url, client_groups(name), email_recipients(id, email, name), last_used_banks(id, last4, account_type, source, recorded_at), filings(id, tax_year, stage, status, filed_at)')
      .eq('id', id!).single()
      .then(({ data, error }) => { setE(data as unknown as E); setError(error?.message ?? null) })
  }, [id])

  if (error) return <p className="text-sm text-red-600">{error}</p>
  if (!e) return <Empty>Loading…</Empty>
  const bank = [...e.last_used_banks].sort((a, b) => b.recorded_at.localeCompare(a.recorded_at))[0]

  return (
    <>
      <PageHeader title={e.name} sub={`${e.client_groups?.name ?? 'No group'} · ${e.client_id ?? 'no client ID'} · ${e.return_type ?? 'return type unknown'}`}
        right={e.karbon_url && <a className="text-sm underline" href={e.karbon_url} target="_blank" rel="noreferrer">Open in Karbon</a>} />
      <div className="mb-6 grid grid-cols-3 gap-4">
        <Card className="p-4"><div className="text-xs text-slate-500">Preparer</div><div className="text-sm">{e.assigned_preparer ?? '—'}</div></Card>
        <Card className="p-4"><div className="text-xs text-slate-500">Saved recipients</div>
          <div className="text-sm">{e.email_recipients.length ? e.email_recipients.map((r) => <div key={r.id}>{r.name ? `${r.name} · ` : ''}{r.email}</div>) : '—'}</div></Card>
        <Card className="p-4"><div className="text-xs text-slate-500">Last used bank</div>
          <div className="text-sm">{bank ? `…${bank.last4} ${bank.account_type ?? ''} (${bank.source}, ${date(bank.recorded_at)})` : '—'}</div></Card>
      </div>
      <Card>
        <table className="w-full">
          <thead className="border-b border-slate-200"><tr><Th>Year</Th><Th>Stage</Th><Th>Status</Th><Th>Filed</Th></tr></thead>
          <tbody>
            {[...e.filings].sort((a, b) => b.tax_year - a.tax_year).map((f) => (
              <tr key={f.id} className="border-b border-slate-100 hover:bg-slate-50">
                <Td><Link className="hover:underline" to={`/filing/${f.id}`}>{f.tax_year}</Link></Td>
                <Td className="capitalize">{f.stage}</Td>
                <Td><StatusBadge status={f.status} /></Td>
                <Td>{date(f.filed_at)}</Td>
              </tr>
            ))}
          </tbody>
        </table>
        {!e.filings.length && <Empty>No filings yet.</Empty>}
      </Card>
    </>
  )
}
