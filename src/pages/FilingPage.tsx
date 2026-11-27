import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { Button, Card, Empty, PageHeader, Pill, StatusBadge, Td, Th } from '../components/ui'
import { date, method, money } from '../lib/format'
import { FILING_SELECT, type Filing } from '../lib/types'

type Flag = { id: string; check_code: string; message: string; status: string; preparer_name: string | null; approved_at: string | null; payment_line_id: string | null }
type Log = { id: number; action: string; details: unknown; created_at: string; profiles: { email: string } | null }

export function FilingPage() {
  const { id } = useParams()
  const { profile, session } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const [f, setF] = useState<(Filing & { diagnostics: string | null }) | null>(null)
  const [flags, setFlags] = useState<Flag[]>([])
  const [log, setLog] = useState<Log[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [a, b, c] = await Promise.all([
      supabase.from('filings').select(FILING_SELECT + ', diagnostics').eq('id', id!).single(),
      supabase.from('flags').select('*').eq('filing_id', id!).order('created_at'),
      supabase.from('activity_log').select('id, action, details, created_at, profiles(email)').eq('filing_id', id!).order('created_at', { ascending: false }),
    ])
    setF(a.data as never); setFlags((b.data as Flag[]) ?? []); setLog((c.data as unknown as Log[]) ?? [])
    setError(a.error?.message ?? null)
  }, [id])
  useEffect(() => { load() }, [load])

  const logAction = (action: string, details: object) =>
    supabase.from('activity_log').insert({ filing_id: id, entity_id: f?.entities.id, actor: session?.user.id, action, details })

  const approveFlag = async (flag: Flag) => {
    const preparer = prompt('Preparer who approved in Karbon:', f?.entities.assigned_preparer ?? '')
    if (!preparer) return
    const { error } = await supabase.from('flags').update({ status: 'approved', preparer_name: preparer, approved_by: session?.user.id, approved_at: new Date().toISOString() }).eq('id', flag.id)
    if (error) return alert(error.message)
    await logAction('preparer_approved_in_karbon', { flag: flag.check_code, preparer })
    load()
  }

  const markFiled = async () => {
    if (!confirm('Mark this as filed? The client link stops working and nothing can be changed after.')) return
    const { error } = await supabase.from('filings').update({ status: 'filed', filed_at: new Date().toISOString(), filed_by: session?.user.id, client_link_expires_at: new Date().toISOString() }).eq('id', id!)
    if (error) return alert(error.message)
    await logAction('marked_filed', {})
    load()
  }

  if (error) return <p className="text-sm text-red-600">{error}</p>
  if (!f) return <Empty>Loading…</Empty>
  const open = flags.filter((x) => x.status === 'open')

  return (
    <>
      <PageHeader
        title={`${f.entities.name} — ${f.tax_year} ${f.stage}`}
        sub={`${f.entities.client_groups?.name ?? 'No group'} · ${f.entities.client_id ?? ''} · ${f.entities.return_type ?? ''} · Preparer: ${f.entities.assigned_preparer ?? '—'}`}
        right={<div className="flex items-center gap-2">
          <StatusBadge status={f.status} />
          <Link className="text-sm underline" to={`/entity/${f.entities.id}`}>Entity</Link>
        </div>}
      />

      {isAdmin && f.status !== 'filed' && (
        <Card className="mb-6 flex flex-wrap items-center gap-2 p-3">
          <Button disabled>Pull from UltraTax</Button>
          <Button disabled>Send email</Button>
          <Button disabled>Enter in UltraTax</Button>
          <Button disabled>Final pull</Button>
          <Button variant="primary" onClick={markFiled}>Mark as filed</Button>
          <span className="text-xs text-slate-400">Pull, email and agent buttons connect in the next steps.</span>
        </Card>
      )}

      <h2 className="mb-2 text-sm font-semibold">Payments and refunds</h2>
      <Card className="mb-6 overflow-x-auto">
        {!f.payment_lines.length ? <Empty>No lines yet — they appear after the first pull.</Empty> : (
          <table className="w-full">
            <thead className="border-b border-slate-200"><tr><Th>Department</Th><Th>Type</Th><Th>Due / refund</Th><Th>Method</Th><Th>Bank</Th><Th>Date</Th><Th>Client</Th><Th>Payment</Th></tr></thead>
            <tbody>
              {f.payment_lines.map((l) => (
                <tr key={l.id} className="border-b border-slate-100">
                  <Td>{l.department}</Td>
                  <Td>{l.tax_type}{l.owner ? ` (${l.owner})` : ''}</Td>
                  <Td>{l.direction === 'refund' ? <span className="text-emerald-700">Refund {money(l.amount)}</span> : money(l.amount)}</Td>
                  <Td>{method(l.method)}</Td>
                  <Td>{l.bank_last4 ? `…${l.bank_last4}` : '—'} {l.bank_last4 && <button disabled className="ml-1 text-xs text-slate-400" title="Reveal / Copy connects with encryption step">Reveal</button>}</Td>
                  <Td>{date(l.payment_date)}</Td>
                  <Td>
                    {l.response === 'waiting' && <Pill>Waiting</Pill>}
                    {l.response === 'confirmed' && <Pill tone="green">Confirmed</Pill>}
                    {l.response === 'modified' && <Pill tone="amber">Modified: {method(l.new_method)}{l.new_last4 ? ` …${l.new_last4}` : ''}{l.entered_in_ultratax_at ? ' (in UltraTax)' : ''}</Pill>}
                  </Td>
                  <Td>{l.direction === 'refund' ? '—' : l.payment_status === 'pending' ? (l.manual_payment_needed ? <Pill tone="red">Manual payment needed</Pill> : <Pill>Pending</Pill>) : <Pill tone="green">{l.payment_status === 'verified' ? 'Verified' : 'Manual paid'}</Pill>}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <h2 className="mb-2 text-sm font-semibold">Flags {open.length > 0 && <Pill tone="amber">{open.length} open</Pill>}</h2>
      <Card className="mb-6">
        {!flags.length ? <Empty>No flags.</Empty> : (
          <table className="w-full">
            <tbody>
              {flags.map((x) => (
                <tr key={x.id} className="border-b border-slate-100">
                  <Td className="w-48 text-xs text-slate-500">{x.check_code}</Td>
                  <Td>{x.message}</Td>
                  <Td className="w-72 text-right">
                    {x.status === 'open'
                      ? isAdmin && <Button onClick={() => approveFlag(x)}>Preparer approved in Karbon</Button>
                      : <span className="text-xs text-slate-500">Approved by {x.preparer_name} · {date(x.approved_at)}</span>}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {f.diagnostics && (<>
        <h2 className="mb-2 text-sm font-semibold">UltraTax diagnostics</h2>
        <Card className="mb-6 p-3"><pre className="whitespace-pre-wrap text-xs text-slate-700">{f.diagnostics}</pre></Card>
      </>)}

      <h2 className="mb-2 text-sm font-semibold">Activity</h2>
      <Card>
        {!log.length ? <Empty>No activity yet.</Empty> : (
          <table className="w-full"><tbody>
            {log.map((x) => (
              <tr key={x.id} className="border-b border-slate-100">
                <Td className="w-44 text-xs text-slate-500">{new Date(x.created_at).toLocaleString()}</Td>
                <Td className="w-56 text-xs">{x.profiles?.email ?? 'system'}</Td>
                <Td>{x.action.replaceAll('_', ' ')} <span className="text-xs text-slate-400">{x.details ? JSON.stringify(x.details) : ''}</span></Td>
              </tr>
            ))}
          </tbody></table>
        )}
      </Card>
    </>
  )
}
