import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowDown, ArrowUp, Search } from 'lucide-react'
import { getHistory } from '../services/api'
import type { HistoryItem } from '../types/api'
import { EmptyState, ErrorState, PageHeader, SkeletonRows, Tag } from '../components/ui'
import { useScan } from '../context/ScanContext'
import { useToast } from '../context/ToastContext'
import { fmtDate, fmtMs } from '../utils/format'

const COLS: { key: string; label: string }[] = [
  { key: 'id', label: 'Scan ID' }, { key: 'date', label: 'Date' }, { key: 'name', label: 'Image' },
  { key: 'detections', label: 'Detections' }, { key: 'high', label: 'High confidence' }, { key: 'time', label: 'Processing time' },
]

export default function History() {
  const [items, setItems] = useState<HistoryItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('date')
  const [order, setOrder] = useState<'asc' | 'desc'>('desc')
  const [status, setStatus] = useState('all')
  const { loadScan } = useScan()
  const { toast } = useToast()
  const nav = useNavigate()

  useEffect(() => {
    const t = setTimeout(() => { getHistory({ search, sort, order }).then(r => { setItems(r); setError(null) }).catch(e => setError(e.message)) }, 200)
    return () => clearTimeout(t)
  }, [search, sort, order])

  const open = async (id: string) => {
    try { await loadScan(id); nav('/analysis') } catch (e) { toast('error', (e as Error).message) }
  }
  const toggle = (k: string) => { if (sort === k) setOrder(o => o === 'asc' ? 'desc' : 'asc'); else { setSort(k); setOrder('desc') } }
  const rows = (items ?? []).filter(i => status === 'all' || i.status === status)

  return (
    <div>
      <PageHeader title="Detection History" subtitle="All scans stored by the backend (SQLite)." />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative w-72 max-w-full"><Search size={14} className="absolute left-3 top-2.5 text-haze" />
          <input className="input pl-9" placeholder="Search scan ID or image name" value={search} onChange={e => setSearch(e.target.value)} aria-label="Search history" /></div>
        <select className="input w-40" value={status} onChange={e => setStatus(e.target.value)} aria-label="Filter by status">
          <option value="all">All statuses</option><option value="completed">Completed</option><option value="failed">Failed</option><option value="processing">Processing</option></select>
      </div>
      <div className="panel">
        {error ? <div className="p-4"><ErrorState message={error} /></div> : !items ? <SkeletonRows /> : rows.length === 0 ? (
          <EmptyState title={items.length ? 'No scans match your filters' : 'No scans yet'} body={items.length ? 'Clear the search or status filter.' : 'Scans appear here after you analyse an image.'} />
        ) : (
          <div className="overflow-auto"><table className="w-full min-w-[820px]"><thead><tr>
            {COLS.map(c => <th key={c.key} className="th"><button className="inline-flex items-center gap-1 hover:text-mist" onClick={() => toggle(c.key)}>{c.label}{sort === c.key && (order === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}</button></th>)}
            <th className="th">Status</th><th className="th" /></tr></thead>
            <tbody>{rows.map(r => (
              <tr key={r.scan_id} className="hover:bg-shelf">
                <td className="td font-mono text-sonar">{r.scan_id}</td><td className="td text-haze">{fmtDate(r.timestamp)}</td><td className="td max-w-[220px] truncate">{r.filename}</td>
                <td className="td tabular-nums">{r.detection_count}</td><td className="td tabular-nums">{r.high_confidence}</td><td className="td tabular-nums">{fmtMs(r.processing_time_ms)}</td>
                <td className="td"><Tag tone={r.status === 'completed' ? 'kelp' : r.status === 'failed' ? 'coral' : 'signal'}>{r.status}</Tag></td>
                <td className="td text-right"><button className="btn h-7 px-2.5" disabled={r.status !== 'completed'} onClick={() => open(r.scan_id)}>Open scan</button></td>
              </tr>))}</tbody></table></div>
        )}
      </div>
    </div>
  )
}
