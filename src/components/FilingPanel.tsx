import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Check, Download, Mail, Send, Upload } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { date, dateTime, method, money } from '../lib/format'
import { FILING_SELECT, type Filing, type PaymentLine } from '../lib/types'
import { Badge, Button, Card, Empty, Loading, SectionTitle, StatusBadge, Sub, Table, Td, Tr } from './ui'
import { BankReveal } from './BankReveal'

type Flag = { id: string; check_code: string; message: string; status: string; preparer_name: string | null; approved_at: string | null }
type Log = { id: number; action: string; details: Record<string, unknown> | null; created_at: string; profiles: { email: string } | null }

const clientResponse = (l: PaymentLine) =>
  l.response === 'confirmed' ? <Badge tone="green">Confirmed</Badge>
    : l.response === 'modified' ? <Badge tone="amber">{l.new_method === 'efw' ? 'New bank' : `Pays by ${method(l.new_method).toLowerCase()}`}</Badge>
      : <Badge>Waiting</Badge>

const paymentStatus = (l: PaymentLine) =>
  l.payment_status === 'verified' ? <Badge tone="green">Verified</Badge>
    : l.payment_status === 'manual_paid' ? <Badge tone="green">Paid manually</Badge>
      : l.manual_payment_needed || l.client_paid_response === 'not_paid' ? <Badge tone="red">Not paid</Badge>
        : l.client_paid_response === 'paid' ? <Badge tone="blue">Client says paid</Badge>
          : <Badge>Pending</Badge>

const STEPS = ['Pulled', 'Emailed', 'Client answered', 'Final pull', 'Filed'] as const

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
    const preparer = prompt('Which preparer approved it in Karbon?', '')
    if (!preparer) return
    const { error } = await supabase.from('flags').update({ status: 'approved', preparer_name: preparer, approved_by: session?.user.id, approved_at: new Date().toISOString() }).eq('id', flag.id)
    if (error) return alert(error.message)
    await logAction('preparer_approved_in_karbon', { check: flag.check_code, preparer }); load()
  }
  const markFiled = async () => {
    if (!confirm('Mark as filed? The client link stops working and nothing can be changed after.')) return
    const now = new Date().toISOString()
    const { error } = await supabase.from('filings').update({ status: 'filed', filed_at: now, filed_by: session?.user.id, client_link_expires_at: now }).eq('id', filingId)
    if (error) return alert(error.message)
    await logAction('marked_filed', {}); load()
  }

  if (!f) return <Card><Loading /></Card>
  const payments = f.payment_lines.filter((l) => l.direction !== 'refund')
  const refunds = f.payment_lines.filter((l) => l.direction === 'refund')
  const open = flags.filter((x) => x.status === 'open')
  const filed = f.status === 'filed'
  const stepAt = [f.last_pull_at, f.email_sent_at, f.client_responded_at, f.final_pull_at, f.filed_at]

  return (
    <div className="space-y-8">
      <Card>
        <div className="flex h-16 items-center justify-between border-b border-zinc-100 px-5">
          <StatusBadge status={f.status} />
          {isAdmin && !filed && (
            <div className="flex gap-2">
              <Button disabled title="Connects when the UltraTax agent is linked"><Download />Pull</Button>
              <Button disabled={open.length > 0 || !f.last_pull_at} title={open.length ? 'Clear open flags first' : 'Coming next'}><Mail />Email client</Button>
              <Button disabled title="Connects when the UltraTax agent is linked"><Upload />Enter in UltraTax</Button>
              <Button variant="primary" onClick={markFiled}><Send />Mark as filed</Button>
            </div>
          )}
        </div>
        <ol className="grid grid-cols-5">
          {STEPS.map((label, i) => (
            <li key={label} className="flex items-center gap-3 border-r border-zinc-100 px-5 py-4 last:border-r-0">
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${stepAt[i] ? 'bg-zinc-900 text-white' : 'border border-zinc-300 text-zinc-400'}`}>
                {stepAt[i] ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <div className="min-w-0">
                <div className={`truncate text-sm font-medium ${stepAt[i] ? 'text-zinc-900' : 'text-zinc-400'}`}>{label}</div>
                <div className="h-4 truncate text-xs text-zinc-500">{stepAt[i] ? dateTime(stepAt[i]) : ''}</div>
              </div>
            </li>
          ))}
        </ol>
      </Card>

      {flags.length > 0 && (
        <section>
          <SectionTitle>Checks {open.length > 0 && <Badge tone="amber">{open.length} open</Badge>}</SectionTitle>
          <Card>
            <ul className="divide-y divide-zinc-100">
              {flags.map((x) => (
                <li key={x.id} className="flex min-h-14 items-center gap-3 px-5 py-2">
                  {x.status === 'open' ? <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" /> : <Check className="h-4 w-4 shrink-0 text-emerald-600" />}
                  <div className="flex-1 text-sm">{x.message}</div>
                  {x.status === 'open'
                    ? isAdmin && <Button onClick={() => approveFlag(x)}>Preparer approved in Karbon</Button>
                    : <span className="text-sm text-zinc-500">Approved by {x.preparer_name} · {date(x.approved_at)}</span>}
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}

      <section>
        <SectionTitle>Payments</SectionTitle>
        <Card>
          {!payments.length ? <Empty title="No payments yet">They show here after the first pull from UltraTax.</Empty> : (
            <Table cols={[['Department'], ['Amount', '130px', 'right'], ['Method', '130px'], ['Bank', '270px'], ['Date', '130px'], ['Client', '120px'], ['Payment', '120px']]}>
              {payments.map((l) => (
                <Tr key={l.id} className="h-16">
                  <Td><div className="truncate font-medium">{l.department}</div><Sub>{l.tax_type}{l.owner ? ` · ${l.owner === 'T' ? 'Taxpayer' : 'Spouse'}` : ''}</Sub></Td>
                  <Td right className="font-medium tabular-nums">{money(l.amount)}</Td>
                  <Td>{l.method === 'efw' ? method(l.method) : <Badge tone="red">{method(l.method)}</Badge>}</Td>
                  <Td className="text-xs">
                    {l.bank_last4 ? <><div><BankReveal kind="payment_line" id={l.id} field="routing" label="Routing" /></div><div><BankReveal kind="payment_line" id={l.id} field="account" last4={l.bank_last4} label="Account" /></div></> : '—'}
                  </Td>
                  <Td className="tabular-nums">{date(l.payment_date)}</Td>
                  <Td>{clientResponse(l)}</Td>
                  <Td>{paymentStatus(l)}</Td>
                </Tr>
              ))}
            </Table>
          )}
        </Card>
      </section>

      {refunds.length > 0 && (
        <section>
          <SectionTitle>Refunds</SectionTitle>
          <Card>
            <Table cols={[['Department', '30%'], ['Amount', '140px', 'right'], ['Deposit account'], ['Client', '140px']]}>
              {refunds.map((l) => (
                <Tr key={l.id}>
                  <Td><div className="truncate font-medium">{l.department}</div><Sub>{l.tax_type}</Sub></Td>
                  <Td right className="font-medium tabular-nums text-emerald-700">{money(l.amount)}</Td>
                  <Td className="text-xs">{l.bank_last4 ? <BankReveal kind="payment_line" id={l.id} field="account" last4={l.bank_last4} /> : '—'}</Td>
                  <Td>{clientResponse(l)}</Td>
                </Tr>
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
            <Table cols={[['When', '170px'], ['What'], ['Who', '160px']]}>
              {log.map((x) => (
                <Tr key={x.id}>
                  <Td className="text-zinc-500">{dateTime(x.created_at)}</Td>
                  <Td><span className="first-letter:uppercase">{x.action.replaceAll('_', ' ')}</span>{x.details && Object.keys(x.details).length ? <span className="ml-2 text-zinc-400">{Object.entries(x.details).map(([k, v]) => `${k}: ${v}`).join(' · ')}</span> : null}</Td>
                  <Td className="text-zinc-500">{x.profiles?.email?.split('@')[0] ?? 'system'}</Td>
                </Tr>
              ))}
            </Table>
          )}
        </Card>
      </section>
    </div>
  )
}
