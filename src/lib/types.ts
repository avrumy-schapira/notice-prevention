export type Role = 'admin' | 'manager' | 'staff'

export type Profile = { id: string; email: string; full_name: string | null; role: Role }

export type FilingStatus =
  | 'not_started'
  | 'pulled_flags_open'
  | 'ready_to_email'
  | 'emailed_waiting'
  | 'client_confirmed'
  | 'client_modified_ach'
  | 'client_modified_method'
  | 'filed'

export const STATUS_LABEL: Record<FilingStatus, string> = {
  not_started: 'Not started',
  pulled_flags_open: 'Pulled, flags open',
  ready_to_email: 'Ready to email',
  emailed_waiting: 'Emailed, waiting on client',
  client_confirmed: 'Client confirmed',
  client_modified_ach: 'Client modified ACH',
  client_modified_method: 'Client modified method',
  filed: 'Filed',
}

export type Entity = {
  id: string
  name: string
  client_id: string | null
  return_type: string | null
  assigned_preparer: string | null
  karbon_url: string | null
  client_groups: { name: string } | null
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
  response: 'waiting' | 'confirmed' | 'modified'
  new_method: string | null
  new_last4: string | null
  entered_in_ultratax_at: string | null
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
  filed_at: string | null
  entities: Entity
  payment_lines: PaymentLine[]
}

export const FILING_SELECT =
  'id, tax_year, stage, status, last_pull_at, email_sent_at, client_responded_at, filed_at, ' +
  'entities(id, name, client_id, return_type, assigned_preparer, karbon_url, client_groups(name)), ' +
  'payment_lines(*)'
