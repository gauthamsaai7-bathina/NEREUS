import type { ReactNode } from 'react'
import { AlertTriangle, Inbox } from 'lucide-react'
import type { ConfidenceLevel } from '../types/api'
import { levelColor } from '../utils/format'

export function ConfidenceBadge({ level, value }: { level: ConfidenceLevel; value?: number }) {
  const c = levelColor[level]
  return (
    <span className="chip" style={{ color: c, borderColor: `${c}55`, background: `${c}14` }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
      {value != null ? `${value.toFixed(1)}%` : ''} {level.toUpperCase()}
    </span>
  )
}

export function Tag({ children, tone = 'sonar' }: { children: ReactNode; tone?: 'sonar' | 'signal' | 'haze' | 'coral' | 'kelp' }) {
  const map = { sonar: '#37d5d6', signal: '#f2b84b', haze: '#7f97ad', coral: '#ef6a5b', kelp: '#34d8a0' }
  const c = map[tone]
  return <span className="chip" style={{ color: c, borderColor: `${c}55`, background: `${c}12` }}>{children}</span>
}

export function StatCard({ label, value, hint, loading }: { label: string; value: ReactNode; hint?: string; loading?: boolean }) {
  return (
    <div className="panel px-4 py-3">
      <div className="label">{label}</div>
      {loading ? <div className="skeleton mt-2 h-7 w-20" /> : <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>}
      {hint && <div className="mt-0.5 text-[11px] text-haze">{hint}</div>}
    </div>
  )
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <Inbox size={26} className="text-haze" />
      <div className="text-sm font-medium">{title}</div>
      {body && <p className="max-w-sm text-[13px] text-haze">{body}</p>}
      {action}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-md border border-coral/40 bg-coral/10 px-4 py-3">
      <AlertTriangle size={18} className="mt-0.5 shrink-0 text-coral" />
      <div className="flex-1 text-[13px]">{message}</div>
      {onRetry && <button className="btn h-7 px-2.5" onClick={onRetry}>Retry</button>}
    </div>
  )
}

export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return <div className="space-y-2 p-4">{Array.from({ length: rows }).map((_, i) => <div key={i} className="skeleton h-6 w-full" />)}</div>
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-lg font-semibold tracking-wide">{title}</h1>
        {subtitle && <p className="mt-0.5 text-[13px] text-haze">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">{actions}</div>
    </div>
  )
}

export function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[1500] flex items-center justify-center bg-black/60 p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div className="panel w-full max-w-lg p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">{title}</h2>
          <button className="btn btn-ghost h-7 px-2" onClick={onClose} aria-label="Close">Close</button>
        </div>
        {children}
      </div>
    </div>
  )
}
