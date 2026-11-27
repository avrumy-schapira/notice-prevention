// Karbon -> Supabase: client groups + their entities.
// Run by the "Sync now" button (admin / manager).
import { createClient } from 'npm:@supabase/supabase-js@2'

const KB = 'https://api.karbonhq.com/v3'
const H = {
  Authorization: 'Bearer ' + Deno.env.get('KARBON_BEARER_TOKEN'),
  AccessKey: Deno.env.get('KARBON_ACCESS_KEY') ?? '',
  Accept: 'application/json',
}
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

async function kget(url: string): Promise<any> {
  for (let attempt = 0; ; attempt++) {
    const r = await fetch(url.startsWith('http') ? url : KB + url, { headers: H })
    if (r.status === 429 && attempt < 5) { await new Promise((s) => setTimeout(s, 1500 * (attempt + 1))); continue }
    if (!r.ok) throw new Error('Karbon ' + url + ' -> ' + r.status + ' ' + (await r.text()).slice(0, 200))
    return r.json()
  }
}
async function kall(path: string) {
  const out: any[] = []
  let url: string | null = KB + path
  while (url) { const j = await kget(url); out.push(...(j.value ?? [])); url = j['@odata.nextLink'] ?? null }
  return out
}
async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>) {
  const res: R[] = []; let i = 0
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; res[k] = await fn(items[k]) } }))
  return res
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const URL = Deno.env.get('SUPABASE_URL')!
  const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const db = createClient(URL, SERVICE)

  // Only admin / manager
  const auth = req.headers.get('Authorization') ?? ''
  const asUser = createClient(URL, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } })
  const { data: role } = await asUser.rpc('my_role')
  if (!['admin', 'manager'].includes(role)) return json({ error: 'Only admin or manager can sync' }, 403)

  const body = await req.json().catch(() => ({}))
  try {
    // Read-only look at a Karbon list (used to map fields)
    if (typeof body.probePath === 'string' && /^\/(WorkItems|Users|WorkTypes|TenantSettings)/.test(body.probePath)) return json(await kget(body.probePath))

    const started = Date.now()
    const [groups, contacts, orgs] = await Promise.all([kall('/ClientGroups'), kall('/Contacts'), kall('/Organizations')])
    const full = await pool(groups, 8, (g: any) => kget('/ClientGroups/' + g.ClientGroupKey))

    const now = new Date().toISOString()
    const { error: ge } = await db.from('client_groups').upsert(
      full.map((g: any) => ({ karbon_key: g.ClientGroupKey, name: g.FullName ?? '(no name)', karbon_status: g.ContactType ?? null, last_synced_at: now })),
      { onConflict: 'karbon_key' })
    if (ge) throw ge
    const { data: gIds } = await db.from('client_groups').select('id, karbon_key')
    const gId = new Map((gIds ?? []).map((r) => [r.karbon_key, r.id]))

    const memberOf = new Map<string, any>() // entity key -> full group
    for (const g of full) for (const m of g.Members ?? []) { const k = m.ContactKey ?? m.OrganizationKey; if (k) memberOf.set(k, g) }

    const all = [
      ...contacts.map((c: any) => ({ k: c.ContactKey, x: c })),
      ...orgs.map((o: any) => ({ k: o.OrganizationKey, x: o })),
    ]
    const rows = all
      .filter(({ k, x }) => memberOf.has(k) || (x.UserDefinedIdentifier && x.ContactType !== 'Inactive'))
      .map(({ k, x }) => {
        const g = memberOf.get(k)
        return {
          karbon_key: k,
          name: x.FullName ?? '(no name)',
          client_id: x.UserDefinedIdentifier || null,
          client_group_id: g ? gId.get(g.ClientGroupKey) ?? null : null,
          assigned_preparer: x.ClientManager ?? x.ClientOwner ?? g?.ClientManager ?? g?.ClientOwner ?? null,
          karbon_status: x.ContactType ?? null,
          email: x.EmailAddress ?? null,
          phone: x.PhoneNumber ?? null,
          last_synced_at: now,
        }
      })
    const seen = new Set<string>()
    for (const r of rows) if (r.client_id) { if (seen.has(r.client_id)) r.client_id = null; else seen.add(r.client_id) }
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await db.from('entities').upsert(rows.slice(i, i + 500), { onConflict: 'karbon_key' })
      if (error) throw error
    }
    // Work list: tax work items enter at "Send Return to Client" / "Ext - Send to Client" (or a later filing step)
    // and stay until Completed in Karbon. Extension vs return comes from the Karbon status.
    const EXT = ['Ext - Send to Client', 'Send Ext to Client', 'Ext-Waiting for Signature', 'Extension- Awaiting Sig.', 'Extension - Ready to File', 'File Extension', 'Ext - Waiting for IRS', 'Ext-Waiting for Conf', 'Ext - Rejected']
    const RTN = ['Send Return to Client', 'Send Rtn to Client', 'Rtn - Waiting for Sig', 'Waiting for Client Sig', 'Obtain Return Filing Auth', 'Send Docusign', 'File Return', 'Rtn- Waiting for IRS', 'Send Confirmation', 'Send Conf to client', 'Waiting for confirmation']
    const items = (await kall("/WorkItems?$filter=contains(WorkType,'Tax:')")).filter((w: any) => !/amended|ptet/i.test((w.WorkTemplateTile ?? '') + ' ' + (w.Title ?? '')))
    const { data: prev } = await db.from('karbon_work_items').select('karbon_key, stage, first_seen_at')
    const prevMap = new Map((prev ?? []).map((r) => [r.karbon_key, r]))
    const eIds: any[] = []
    for (let f = 0; ; f += 1000) { const { data } = await db.from('entities').select('id, karbon_key, return_type').range(f, f + 999); eIds.push(...(data ?? [])); if (!data || data.length < 1000) break }
    const eMap = new Map((eIds ?? []).map((r) => [r.karbon_key, r]))
    const rt = (t: string) => /1120S|S-Corp/i.test(t) ? '1120-S' : /1120/.test(t) ? '1120' : /1065/.test(t) ? '1065' : /1041/.test(t) ? '1041' : /990/.test(t) ? '990' : /1040/.test(t) ? '1040' : null
    // Enters only at the send-to-client step; after that it stays until Completed
    const START = ['Send Return to Client', 'Send Rtn to Client', 'Ext - Send to Client', 'Send Ext to Client']
    const keep = items.filter((w: any) => w.PrimaryStatus !== 'Completed' && (START.includes(w.SecondaryStatus) || prevMap.has(w.WorkItemKey)))
    const wRows = keep.map((w: any) => {
      const years = (w.Title ?? '').match(/20\d\d/g)
      const p = prevMap.get(w.WorkItemKey)
      return {
        karbon_key: w.WorkItemKey, entity_id: eMap.get(w.ClientKey)?.id ?? null, title: w.Title, work_type: w.WorkType,
        tax_year: years ? Number(years[years.length - 1]) : null, return_type: rt(w.WorkType ?? ''),
        stage: EXT.includes(w.SecondaryStatus) ? 'extension' : RTN.includes(w.SecondaryStatus) ? 'return' : (p?.stage ?? 'return'),
        primary_status: w.PrimaryStatus, secondary_status: w.SecondaryStatus,
        due_date: w.DueDate ? String(w.DueDate).slice(0, 10) : null, assignee_email: w.AssigneeEmailAddress,
        first_seen_at: p?.first_seen_at ?? now, synced_at: now,
      }
    })
    await db.from('karbon_work_items').delete().neq('karbon_key', '')
    if (wRows.length) { const { error } = await db.from('karbon_work_items').insert(wRows); if (error) throw error }
    for (const w of wRows) {
      const e = w.entity_id ? [...eMap.values()].find((x) => x.id === w.entity_id) : null
      if (e && !e.return_type && w.return_type) await db.from('entities').update({ return_type: w.return_type }).eq('id', w.entity_id)
    }
    const work = wRows.length

    const result = { groups: full.length, entities: rows.length, work, seconds: Math.round((Date.now() - started) / 1000) }
    await db.from('activity_log').insert({ action: 'karbon_sync', details: result })
    return json({ ok: true, ...result })
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500)
  }
})
