import { supabase } from './supabase'

export async function syncKarbon(): Promise<string> {
  const { data, error } = await supabase.functions.invoke('karbon-sync', { body: {} })
  if (error) {
    const detail = await (error as { context?: Response }).context?.json?.().catch(() => null)
    throw new Error(detail?.error ?? error.message)
  }
  return `Synced ${data.groups} client groups and ${data.entities} entities from Karbon.`
}

export async function lastSync(): Promise<string | null> {
  const { data } = await supabase.from('client_groups').select('last_synced_at').not('last_synced_at', 'is', null)
    .order('last_synced_at', { ascending: false }).limit(1)
  return data?.[0]?.last_synced_at ?? null
}
