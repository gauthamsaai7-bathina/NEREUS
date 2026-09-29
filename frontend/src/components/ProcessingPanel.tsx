import { useEffect, useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import type { ScanStatus } from '../types/api'

// Mirrors backend/app/services/jobs.py STAGES. The active stage always comes from the backend status endpoint.
export const STAGES = [
  { key: 'ingest', label: 'INGESTING SONAR DATA' },
  { key: 'preprocess', label: 'PREPROCESSING' },
  { key: 'inference', label: 'RUNNING INFERENCE' },
  { key: 'filter', label: 'FILTERING ANOMALIES' },
  { key: 'geotag', label: 'GENERATING GEO DATA' },
  { key: 'complete', label: 'ANALYSIS COMPLETE' },
]

export default function ProcessingPanel({ status, filename }: { status: ScanStatus | null; filename: string }) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const t0 = performance.now()
    const id = setInterval(() => setElapsed(performance.now() - t0), 100)
    return () => clearInterval(id)
  }, [])
  const idx = status?.stage_index ?? 0
  const progress = status?.progress ?? 0
  return (
    <div className="absolute inset-0 z-10 grid place-items-center bg-abyss/85 backdrop-blur-sm" role="status" aria-live="polite">
      <div className="panel w-[420px] max-w-[90%] p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="panel-title">Analysing {filename}</div>
          <span className="font-mono text-[12px] text-haze">{(elapsed / 1000).toFixed(1)} s</span>
        </div>
        <ol className="mt-4 space-y-2.5">
          {STAGES.map((s, i) => {
            const done = i < idx || status?.status === 'completed'
            const active = i === idx && status?.status !== 'completed'
            return (
              <li key={s.key} className={`flex items-center gap-3 text-[13px] ${done ? 'text-mist' : active ? 'text-sonar' : 'text-haze/60'}`}>
                <span className={`grid h-5 w-5 place-items-center rounded-full border ${done ? 'border-kelp bg-kelp/15 text-kelp' : active ? 'border-sonar' : 'border-line'}`}>
                  {done ? <Check size={12} /> : active ? <Loader2 size={12} className="animate-spin" /> : null}
                </span>
                <span className="tracking-wide">{s.label}</span>
              </li>
            )
          })}
        </ol>
        <div className="mt-4 h-1.5 overflow-hidden rounded bg-shelf"><div className="h-full bg-sonar transition-all duration-300" style={{ width: `${Math.max(6, progress)}%` }} /></div>
        <p className="mt-3 min-h-[18px] text-[12px] text-haze">{status?.message ?? 'Uploading image to the analysis backend...'}</p>
      </div>
    </div>
  )
}
