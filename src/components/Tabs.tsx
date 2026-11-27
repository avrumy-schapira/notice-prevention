import type { ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'

export function useTab<T extends string>(tabs: readonly T[], param = 'tab'): [T, (t: T) => void] {
  const [params, setParams] = useSearchParams()
  const cur = params.get(param) as T
  const set = (t: T) => { const p = new URLSearchParams(params); p.set(param, t); setParams(p, { replace: true }) }
  return [tabs.includes(cur) ? cur : tabs[0], set]
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string; icon?: ReactNode; count?: number }[]; value: T; onChange: (t: T) => void }) {
  return (
    <div className="mb-6 flex h-11 gap-1 border-b border-zinc-200">
      {tabs.map((t) => (
        <button key={t.id} onClick={() => onChange(t.id)}
          className={`relative flex items-center gap-2 px-3 text-sm font-medium transition-colors [&>svg]:h-4 [&>svg]:w-4 ${value === t.id ? 'text-zinc-900' : 'text-zinc-500 hover:text-zinc-900'}`}>
          {t.icon}{t.label}
          {t.count != null && <span className="text-zinc-400">{t.count}</span>}
          {value === t.id && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-zinc-900" />}
        </button>
      ))}
    </div>
  )
}
