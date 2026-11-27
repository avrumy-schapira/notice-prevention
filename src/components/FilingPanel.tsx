import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Check, CircleDashed, Download, Mail, Send, Upload } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { date, dateTime, method, money } from '../lib/format'
import { FILING_SELECT, type Filing, type PaymentLine } from '../lib/types'
import { Badge, Button, Card, Empty, Loading, SectionTitle, StatusBadge, Table, Td } from './ui'
import { BankReveal } from './BankReveal'

type Flag = { id: string; check_code: string; message: string; status: string; preparer_name: string | null; approved_at: string | null }
type Log = { id: number; action: string; details: Record<string, unknown> | null; created_at: string; profiles: { email: string } | null }

const clientResponse = (l: PaymentLine) =>
  l.response === 'confirmed' ? <Badge tone="green">Confirmed</Badge>
    : l.response === 'modified' ? <Badge tone="amber">{l.new_method === 'efw' ? `New bank •••• ${l.new_last4}` : `Changed to ${method(l.new_method)}`}{l.entered_in_ultratax_at ? ' · in UltraTax' : ''}</Badge>
      : <Badge>Waiting</Badge>

const paymentStatus = (l: PaymentLine) =>
  l.payment_status === 'verified' ? <Badge tone="green">Verified</Badge>
    : l.payment_status === 'manual_paid' ? <Badge tone="green">Paid manually</Badge>
      : l.manual_payment_needed || l.client_paid_response === 'not_paid' ? <Badge tone="red">Manual payment needed</Badge>
        : l.client_paid_response === 'paid' ? <Badge tone="blue">Client says paid</Badge>
          : <Badge>Pending</Badge>

function Step({ done, label, at }: { done: boolean; label: string; at?: string | null }) {
  return (
    <div className="flex items-center gap-2.5">
      {done ? <div className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900 text-white"><Check className="h-3.5 w-3.5" /></div>
        : <CircleDashed className="h-6 w-6 text-zinc-300" />}
      <div className="leading-tight">
        <div className={`text-sm font-medium ${done ? 'text-zinc-900' : 'text-zinc-400'}`}>{label}</div>
        <div className="text-xs text-zinc-400">{at ? dateTime(at) : ' '}</div>
      </div>
    </div>
  )
}

export function FilingPanel({ filingId }: { filingId: string }) {
  const { profile, session } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const [f, setF] = useState<Filing | null>(null)
  const [flags, setFlags] = useState<Flag[]>([])
  const [log, setLog] = useState<Log[]>([])

  const load = useCallback(async () => {
    const [a, b, c] = await Promise.all([
      supabase.from('filings').select(FILING_SELECT).eq('id', filingId).single(),
      supabase.from('flags').select('*').eq('filing_id', filingId).order('created_at'),
      supabase.from('activity_log').select('id, action, details, created_at, profiles(email)').eq('filing_id', filingId).order('created_at', { ascending: false }),
    ])
    setF(a.data as unknown as Filing); setFlags((b.data as Flag[]) ?? []); setLog((c.data as unknown as Log[]) ?? [])
  }, [filingId])
  useEffect(() => { load() }, [load])

  const logAction = (action: string, details: object) =>
    supabase.from('activity_log').insert({ filing_id: filingId, entity_id: f?.entities.id, actor: session?.user.id, action, details })

  const approveFlag = async (flag: Flag) => {
    const preparer = prompt('Preparer who approved in Karbon:', '')
    if (!preparer) return
    const { error } = await supabase.from('flags').update({ status: 'approved', preparer_name: preparer, approved_by: session?.user.id, approved_at: new Date().toISOString() }).eq('id', flag.id)
    if (error) return alert(error.message)
    await logAction('preparer_approved_in_karbon', { check: flag.check_code, preparer })
    load()
  }

  const markFiled = async () => {
    if (!confirm('Mark as filed? The client link stops working and nothing can be changed after.')) return
    const now = new Date().toISOString()
    const { error } = await supabase.from('filings').update({ status: 'filed', filed_at: now, filed_by: session?.user.id, client_link_expires_at: now }).eq('id', filingId)
    if (error) return alert(error.message)
    await logAction('marked_filed', {})
    load()
  }

  if (!f) return <Loading />
  const payments = f.payment_lines.filter((l) => l.direction !== 'refund')
  const refunds = f.payment_lines.filter((l) => l.direction === 'refund')
  const open = flags.filter((x) => x.status === 'open')
  const filed = f.status === 'filed'

  return (
    <div className="space-y-8">
      {/* Progress */}
      <Card className="p-5">
        <div className="mb-5 flex items-center justify-between">
          <StatusBadge status={f.status} />
          {isAdmin && !filed && (
            <div className="flex flex-wrap gap-2">
              <Button disabled title="Connects when the UltraTax agent is linked"><Download className="h-4 w-4" />Pull from UltraTax</Button>
              <Button disabled={open.length > 0 || !f.last_pull_at} title={open.length ? 'Clear open flags first' : 'Email screen comes next'}><Mail className="h-4 w-4" />Email client</Button>
              <Button disabled title="Connects when the UltraTax agent is linked"><Upload className="h-4 w-4" />Enter in UltraTax</Button>
              <Button variant="primary" onClick={markFiled}><Send className="h-4 w-4" />Mark as filed</Button>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <Step done={!!f.last_pull_at} label="Pulled" at={f.last_pull_at} />
          <Step done={!!f.email_sent_at} label="Emailed" at={f.email_sent_at} />
          <Step done={!!f.client_responded_at} label="Client responded" at={f.client_responded_at} />
          <Step done={!!f.final_pull_at} label="Final pull" at={f.final_pull_at} />
          <Step done={filed} label="Filed" at={f.filed_at} />
        </div>
      </Card>

      {/* Flags */}
      {flags.length > 0 && (
        <section>
          <SectionTitle>Checks {open.length > 0 && <Badge tone="amber">{open.length} open</Badge>}</SectionTitle>
          <Card>
            <ul className="divide-y divide-zinc-100">
              {flags.map((x) => (
                <li key={x.id} className="flex items-center gap-3 px-5 py-3.5">
                  {x.status === 'open' ? <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" /> : <Check className="h-4 w-4 shrink-0 text-emerald-600" />}
                  <div className="flex-1 text-sm">{x.message}</div>
                  {x.status === 'open'
                    ? isAdmin && <Button size="sm" onClick={() => approveFlag(x)}>Preparer approved in Karbon</Button>
                    : <span className="text-xs text-zinc-500">Approved by {x.preparer_name} · {date(x.approved_at)}</span>}
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}

      {/* Payments */}
      <section>
        <SectionTitle>Payments</SectionTitle>
        <Card>
          {!payments.length ? <Empty title="No payments yet">They appear after the first pull from UltraTax.</Empty> : (
            <Table head={['Department', 'Amount', 'Method', 'Bank', 'Date', 'Client', 'Payment']}>
              {payments.map((l) => (
                <tr key={l.id}>
                  <Td><div className="font-medium">{l.department}</div><div className="text-xs text-zinc-500">{l.tax_type}{l.owner ? ` · ${l.owner === 'T' ? 'Taxpayer' : 'Spouse'}` : ''}</div></Td>
                  <Td className="font-medium tabular-nums">{money(l.amount)}</Td>
                  <Td>{l.method === 'efw' ? method(l.method) : <Badge tone="red">{method(l.method)}</Badge>}</Td>
                  <Td>{l.bank_last4 ? <div className="space-y-0.5 text-xs"><BankReveal kind="payment_line" id={l.id} field="routing" label="Rtg" /><br /><BankReveal kind="payment_line" id={l.id} field="account" last4={l.bank_last4} label="Acct" /></div> : '—'}
                    {l.new_last4 && <div className="mt-1 text-xs text-amber-700"><BankReveal kind="payment_line" id={l.id} field="new_account" last4={l.new_last4} label="New" /></div>}</Td>
                  <Td className="tabular-nums">{date(l.payment_date)}</Td>
                  <Td>{clientResponse(l)}</Td>
                  <Td>{paymentStatus(l)}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </section>

      {refunds.length > 0 && (
        <section>
          <SectionTitle>Refunds</SectionTitle>
          <Card>
            <Table head={['Department', 'Amount', 'Deposit account', 'Client']}>
              {refunds.map((l) => (
                <tr key={l.id}>
                  <Td><div className="font-medium">{l.department}</div><div className="text-xs text-zinc-500">{l.tax_type}</div></Td>
                  <Td className="font-medium tabular-nums text-emerald-700">{money(l.amount)}</Td>
                  <Td>{l.bank_last4 ? <BankReveal kind="payment_line" id={l.id} field="account" last4={l.bank_last4} /> : '—'}</Td>
                  <Td>{clientResponse(l)}</Td>
                </tr>
              ))}
            </Table>
          </Card>
        </section>
      )}

      {f.diagnostics && (
        <section>
          <SectionTitle>UltraTax diagnostics</SectionTitle>
          <Card className="p-5"><pre className="whitespace-pre-wrap font-sans text-sm text-zinc-700">{f.diagnostics}</pre></Card>
        </section>
      )}

      <section>
        <SectionTitle>Activity</SectionTitle>
        <Card>
          {!log.length ? <Empty title="No activity yet" /> : (
            <ul className="divide-y divide-zinc-100">
              {log.map((x) => (
                <li key={x.id} className="flex items-center gap-4 px-5 py-3 text-sm">
                  <span className="w-36 shrink-0 text-xs text-zinc-400">{dateTime(x.created_at)}</span>
                  <span className="flex-1 capitalize text-zinc-800">{x.action.replaceAll('_', ' ')}{x.details && Object.keys(x.details).length ? <span className="ml-2 normal-case text-zinc-400">{Object.entries(x.details).map(([k, v]) => `${k}: ${v}`).join(' · ')}</span> : null}</span>
                  <span className="text-xs text-zinc-500">{x.profiles?.email?.split('@')[0] ?? 'system'}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </div>
  )
}
