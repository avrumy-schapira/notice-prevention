import { useEffect, useState } from 'react'
import { Check, Copy, Eye, EyeOff } from 'lucide-react'
import { supabase } from '../lib/supabase'

// Shows •••• last4; Reveal / Copy fetch the full number (every reveal is logged)
export function BankReveal({ kind, id, field, last4, label }: { kind: 'bank_account' | 'payment_line'; id: string; field: string; last4?: string | null; label?: string }) {
  const [full, setFull] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  useEffect(() => { if (!full) return; const t = setTimeout(() => setFull(null), 30_000); return () => clearTimeout(t) }, [full])

  const get = async () => {
    const { data, error } = await supabase.rpc('reveal_bank', { p_kind: kind, p_id: id, p_field: field })
    if (error) { alert(error.message); return null }
    return data as string | null
  }
  const reveal = async () => setFull(full ? null : await get())
  const copy = async () => {
    const v = full ?? await get()
    if (!v) return
    await navigator.clipboard.writeText(v)
    setCopied(true); setTimeout(() => setCopied(false), 1500)
  }

  return (
    <span className="inline-flex h-6 items-center gap-1">
      {label && <span className="w-14 text-zinc-400">{label}</span>}
      <span className="w-32 truncate font-mono tabular-nums">{full ?? (last4 ? `•••• ${last4}` : '•••••••••')}</span>
      <button onClick={reveal} title={full ? 'Hide' : 'Reveal'} className="flex h-6 w-6 items-center justify-center rounded text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900">
        {full ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
      <button onClick={copy} title="Copy" className="flex h-6 w-6 items-center justify-center rounded text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900">
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </span>
  )
}
