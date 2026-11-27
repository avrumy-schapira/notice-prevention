import type { ReactNode } from 'react'
import { X } from 'lucide-react'

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-zinc-900/40 p-6 backdrop-blur-[2px]" onMouseDown={onClose}>
      <div className={`mt-10 w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} rounded-2xl bg-white shadow-xl`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <h3 className="text-base font-semibold">{title}</h3>
          <button onClick={onClose} className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900"><X className="h-4 w-4" /></button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

export const Field = ({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) => (
  <label className="block">
    <span className="mb-1.5 block text-xs font-medium text-zinc-600">{label}</span>
    {children}
    {hint && <span className="mt-1 block text-xs text-zinc-400">{hint}</span>}
  </label>
)

export const inputCls = 'w-full rounded-lg border-0 bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-inset ring-zinc-300 placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-900 focus:outline-none'
