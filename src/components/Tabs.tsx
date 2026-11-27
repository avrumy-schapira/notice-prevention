import type { ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'

export function useTab<T extends string>(tabs: readonly T[], param = 'tab'): [T, (t: T) => void] {
  const [params, setParams] = useSearchParams()
  const cur = (params.get(param) as T) ?? tabs[0]
  const set = (t: T) => { const p = new URLSearchParams(params); p.set(param, t); setParams(p, { replace: true }) }
  return [tabs.includes(cur) ? cur : tabs[0], set]
}

export function Tabs<T extends string>({ tabs, value, onChange, counts }: { tabs: { id: T; label: string; icon?: ReactNode }[]; value: T; onChange: (t: T) => void; counts?: Partial<Record<T, number>> }) {
  return (
    <div className="mb-6 flex gap-6 border-b border-zinc-200">
      {tabs.map((t) => (
        <button key={t.id} onClick={() => onChange(t.id)}
          className={`relative flex items-center gap-2 px-0.5 pb-3 text-sm font-medium transition ${value === t.id ? 'text-zinc-900' : 'text-zinc-500 hover:text-zinc-800'}`}>
          {t.icon}{t.label}
          {counts?.[t.id] != null && <span className={`rounded-full px-1.5 text-[11px] ${value === t.id ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600'}`}>{counts[t.id]}</span>}
          {value === t.id && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-zinc-900" />}
        </button>
      ))}
    </div>
  )
}
