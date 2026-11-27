export const money = (n: number | null | undefined) =>
  n == null ? '—' : n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

export const date = (d: string | null | undefined) =>
  d ? new Date(d.length === 10 ? d + 'T00:00:00' : d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

export const dateTime = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'

export const daysSince = (d: string | null | undefined) =>
  d ? Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000) : null

export const METHOD_LABEL: Record<string, string> = {
  efw: 'Direct debit', eft: 'EFT', online: 'Online', voucher: 'Voucher', check: 'Check', credit_card: 'Credit card', none: 'None',
}
export const method = (m: string | null | undefined) => (m ? METHOD_LABEL[m] ?? m : '—')

export const person = (email: string | null | undefined) => {
  if (!email) return '—'
  if (!email.includes('@')) return email
  const n = email.split('@')[0]
  return n.charAt(0).toUpperCase() + n.slice(1)
}
