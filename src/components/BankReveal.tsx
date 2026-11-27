import { useEffect, useState } from 'react'
import { Copy, Eye, EyeOff } from 'lucide-react'
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
    <span className="inline-flex items-center gap-1.5">
      {label && <span className="text-zinc-400">{label}</span>}
      <span className="font-mono tabular-nums">{full ?? (last4 ? `•••• ${last4}` : '•••••••••')}</span>
      <button onClick={reveal} title={full ? 'Hide' : 'Reveal'} className="rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900">
        {full ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
      <button onClick={copy} title="Copy" className="rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900">
        <Copy className="h-3.5 w-3.5" />
      </button>
      {copied && <span className="text-xs text-emerald-600">Copied</span>}
    </span>
  )
}
