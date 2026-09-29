import { RefreshCw } from 'lucide-react'
import { useHealth } from '../hooks'
import { ErrorState, PageHeader, SkeletonRows, StatCard, Tag } from '../components/ui'
import { fmtDate, fmtMs } from '../utils/format'

const tone = { ok: 'kelp', degraded: 'signal', error: 'coral' } as const

export default function SystemHealth() {
  const { health, error, latencyMs, loading, refresh } = useHealth(5000)
  return (
    <div>
      <PageHeader title="System Health" subtitle="Reads the live /api/health endpoint every 5 seconds."
        actions={<button className="btn" onClick={refresh}><RefreshCw size={14} />Refresh</button>} />
      {loading ? <div className="panel"><SkeletonRows /></div> : error || !health ? <ErrorState message={error ?? 'Backend unavailable.'} onRetry={refresh} /> : (
        <>
          {health.warnings.map(w => <div key={w} className="mb-3 rounded border border-signal/40 bg-signal/10 px-3 py-2 text-[13px]">{w}</div>)}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Overall status" value={health.status.toUpperCase()} hint={`mode ${health.mode} · v${health.version}`} />
            <StatCard label="API round-trip" value={latencyMs != null ? `${latencyMs} ms` : '-'} />
            <StatCard label="Avg processing time" value={fmtMs(health.avg_processing_time_ms)} />
            <StatCard label="Scans stored" value={health.total_scans} hint={health.last_scan ? `last: ${health.last_scan.scan_id}` : 'no scans yet'} />
          </div>
          <div className="panel mt-4"><div className="border-b border-line px-4 py-3 panel-title">Components</div>
            {health.components.map(c => (
              <div key={c.name} className="flex items-center justify-between gap-4 border-b border-line/60 px-4 py-3 last:border-0">
                <div><div className="text-[13px] font-medium">{c.name}</div><div className="text-[12px] text-haze">{c.detail}</div></div>
                <Tag tone={tone[c.status]}>{c.status.toUpperCase()}</Tag>
              </div>))}
          </div>
          <div className="panel mt-4 p-4 text-[13px]"><div className="panel-title mb-2">Last processed scan</div>
            {health.last_scan ? <div className="grid gap-1 sm:grid-cols-3"><div><span className="label">Scan</span><div className="font-mono">{health.last_scan.scan_id}</div></div><div><span className="label">Image</span><div>{health.last_scan.filename}</div></div><div><span className="label">Processed</span><div>{fmtDate(health.last_scan.created_at)}</div></div></div> : <span className="text-haze">No scan has been processed yet.</span>}</div>
        </>
      )}
    </div>
  )
}
