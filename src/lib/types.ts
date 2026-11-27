export type Role = 'admin' | 'manager' | 'staff'
export type Profile = { id: string; email: string; full_name: string | null; role: Role }

export type FilingStatus =
  | 'not_started' | 'pulled_flags_open' | 'ready_to_email' | 'emailed_waiting'
  | 'client_confirmed' | 'client_modified_ach' | 'client_modified_method' | 'filed'

export const STATUS_LABEL: Record<FilingStatus, string> = {
  not_started: 'Not started',
  pulled_flags_open: 'Flags open',
  ready_to_email: 'Ready to email',
  emailed_waiting: 'Waiting on client',
  client_confirmed: 'Client confirmed',
  client_modified_ach: 'Client changed bank',
  client_modified_method: 'Client changed method',
  filed: 'Filed',
}

export type Entity = {
  id: string
  name: string
  client_id: string | null
  return_type: string | null
  assigned_preparer: string | null
  karbon_url: string | null
  karbon_status?: string | null
  client_group_id?: string | null
  client_groups: { id?: string; name: string } | null
}

export type PaymentLine = {
  id: string
  filing_id: string
  department: string
  tax_type: string
  owner: string | null
  direction: 'due' | 'refund' | null
  amount: number | null
  method: string | null
  payment_date: string | null
  bank_last4: string | null
  bank_type: string | null
  response: 'waiting' | 'confirmed' | 'modified'
  new_method: string | null
  new_last4: string | null
  responded_at: string | null
  entered_in_ultratax_at: string | null
  reminder_sent_at: string | null
  confirmation_sent_at: string | null
  client_paid_response: 'paid' | 'not_paid' | null
  manual_payment_needed: boolean
  payment_status: 'pending' | 'verified' | 'manual_paid'
}

export type Filing = {
  id: string
  tax_year: number
  stage: 'extension' | 'return'
  status: FilingStatus
  last_pull_at: string | null
  email_sent_at: string | null
  client_responded_at: string | null
  final_pull_at: string | null
  filed_at: string | null
  diagnostics?: string | null
  entities: Entity
  payment_lines: PaymentLine[]
}

export const FILING_SELECT =
  'id, tax_year, stage, status, last_pull_at, email_sent_at, client_responded_at, final_pull_at, filed_at, diagnostics, ' +
  'entities(id, name, client_id, return_type, assigned_preparer, karbon_url, client_group_id, client_groups(id, name)), ' +
  'payment_lines(*)'

export const yearPath = (f: Pick<Filing, 'tax_year' | 'stage'> & { entities: { id: string } }) =>
  `/entity/${f.entities.id}/${f.tax_year}?stage=${f.stage}`
