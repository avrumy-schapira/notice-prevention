import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Button, Card, PageHeader } from '../components/ui'
import { Field, inputCls } from '../components/Modal'

type S = { key: string; value: string; note: string | null }

export function Settings() {
  const [rows, setRows] = useState<S[]>([])
  const [saved, setSaved] = useState(false)
  useEffect(() => { supabase.from('app_settings').select('*').order('key').then(({ data }) => setRows((data as S[]) ?? [])) }, [])
  const save = async () => {
    for (const r of rows) await supabase.from('app_settings').update({ value: r.value }).eq('key', r.key)
    setSaved(true); setTimeout(() => setSaved(false), 2000)
  }
  return (
    <>
      <PageHeader title="Settings" />
      <Card className="max-w-xl space-y-5 p-6">
        {rows.map((r, i) => (
          <Field key={r.key} label={r.key.replaceAll('_', ' ')} hint={r.note}>
            <input className={inputCls} value={r.value} onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, value: e.target.value } : x))} />
          </Field>
        ))}
        <div className="flex items-center gap-3"><Button variant="primary" onClick={save}>Save</Button>{saved && <span className="text-sm text-emerald-600">Saved</span>}</div>
      </Card>
    </>
  )
}
