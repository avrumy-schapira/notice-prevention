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

  try {
    const started = Date.now()
    const [groups, contacts, orgs] = await Promise.all([kall('/ClientGroups'), kall('/Contacts'), kall('/Organizations')])
    const full = await pool(groups, 8, (g: any) => kget('/ClientGroups/' + g.ClientGroupKey))

    const now = new Date().toISOString()
    const { error: ge } = await db.from('client_groups').upsert(
      full.map((g: any) => ({ karbon_key: g.ClientGroupKey, name: g.FullName ?? '(no name)', last_synced_at: now })),
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
          last_synced_at: now,
        }
      })
    const seen = new Set<string>()
    for (const r of rows) if (r.client_id) { if (seen.has(r.client_id)) r.client_id = null; else seen.add(r.client_id) }
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await db.from('entities').upsert(rows.slice(i, i + 500), { onConflict: 'karbon_key' })
      if (error) throw error
    }
    const result = { groups: full.length, entities: rows.length, seconds: Math.round((Date.now() - started) / 1000) }
    await db.from('activity_log').insert({ action: 'karbon_sync', details: result })
    return json({ ok: true, ...result })
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500)
  }
})
