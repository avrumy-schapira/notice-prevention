import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { FILING_SELECT, type Filing } from './types'

export function useFilings(filter?: (q: any) => any) {
  const [filings, setFilings] = useState<Filing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('filings').select(FILING_SELECT)
    if (filter) q = filter(q)
    const { data, error } = await q.order('tax_year', { ascending: false })
    setFilings((data as unknown as Filing[]) ?? [])
    setError(error?.message ?? null)
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { reload() }, [reload])
  return { filings, loading, error, reload }
}
