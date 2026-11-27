import { useCallback, useEffect, useState } from 'react'
import { Mail, Phone, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { date, person } from '../lib/format'
import { Badge, Button, Card, SectionTitle } from './ui'
import { BankReveal } from './BankReveal'
import { Field, inputCls, Modal } from './Modal'

type Bank = { id: string; label: string | null; bank_name: string | null; account_type: string; last4: string; source: string; last_used_at: string | null; created_at: string }
type Ent = { id: string; name: string; client_id: string | null; email: string | null; phone: string | null; assigned_preparer: string | null; karbon_status: string | null }
type Rec = { id: string; email: string; name: string | null }

const SOURCE: Record<string, string> = { staff: 'Added by staff', client_modify: 'From client', ultratax: 'From UltraTax', scheduled_payments: 'Scheduled payments' }

export function AddBankModal({ entityId, onClose, onSaved }: { entityId: string; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ label: '', bank: '', routing: '', account: '', account2: '', type: 'checking' })
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value.trim() })
  const save = async () => {
    if (f.account !== f.account2) return setErr('Account numbers don’t match.')
    setBusy(true)
    const { error } = await supabase.rpc('save_bank_account', { p_entity: entityId, p_label: f.label, p_bank_name: f.bank, p_routing: f.routing, p_account: f.account, p_type: f.type })
    setBusy(false)
    if (error) return setErr(error.message)
    onSaved(); onClose()
  }
  return (
    <Modal title="Add bank account" onClose={onClose}>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Nickname (optional)"><input className={inputCls} value={f.label} onChange={set('label')} placeholder="Operating account" /></Field>
        <Field label="Bank (optional)"><input className={inputCls} value={f.bank} onChange={set('bank')} placeholder="Chase" /></Field>
        <Field label="Routing number"><input className={inputCls} inputMode="numeric" value={f.routing} onChange={set('routing')} maxLength={9} /></Field>
        <Field label="Account type">
          <select className={inputCls} value={f.type} onChange={set('type')}><option value="checking">Checking</option><option value="savings">Savings</option></select>
        </Field>
        <Field label="Account number"><input className={inputCls} inputMode="numeric" value={f.account} onChange={set('account')} autoComplete="off" /></Field>
        <Field label="Account number again"><input className={inputCls} inputMode="numeric" value={f.account2} onChange={set('account2')} autoComplete="off" onPaste={(e) => e.preventDefault()} /></Field>
      </div>
      <p className="mt-4 text-xs text-zinc-500">Stored encrypted. Clients and emails only ever see the last 4 digits; every reveal is recorded.</p>
      {err && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
      <div className="mt-6 flex justify-end gap-2"><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save} disabled={busy || !f.routing || !f.account}>Save account</Button></div>
    </Modal>
  )
}

export function EntityBankInfo({ entity, compact }: { entity: Ent; compact?: boolean }) {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const [banks, setBanks] = useState<Bank[]>([])
  const [recs, setRecs] = useState<Rec[]>([])
  const [adding, setAdding] = useState(false)
  const [newRec, setNewRec] = useState('')

  const load = useCallback(async () => {
    const [b, r] = await Promise.all([
      supabase.from('bank_accounts').select('id, label, bank_name, account_type, last4, source, last_used_at, created_at').eq('entity_id', entity.id).order('created_at'),
      supabase.from('email_recipients').select('id, email, name').eq('entity_id', entity.id).order('created_at'),
    ])
    setBanks((b.data as Bank[]) ?? []); setRecs((r.data as Rec[]) ?? [])
  }, [entity.id])
  useEffect(() => { load() }, [load])

  const remove = async (b: Bank) => {
    if (!confirm(`Remove the account ending ${b.last4}? This can’t be undone.`)) return
    const { error } = await supabase.from('bank_accounts').delete().eq('id', b.id)
    if (error) alert(error.message); load()
  }
  const addRec = async () => {
    const email = newRec.trim().toLowerCase()
    if (!email.includes('@')) return
    const { error } = await supabase.from('email_recipients').insert({ entity_id: entity.id, email })
    if (error) alert(error.message); setNewRec(''); load()
  }
  const delRec = async (id: string) => { await supabase.from('email_recipients').delete().eq('id', id); load() }
  const lastUsed = [...banks].filter((b) => b.last_used_at).sort((a, b) => b.last_used_at!.localeCompare(a.last_used_at!))[0]

  return (
    <div className={compact ? '' : 'space-y-8'}>
      {!compact && (
        <section>
          <SectionTitle>Client info</SectionTitle>
          <Card className="grid grid-cols-2 gap-6 p-5 md:grid-cols-4">
            <div><div className="text-xs font-medium text-zinc-500">Email (Karbon)</div><div className="mt-1 flex items-center gap-1.5 text-sm">{entity.email ? <><Mail className="h-3.5 w-3.5 text-zinc-400" />{entity.email}</> : '—'}</div></div>
            <div><div className="text-xs font-medium text-zinc-500">Phone (Karbon)</div><div className="mt-1 flex items-center gap-1.5 text-sm">{entity.phone ? <><Phone className="h-3.5 w-3.5 text-zinc-400" />{entity.phone}</> : '—'}</div></div>
            <div><div className="text-xs font-medium text-zinc-500">Client ID</div><div className="mt-1 font-mono text-sm">{entity.client_id ?? '—'}</div></div>
            <div><div className="text-xs font-medium text-zinc-500">Preparer</div><div className="mt-1 text-sm">{person(entity.assigned_preparer)}</div></div>
          </Card>
        </section>
      )}

      <section className={compact ? 'mb-4' : ''}>
        <SectionTitle right={<Button size="sm" onClick={() => setAdding(true)}><Plus className="h-3.5 w-3.5" />Add bank account</Button>}>
          {compact ? entity.name : 'Bank accounts'}
        </SectionTitle>
        <Card>
          {!banks.length ? <div className="px-5 py-6 text-sm text-zinc-400">No bank accounts saved.</div> : (
            <ul className="divide-y divide-zinc-100">
              {banks.map((b) => (
                <li key={b.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3.5 text-sm">
                  <div className="w-44">
                    <div className="font-medium">{b.label ?? b.bank_name ?? 'Bank account'}</div>
                    <div className="text-xs capitalize text-zinc-500">{[b.bank_name && b.label ? b.bank_name : null, b.account_type].filter(Boolean).join(' · ')}</div>
                  </div>
                  <BankReveal kind="bank_account" id={b.id} field="routing" label="Routing" />
                  <BankReveal kind="bank_account" id={b.id} field="account" last4={b.last4} label="Account" />
                  <div className="ml-auto flex items-center gap-2">
                    {lastUsed?.id === b.id && <Badge tone="blue">Last used {date(b.last_used_at)}</Badge>}
                    <span className="text-xs text-zinc-400">{SOURCE[b.source] ?? b.source}</span>
                    <button onClick={() => remove(b)} className="rounded p-1 text-zinc-300 hover:bg-red-50 hover:text-red-600" title="Remove"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      {!compact && (
        <section>
          <SectionTitle>Email recipients</SectionTitle>
          <Card className="p-5">
            <div className="flex flex-wrap gap-2">
              {recs.length ? recs.map((r) => (
                <span key={r.id} className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-sm">
                  {r.email}{isAdmin && <button onClick={() => delRec(r.id)} className="text-zinc-400 hover:text-red-600">×</button>}
                </span>
              )) : <span className="text-sm text-zinc-400">Saved the first time the admin sends an email.</span>}
            </div>
            {isAdmin && (
              <div className="mt-4 flex gap-2">
                <input className={`${inputCls} max-w-xs`} placeholder="Add recipient email" value={newRec} onChange={(e) => setNewRec(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addRec()} />
                <Button onClick={addRec}>Add</Button>
              </div>
            )}
          </Card>
        </section>
      )}
      {adding && <AddBankModal entityId={entity.id} onClose={() => setAdding(false)} onSaved={load} />}
    </div>
  )
}
