import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarClock, Check, Plus, Trash2, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { date, money } from '../lib/format'
import { buildSchedule, DEPARTMENTS, penaltySavings, suggestTarget, type Frequency, type Schedule } from '../lib/plans'
import { Badge, Button, Card, Empty, SectionTitle, Table, Td } from './ui'
import { Field, inputCls, Modal } from './Modal'
import { AddBankModal } from './BankInfo'

export type PlanPayment = { id: string; seq: number; due_date: string; installment_deadline: string; amount: number; who_pays: 'richelle' | 'client'; status: 'scheduled' | 'made' | 'missed'; confirmation_received: boolean; completed_at: string | null; note: string | null }
export type Plan = {
  id: string; entity_id: string; tax_year: number; department: string; schedule: Schedule; frequency: Frequency; pay_day: number
  basis: string; target_amount: number; who_pays: 'richelle' | 'client'; bank_account_id: string | null; show_savings: boolean; notes: string | null
  entities?: { name: string }; bank_accounts?: { last4: string; label: string | null } | null; plan_payments: PlanPayment[]
}
type Bank = { id: string; last4: string; label: string | null; account_type: string }

export const PLAN_SELECT = '*, entities(name), bank_accounts(last4, label), plan_payments(*)'
export const WHO: Record<string, string> = { richelle: 'Richelle', client: 'Client' }

const today = () => new Date().toISOString().slice(0, 10)

export function paymentState(p: PlanPayment) {
  if (p.status === 'made') return <Badge tone="green">Made</Badge>
  if (p.status === 'missed') return <Badge tone="red">Missed</Badge>
  if (p.due_date < today()) return <Badge tone="red">Overdue</Badge>
  if (p.due_date === today()) return <Badge tone="amber">Due today</Badge>
  return <Badge>Scheduled</Badge>
}

export async function markPayment(p: PlanPayment, status: 'made' | 'missed' | 'scheduled', userId?: string) {
  if (status === 'made' && p.who_pays === 'client' && !p.confirmation_received) {
    if (!confirm('The client pays this one himself. It only counts once he sends the confirmation. Did we receive it?')) return false
  }
  const { error } = await supabase.from('plan_payments').update({
    status, completed_at: status === 'scheduled' ? null : new Date().toISOString(), completed_by: status === 'scheduled' ? null : userId,
    confirmation_received: status === 'made' && p.who_pays === 'client' ? true : p.confirmation_received,
  }).eq('id', p.id)
  if (error) { alert(error.message); return false }
  return true
}

// ---------- list ----------
export function PlansList({ entityIds, entityId, showEntity }: { entityIds?: string[]; entityId?: string; showEntity?: boolean }) {
  const [plans, setPlans] = useState<Plan[] | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const ids = useMemo(() => entityIds ?? (entityId ? [entityId] : []), [entityIds, entityId])
  const [rate, setRate] = useState(7)

  const load = useCallback(async () => {
    if (!ids.length) return setPlans([])
    const [{ data }, s] = await Promise.all([
      supabase.from('payment_plans').select(PLAN_SELECT).in('entity_id', ids).order('tax_year', { ascending: false }),
      supabase.from('app_settings').select('value').eq('key', 'underpayment_rate').maybeSingle(),
    ])
    setPlans((data as Plan[]) ?? []); setRate(Number(s.data?.value ?? 7))
  }, [ids])
  useEffect(() => { load() }, [load])

  const current = plans?.find((p) => p.id === open)
  return (
    <>
      <SectionTitle right={entityId && <Button size="sm" variant="primary" onClick={() => setCreating(true)}><Plus className="h-3.5 w-3.5" />New payment plan</Button>}>Estimated payment plans</SectionTitle>
      {!plans ? null : !plans.length ? (
        <Card><Empty title="No payment plans yet">{entityId ? 'Set one up after the season for each department the client pays estimates to.' : 'Open an entity to set up its plan.'}</Empty></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {plans.map((p) => {
            const pays = [...p.plan_payments].sort((a, b) => a.seq - b.seq)
            const made = pays.filter((x) => x.status === 'made').length
            const next = pays.find((x) => x.status === 'scheduled')
            const late = pays.filter((x) => x.status === 'missed' || (x.status === 'scheduled' && x.due_date < today())).length
            return (
              <button key={p.id} onClick={() => setOpen(p.id)} className="text-left">
                <Card className="p-5 transition hover:border-zinc-300 hover:shadow-md">
                  <div className="flex items-start justify-between">
                    <div>
                      {showEntity && <div className="mb-0.5 text-xs text-zinc-500">{p.entities?.name}</div>}
                      <div className="font-semibold">{p.department} <span className="font-normal text-zinc-400">· {p.tax_year}</span></div>
                      <div className="mt-0.5 text-sm text-zinc-500 capitalize">{p.frequency} · {WHO[p.who_pays]} pays{p.bank_accounts ? ` · •••• ${p.bank_accounts.last4}` : ''}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold tabular-nums">{money(p.target_amount)}</div>
                      {late > 0 && <Badge tone="red">{late} late</Badge>}
                    </div>
                  </div>
                  <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-zinc-100"><div className="h-full rounded-full bg-zinc-900" style={{ width: `${pays.length ? (made / pays.length) * 100 : 0}%` }} /></div>
                  <div className="mt-2 flex justify-between text-xs text-zinc-500">
                    <span>{made} of {pays.length} paid</span>
                    <span>{next ? `Next ${date(next.due_date)} · ${money(next.amount)}` : 'Complete'}</span>
                  </div>
                </Card>
              </button>
            )
          })}
        </div>
      )}
      {current && <PlanModal plan={current} rate={rate} onClose={() => setOpen(null)} onChanged={load} />}
      {creating && entityId && <PlanEditor entityId={entityId} rate={rate} onClose={() => setCreating(false)} onSaved={load} />}
    </>
  )
}

// ---------- one plan ----------
function PlanModal({ plan, rate, onClose, onChanged }: { plan: Plan; rate: number; onClose: () => void; onChanged: () => void }) {
  const { session } = useAuth()
  const pays = [...plan.plan_payments].sort((a, b) => a.seq - b.seq)
  const savings = penaltySavings(pays, plan.schedule, plan.tax_year, rate)

  const act = async (p: PlanPayment, s: 'made' | 'missed' | 'scheduled') => { if (await markPayment(p, s, session?.user.id)) onChanged() }
  const setWho = async (p: PlanPayment, who: string) => { await supabase.from('plan_payments').update({ who_pays: who }).eq('id', p.id); onChanged() }
  const toggleSavings = async () => { await supabase.from('payment_plans').update({ show_savings: !plan.show_savings }).eq('id', plan.id); onChanged() }
  const del = async () => {
    if (!confirm('Delete this payment plan and all its scheduled payments? This can’t be undone.')) return
    await supabase.from('payment_plans').delete().eq('id', plan.id); onClose(); onChanged()
  }

  return (
    <Modal wide title={`${plan.department} · ${plan.tax_year} estimated payments`} onClose={onClose}>
      <div className="mb-5 grid grid-cols-2 gap-4 rounded-xl bg-zinc-50 p-4 md:grid-cols-4">
        <div><div className="text-xs text-zinc-500">Total</div><div className="font-semibold tabular-nums">{money(plan.target_amount)}</div></div>
        <div><div className="text-xs text-zinc-500">Schedule</div><div className="capitalize">{plan.frequency}, day {plan.pay_day}</div></div>
        <div><div className="text-xs text-zinc-500">Paid from</div><div>{plan.bank_accounts ? `•••• ${plan.bank_accounts.last4}` : '—'}</div></div>
        <div>
          <div className="text-xs text-zinc-500">Penalty savings</div>
          <div className="flex items-center gap-2"><span className="font-semibold tabular-nums text-emerald-700">{money(savings)}</span>
            <button onClick={toggleSavings} className="text-xs text-zinc-500 underline">{plan.show_savings ? 'shown to client' : 'hidden from client'}</button></div>
        </div>
      </div>
      <Table head={['#', 'Date', 'Counts for', 'Amount', 'Who pays', 'Status', '']}>
        {pays.map((p) => (
          <tr key={p.id}>
            <Td className="text-zinc-400">{p.seq}</Td>
            <Td className="tabular-nums">{date(p.due_date)}</Td>
            <Td className="text-xs text-zinc-500">{date(p.installment_deadline)}</Td>
            <Td className="font-medium tabular-nums">{money(p.amount)}</Td>
            <Td>
              <select value={p.who_pays} onChange={(e) => setWho(p, e.target.value)} disabled={p.status !== 'scheduled'}
                className="rounded-md border-0 bg-transparent py-1 pl-1 pr-6 text-sm ring-1 ring-inset ring-zinc-200 focus:ring-zinc-900">
                <option value="richelle">Richelle</option><option value="client">Client</option>
              </select>
            </Td>
            <Td>{paymentState(p)}</Td>
            <Td className="whitespace-nowrap text-right">
              {p.status === 'scheduled' ? (
                <span className="inline-flex gap-1">
                  <Button size="sm" onClick={() => act(p, 'made')}><Check className="h-3.5 w-3.5" />Made</Button>
                  {p.due_date <= today() && <Button size="sm" variant="ghost" onClick={() => act(p, 'missed')}><X className="h-3.5 w-3.5" />Missed</Button>}
                </span>
              ) : <button onClick={() => act(p, 'scheduled')} className="text-xs text-zinc-400 underline">Undo</button>}
            </Td>
          </tr>
        ))}
      </Table>
      <p className="mt-4 text-xs text-zinc-500">Reminder to the client 3 days before each payment, and an email to Richelle on days payments are due, start once the payments@ mailbox is connected.</p>
      <div className="mt-6 flex justify-between"><Button variant="ghost" onClick={del}><Trash2 className="h-4 w-4" />Delete plan</Button><Button onClick={onClose}>Close</Button></div>
    </Modal>
  )
}

// ---------- create ----------
function PlanEditor({ entityId, rate, onClose, onSaved }: { entityId: string; rate: number; onClose: () => void; onSaved: () => void }) {
  const { session } = useAuth()
  const year = new Date().getFullYear()
  const [banks, setBanks] = useState<Bank[]>([])
  const [returnType, setReturnType] = useState<string | null>(null)
  const [addingBank, setAddingBank] = useState(false)
  const [f, setF] = useState({
    tax_year: String(year + (new Date().getMonth() >= 9 ? 1 : 0)), department: 'IRS', other: '', schedule: 'individual' as Schedule,
    priorTax: '', priorAgi: '', mfs: false, withholding: '', overpayment: '', currentEstimate: '', ptetElected: true, ptetStarting: false,
    useCustom: false, custom: '', frequency: 'quarterly' as Frequency, payDay: '15', startMonth: '', who: 'richelle' as 'richelle' | 'client', bank: '', showSavings: true, notes: '',
  })
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }))

  const loadBanks = useCallback(async () => {
    const [b, e] = await Promise.all([
      supabase.from('bank_accounts').select('id, last4, label, account_type').eq('entity_id', entityId).order('created_at'),
      supabase.from('entities').select('return_type').eq('id', entityId).single(),
    ])
    setBanks((b.data as Bank[]) ?? []); setReturnType(e.data?.return_type ?? null)
  }, [entityId])
  useEffect(() => { loadBanks() }, [loadBanks])

  // Schedule follows the department and the entity type
  useEffect(() => {
    const d = DEPARTMENTS.find((x) => x.value === f.department)
    const corp = returnType === '1120' || returnType === '1120-S'
    set('schedule', d?.schedule === 'ptet' ? 'ptet' : corp ? 'corporation' : 'individual')
  }, [f.department, returnType])

  // Prefill last year's tax from the data-mining import when available
  useEffect(() => {
    const dept = f.department.startsWith('NYS') ? 'NYS' : f.department
    supabase.from('prior_year_amounts').select('amount').eq('entity_id', entityId).eq('tax_year', Number(f.tax_year) - 1).eq('department', dept)
      .then(({ data }) => { if (data?.length) set('priorTax', String(data.reduce((s, r) => s + Number(r.amount), 0))) })
  }, [entityId, f.tax_year, f.department])

  const num = (s: string) => Number(String(s).replace(/[$,]/g, '')) || 0
  const sug = suggestTarget({
    department: f.department, schedule: f.schedule, priorTax: num(f.priorTax), priorAgi: num(f.priorAgi), marriedSeparate: f.mfs,
    withholding: num(f.withholding), overpayment: num(f.overpayment), currentEstimate: num(f.currentEstimate), ptetElectedLastYear: f.ptetElected, ptetStarting: f.ptetStarting,
  })
  const target = f.useCustom ? num(f.custom) : sug.amount
  const schedule = buildSchedule({ schedule: f.schedule, year: Number(f.tax_year), frequency: f.frequency, payDay: Number(f.payDay) || 15, target, startMonth: f.startMonth || undefined })
  const savings = penaltySavings(schedule, f.schedule, Number(f.tax_year), rate)
  const past = schedule.filter((p) => p.due_date < today()).length

  const save = async () => {
    const dept = f.department === 'Other' ? f.other.trim() : f.department
    if (!dept) return setErr('Enter the state.')
    if (target <= 0) return setErr('The total must be more than $0.')
    if (f.who === 'richelle' && !f.bank) return setErr('Pick the bank account Richelle pays from (or add one).')
    setBusy(true)
    const { data, error } = await supabase.from('payment_plans').insert({
      entity_id: entityId, tax_year: Number(f.tax_year), department: dept, schedule: f.schedule, frequency: f.frequency, pay_day: Number(f.payDay) || 15,
      basis: f.useCustom ? 'custom' : sug.basis, prior_year_tax: num(f.priorTax) || null, prior_year_agi: num(f.priorAgi) || null, married_separate: f.mfs,
      withholding: num(f.withholding), overpayment_applied: num(f.overpayment), current_year_estimate: num(f.currentEstimate) || null,
      target_amount: target, who_pays: f.who, bank_account_id: f.bank || null, show_savings: f.showSavings, notes: f.notes || null, created_by: session?.user.id,
    }).select('id').single()
    if (error) { setBusy(false); return setErr(error.message.includes('duplicate') ? `There is already a ${dept} plan for ${f.tax_year}.` : error.message) }
    const { error: e2 } = await supabase.from('plan_payments').insert(schedule.map((p) => ({ ...p, plan_id: data.id, who_pays: f.who })))
    await supabase.from('activity_log').insert({ entity_id: entityId, actor: session?.user.id, action: 'payment_plan_created', details: { department: dept, year: Number(f.tax_year), total: target } })
    setBusy(false)
    if (e2) return setErr(e2.message)
    onSaved(); onClose()
  }

  const money0 = (label: string, k: 'priorTax' | 'priorAgi' | 'withholding' | 'overpayment' | 'currentEstimate', hint?: string) => (
    <Field label={label} hint={hint}><input className={inputCls} inputMode="decimal" value={f[k]} onChange={(e) => set(k, e.target.value)} placeholder="$0" /></Field>
  )

  return (
    <Modal wide title="New estimated payment plan" onClose={onClose}>
      <div className="space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <Field label="Tax year"><input className={inputCls} value={f.tax_year} onChange={(e) => set('tax_year', e.target.value)} /></Field>
          <Field label="Department">
            <select className={inputCls} value={f.department} onChange={(e) => set('department', e.target.value)}>
              {DEPARTMENTS.map((d) => <option key={d.value}>{d.value}</option>)}<option>Other</option>
            </select>
          </Field>
          {f.department === 'Other'
            ? <Field label="State"><input className={inputCls} value={f.other} onChange={(e) => set('other', e.target.value)} placeholder="e.g. CT" /></Field>
            : <Field label="Due dates">
                <select className={inputCls} value={f.schedule} onChange={(e) => set('schedule', e.target.value as Schedule)}>
                  <option value="individual">Individual (4/15, 6/15, 9/15, 1/15)</option>
                  <option value="corporation">Corporation (4/15, 6/15, 9/15, 12/15)</option>
                  <option value="ptet">PTET (3/15, 6/15, 9/15, 12/15)</option>
                </select>
              </Field>}
        </div>

        <div className="rounded-xl border border-zinc-200 p-4">
          <div className="mb-3 text-sm font-semibold">Last year’s return</div>
          <div className="grid grid-cols-3 gap-4">
            {money0(f.schedule === 'ptet' ? 'Last year’s PTET' : 'Last year’s tax', 'priorTax')}
            {f.schedule === 'individual' && f.department !== 'NJ' && money0(f.department === 'IRS' ? 'Last year’s AGI' : 'Last year’s NY AGI', 'priorAgi')}
            {f.schedule === 'individual' && money0('Withholding this year', 'withholding')}
            {money0('Overpayment applied from last year', 'overpayment')}
            {f.schedule === 'ptet' && money0('This year’s expected PTET', 'currentEstimate')}
          </div>
          <div className="mt-3 flex flex-wrap gap-5 text-sm">
            {f.schedule === 'individual' && f.department !== 'NJ' && <label className="flex items-center gap-2"><input type="checkbox" checked={f.mfs} onChange={(e) => set('mfs', e.target.checked)} />Married filing separately</label>}
            {f.schedule === 'ptet' && <>
              <label className="flex items-center gap-2"><input type="checkbox" checked={f.ptetElected} onChange={(e) => set('ptetElected', e.target.checked)} />Elected PTET last year</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={f.ptetStarting} onChange={(e) => set('ptetStarting', e.target.checked)} />New to PTET (plan at 120%)</label>
            </>}
          </div>
        </div>

        <div className="rounded-xl bg-zinc-50 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-medium text-zinc-500">Suggested total</div>
              <div className="text-2xl font-semibold tabular-nums">{money(sug.amount)}</div>
              <div className="mt-1 text-sm text-zinc-600">{sug.explain}</div>
              {sug.warning && <div className="mt-1 text-sm text-amber-700">{sug.warning}</div>}
            </div>
            <div className="w-56">
              <label className="mb-1.5 flex items-center gap-2 text-sm"><input type="checkbox" checked={f.useCustom} onChange={(e) => set('useCustom', e.target.checked)} />Use my own amount</label>
              {f.useCustom && <input className={inputCls} inputMode="decimal" value={f.custom} onChange={(e) => set('custom', e.target.value)} placeholder="$0" />}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <Field label="How often">
            <select className={inputCls} value={f.frequency} onChange={(e) => set('frequency', e.target.value as Frequency)}><option value="quarterly">Quarterly</option><option value="monthly">Monthly</option></select>
          </Field>
          <Field label="Day of month" hint="Weekends and holidays move to the next business day"><input className={inputCls} inputMode="numeric" value={f.payDay} onChange={(e) => set('payDay', e.target.value)} /></Field>
          {f.frequency === 'monthly' && <Field label="First month"><input type="month" className={inputCls} value={f.startMonth} onChange={(e) => set('startMonth', e.target.value)} /></Field>}
          <Field label="Who pays">
            <select className={inputCls} value={f.who} onChange={(e) => set('who', e.target.value as 'richelle' | 'client')}><option value="richelle">Richelle, from the client’s bank</option><option value="client">The client himself</option></select>
          </Field>
          <Field label="Bank account">
            <div className="flex gap-1">
              <select className={inputCls} value={f.bank} onChange={(e) => set('bank', e.target.value)}>
                <option value="">{banks.length ? 'Choose…' : 'None saved'}</option>
                {banks.map((b) => <option key={b.id} value={b.id}>{b.label ?? 'Account'} •••• {b.last4}</option>)}
              </select>
              <button onClick={() => setAddingBank(true)} title="Add bank account" className="rounded-lg px-2 ring-1 ring-inset ring-zinc-300 hover:bg-zinc-50"><Plus className="h-4 w-4" /></button>
            </div>
          </Field>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold"><CalendarClock className="h-4 w-4" />{schedule.length} payments</div>
            <label className="flex items-center gap-2 text-sm text-zinc-600">
              <input type="checkbox" checked={f.showSavings} onChange={(e) => set('showSavings', e.target.checked)} />
              Show the client he saves <b className="tabular-nums text-emerald-700">{money(savings)}</b> in penalties
            </label>
          </div>
          <div className="max-h-56 overflow-y-auto rounded-xl border border-zinc-200">
            <Table head={['Date', 'Counts for', 'Amount']}>
              {schedule.map((p) => (
                <tr key={p.seq} className={p.due_date < today() ? 'text-zinc-400' : ''}>
                  <Td className="tabular-nums">{date(p.due_date)}{p.due_date < today() && <span className="ml-2 text-xs">past, mark made or missed</span>}</Td>
                  <Td className="text-xs">{date(p.installment_deadline)}</Td>
                  <Td className="font-medium tabular-nums">{money(p.amount)}</Td>
                </tr>
              ))}
            </Table>
          </div>
          {past > 0 && <p className="mt-2 text-xs text-zinc-500">This plan starts late: {past} date{past > 1 ? 's are' : ' is'} already past. After saving, mark each one made or missed.</p>}
        </div>

        {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
        <div className="flex justify-end gap-2"><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save} disabled={busy}>Save plan</Button></div>
      </div>
      {addingBank && <AddBankModal entityId={entityId} onClose={() => setAddingBank(false)} onSaved={loadBanks} />}
    </Modal>
  )
}
