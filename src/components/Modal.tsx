import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { control } from './ui'

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-zinc-900/30 p-6" onMouseDown={onClose}>
      <div className={`my-12 w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} rounded-xl border border-zinc-200 bg-white shadow-xl`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex h-14 items-center justify-between border-b border-zinc-200 px-6">
          <h3 className="text-base font-semibold">{title}</h3>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

export const Field = ({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) => (
  <label className="block min-w-0">
    <span className="mb-1.5 block text-sm font-medium text-zinc-700">{label}</span>
    {children}
    {hint && <span className="mt-1 block text-xs text-zinc-500">{hint}</span>}
  </label>
)

export const inputCls = `${control} w-full`
