// Estimated payment plans: safe-harbor suggestions, due dates, schedules and penalty savings.
// Rules follow "Tax Payment Planner | Simple Rules" (Payment System folder).

export type Schedule = 'individual' | 'corporation' | 'ptet'
export type Frequency = 'quarterly' | 'monthly'

export const DEPARTMENTS: { value: string; schedule: Schedule }[] = [
  { value: 'IRS', schedule: 'individual' },
  { value: 'NYS (incl. NYC)', schedule: 'individual' },
  { value: 'NJ', schedule: 'individual' },
  { value: 'PTET NYS', schedule: 'ptet' },
  { value: 'PTET NYC', schedule: 'ptet' },
]

// ---------- dates ----------
const iso = (d: Date) => d.toISOString().slice(0, 10)
const mk = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d))
const nthWeekday = (y: number, m: number, wd: number, n: number) => {
  const first = mk(y, m, 1); const off = (wd - first.getUTCDay() + 7) % 7
  return mk(y, m, 1 + off + 7 * (n - 1))
}
const lastWeekday = (y: number, m: number, wd: number) => {
  const last = mk(y, m + 1, 0); const off = (last.getUTCDay() - wd + 7) % 7
  return mk(y, m, last.getUTCDate() - off)
}
const observed = (d: Date) => {
  const wd = d.getUTCDay()
  return wd === 6 ? mk(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate() - 1)
    : wd === 0 ? mk(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate() + 1) : d
}
const holidayCache = new Map<number, Set<string>>()
// Federal holidays + DC Emancipation Day (moves IRS April deadlines)
export function holidays(y: number) {
  if (holidayCache.has(y)) return holidayCache.get(y)!
  const s = new Set([
    observed(mk(y, 1, 1)), nthWeekday(y, 1, 1, 3), nthWeekday(y, 2, 1, 3), observed(mk(y, 4, 16)),
    lastWeekday(y, 5, 1), observed(mk(y, 6, 19)), observed(mk(y, 7, 4)), nthWeekday(y, 9, 1, 1),
    nthWeekday(y, 10, 1, 2), observed(mk(y, 11, 11)), nthWeekday(y, 11, 4, 4), observed(mk(y, 12, 25)),
  ].map(iso))
  holidayCache.set(y, s)
  return s
}
export function nextBusinessDay(d: string): string {
  let x = new Date(d + 'T00:00:00Z')
  while (x.getUTCDay() === 0 || x.getUTCDay() === 6 || holidays(x.getUTCFullYear()).has(iso(x)))
    x = new Date(x.getTime() + 86_400_000)
  return iso(x)
}

// Official quarterly deadlines (calendar-year filers), already moved to the next business day
export function deadlines(schedule: Schedule, year: number): string[] {
  const raw = schedule === 'individual'
    ? [mk(year, 4, 15), mk(year, 6, 15), mk(year, 9, 15), mk(year + 1, 1, 15)]
    : schedule === 'ptet'
      ? [mk(year, 3, 15), mk(year, 6, 15), mk(year, 9, 15), mk(year, 12, 15)]
      : [mk(year, 4, 15), mk(year, 6, 15), mk(year, 9, 15), mk(year, 12, 15)]
  return raw.map((d) => nextBusinessDay(iso(d)))
}
// Date the full balance would otherwise be paid (return due date)
export const yearEndDue = (schedule: Schedule, year: number) =>
  nextBusinessDay(iso(schedule === 'ptet' ? mk(year + 1, 3, 15) : mk(year + 1, 4, 15)))

// ---------- suggested target ----------
export type TargetInput = {
  department: string; schedule: Schedule; priorTax: number; priorAgi: number; marriedSeparate: boolean
  withholding: number; overpayment: number; currentEstimate: number; ptetElectedLastYear: boolean; ptetStarting: boolean
}
export type Suggestion = { amount: number; basis: string; explain: string; warning?: string }

export function suggestTarget(i: TargetInput): Suggestion {
  const credits = (i.withholding || 0) + (i.overpayment || 0)
  if (i.schedule === 'ptet') {
    if (i.ptetStarting) {
      const amt = Math.max(0, Math.round(1.2 * i.priorTax))
      return { amount: amt, basis: 'ptet_start_120', explain: '120% of last year’s relevant tax, split between PTET and personal estimates.',
        warning: 'Planning suggestion only. Not a safe harbor and does not satisfy the 90%-of-current-year test.' }
    }
    if (i.ptetElectedLastYear) {
      return { amount: Math.max(0, Math.round(i.priorTax - (i.overpayment || 0))), basis: 'ptet_prior_100', explain: '100% of last year’s PTET liability (prior-year safe harbor).' }
    }
    return { amount: Math.max(0, Math.round(0.9 * i.currentEstimate - (i.overpayment || 0))), basis: 'ptet_current_90',
      explain: 'Not elected last year, so the prior-year safe harbor isn’t available: 90% of this year’s expected PTET.',
      warning: i.currentEstimate ? undefined : 'Enter this year’s expected PTET.' }
  }
  if (i.schedule === 'corporation') {
    return { amount: Math.max(0, Math.round(i.priorTax - (i.overpayment || 0))), basis: 'corp_prior_100', explain: '100% of last year’s tax.',
      warning: 'Large corporations ($1M+ taxable income) can use last year’s tax only for the first installment.' }
  }
  if (i.department === 'NJ') {
    return { amount: Math.max(0, Math.round(i.priorTax - credits)), basis: 'nj_prior_100', explain: '100% of last year’s NJ tax, less withholding and overpayment applied.' }
  }
  const limit = i.marriedSeparate ? 75_000 : 150_000
  const high = i.priorAgi > limit
  const pct = high ? 1.1 : 1
  return {
    amount: Math.max(0, Math.round(pct * i.priorTax - credits)),
    basis: high ? 'prior_110' : 'prior_100',
    explain: `${high ? '110' : '100'}% of last year’s tax (${i.department === 'IRS' ? 'AGI' : 'NY AGI'} ${high ? 'over' : 'not over'} $${limit.toLocaleString()}), less withholding and overpayment applied.`,
  }
}

// ---------- schedule ----------
export type PlannedPayment = { seq: number; due_date: string; installment_deadline: string; amount: number }

export function buildSchedule(opts: { schedule: Schedule; year: number; frequency: Frequency; payDay: number; target: number; startMonth?: string }): PlannedPayment[] {
  const dl = deadlines(opts.schedule, opts.year)
  const quarter = opts.target / 4
  let dates: { date: string; deadline: number }[] = []

  if (opts.frequency === 'quarterly') {
    dates = dl.map((d, k) => {
      const [y, m] = d.split('-').map(Number)
      const want = iso(mk(y, m, opts.payDay))
      return { date: nextBusinessDay(want > d ? d : want), deadline: k }
    })
  } else {
    // Monthly: from the start month through the last deadline; each payment counts toward the next deadline
    const firstDl = new Date(dl[0] + 'T00:00:00Z')
    const startDefault = iso(mk(firstDl.getUTCFullYear(), opts.schedule === 'ptet' ? 1 : 1, 1))
    const start = new Date((opts.startMonth ? opts.startMonth + '-01' : startDefault) + 'T00:00:00Z')
    const end = new Date(dl[3] + 'T00:00:00Z')
    for (let y = start.getUTCFullYear(), m = start.getUTCMonth() + 1; mk(y, m, 1) <= end; m === 12 ? (y++, m = 1) : m++) {
      const date = nextBusinessDay(iso(mk(y, m, opts.payDay)))
      const k = dl.findIndex((d) => date <= d)
      if (k >= 0) dates.push({ date, deadline: k })
    }
  }

  // Each deadline needs 25% by its date; a deadline with no payments rolls into the next one
  const out: PlannedPayment[] = []
  let carry = 0
  for (let k = 0; k < 4; k++) {
    const mine = dates.filter((d) => d.deadline === k)
    const need = quarter + carry
    if (!mine.length) { carry = need; continue }
    carry = 0
    const each = Math.floor(need / mine.length)
    mine.forEach((d, i) => out.push({ seq: 0, due_date: d.date, installment_deadline: dl[k], amount: i === mine.length - 1 ? Math.round(need - each * (mine.length - 1)) : each }))
  }
  // Fix rounding so the total equals the target
  const diff = Math.round(opts.target) - out.reduce((s, p) => s + p.amount, 0)
  if (out.length) out[out.length - 1].amount += diff
  return out.map((p, i) => ({ ...p, seq: i + 1 }))
}

// Penalty avoided by paying on schedule instead of everything at the return due date (simple interest, approximate)
export function penaltySavings(payments: { due_date: string; amount: number }[], schedule: Schedule, year: number, ratePct: number) {
  const end = new Date(yearEndDue(schedule, year) + 'T00:00:00Z').getTime()
  return Math.round(payments.reduce((s, p) => {
    const days = Math.max(0, (end - new Date(p.due_date + 'T00:00:00Z').getTime()) / 86_400_000)
    return s + p.amount * (ratePct / 100) * (days / 365)
  }, 0))
}
