import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, Printer } from 'lucide-react'
import { downloadCSV, downloadJSON, getHistory } from '../services/api'
import { useScan } from '../context/ScanContext'
import { useToast } from '../context/ToastContext'
import { ConfidenceBadge, EmptyState, PageHeader, StatCard, Tag } from '../components/ui'
import type { HistoryItem } from '../types/api'
import { fmtCoord, fmtDate, fmtMs } from '../utils/format'

export default function Reports() {
  const { scan, loadScan } = useScan()
  const { toast } = useToast()
  const [history, setHistory] = useState<HistoryItem[]>([])
  useEffect(() => { getHistory({}).then(h => setHistory(h.filter(x => x.status === 'completed'))).catch(() => setHistory([])) }, [scan])

  const dl = async (kind: 'json' | 'csv') => {
    if (!scan) return
    try { await (kind === 'json' ? downloadJSON : downloadCSV)(scan.scan_id); toast('success', `${kind.toUpperCase()} report downloaded.`) }
    catch (e) { toast('error', (e as Error).message) }
  }
  const pick = async (id: string) => { try { await loadScan(id) } catch (e) { toast('error', (e as Error).message) } }

  const picker = (
    <select className="input w-64 no-print" value={scan?.scan_id ?? ''} onChange={e => e.target.value && pick(e.target.value)} aria-label="Select scan">
      <option value="">Select a scan...</option>{history.map(h => <option key={h.scan_id} value={h.scan_id}>{h.scan_id} · {h.filename}</option>)}
    </select>
  )

  if (!scan) return (
    <div><PageHeader title="Reports" actions={history.length ? picker : undefined} />
      <div className="panel"><EmptyState title="No scan selected" body="Analyse an image or choose a stored scan to build its report."
        action={<Link to="/analysis" className="btn btn-primary mt-1">Go to Sonar Analysis</Link>} /></div></div>
  )
  const s = scan.summary
  const confs = scan.detections.map(d => d.confidence)
  const min = confs.length ? Math.min(...confs) : null, max = confs.length ? Math.max(...confs) : null

  return (
    <div className="print-area">
      <div className="no-print"><PageHeader title="Reports" subtitle="Summary, statistics and downloadable exports for the selected scan."
        actions={<>{picker}<button className="btn" onClick={() => dl('json')}><Download size={14} />Download JSON</button><button className="btn" onClick={() => dl('csv')}><Download size={14} />Download CSV</button>
          <button className="btn" onClick={() => window.print()}><Printer size={14} />Print report</button></>} /></div>
      <div className="hidden print:block"><h1 className="text-xl font-bold">NEREUS Anomaly Report</h1><p className="text-sm">Intelligent Sonar. Safer Seas.</p></div>

      <div className="panel mb-4 p-4">
        <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-sonar">{scan.scan_id}</span><Tag tone="signal">{scan.processing_mode_label}</Tag>
          {s.coordinate_source === 'demo' && <Tag tone="signal">DEMO COORDINATES</Tag>}{scan.metadata?.data_source === 'demo' && <Tag tone="signal">SYNTHETIC DEMO DATA</Tag>}</div>
        <dl className="mt-3 grid gap-x-8 gap-y-1.5 text-[13px] sm:grid-cols-2 lg:grid-cols-4">
          <div><dt className="label">Image</dt><dd>{scan.image.filename}</dd></div><div><dt className="label">Timestamp</dt><dd>{fmtDate(scan.timestamp)}</dd></div>
          <div><dt className="label">Resolution</dt><dd>{scan.image.width} x {scan.image.height} px ({scan.image.format})</dd></div><div><dt className="label">Processing time</dt><dd>{fmtMs(scan.processing_time_ms)}</dd></div>
          {scan.metadata?.survey_id && <div><dt className="label">Survey</dt><dd>{scan.metadata.survey_id}</dd></div>}{scan.metadata?.vehicle_id && <div><dt className="label">Vehicle</dt><dd>{scan.metadata.vehicle_id}</dd></div>}
        </dl>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Detections" value={s.count} /><StatCard label="High confidence" value={s.high} /><StatCard label="Medium / Low" value={`${s.medium} / ${s.low}`} />
        <StatCard label="Mean confidence" value={s.mean_confidence != null ? `${s.mean_confidence}%` : '-'} hint={min != null ? `range ${min.toFixed(1)}-${max!.toFixed(1)}` : undefined} />
        <StatCard label="Marine debris" value={s.marine_debris} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="panel p-4"><div className="panel-title mb-2">Classification breakdown</div>
          {Object.keys(s.by_class).length === 0 ? <p className="text-[13px] text-haze">No detections.</p> : Object.entries(s.by_class).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
            <div key={k} className="grid grid-cols-[150px_1fr_28px] items-center gap-2 py-1 text-[13px]"><span>{k}</span><div className="h-1.5 rounded bg-shelf"><div className="h-full rounded bg-sonar" style={{ width: `${(v / s.count) * 100}%` }} /></div><span className="text-right tabular-nums">{v}</span></div>))}</div>
        <div className="panel p-4"><div className="panel-title mb-2">Pipeline summary</div>
          <p className="text-[13px] text-haze">{scan.pipeline.candidates_found} candidate regions found; {scan.pipeline.filtered_out} removed by noise filtering:</p>
          <ul className="mt-2 space-y-1 text-[12px]">{Object.entries(scan.pipeline.filter_reasons).map(([k, v]) => <li key={k} className="flex justify-between gap-3"><span>{k}</span><span className="tabular-nums">{v}</span></li>)}
            {Object.keys(scan.pipeline.filter_reasons).length === 0 && <li className="text-haze">Nothing was filtered.</li>}</ul>
          <div className="mt-3 flex flex-wrap gap-1.5">{scan.pipeline.stages.map(st => <span key={st.key} className="chip border-line text-haze">{st.label.toLowerCase()} {st.duration_ms} ms</span>)}</div></div>
      </div>

      <div className="panel mt-4"><div className="border-b border-line px-4 py-3 panel-title">Detections and coordinates</div>
        <div className="overflow-auto"><table className="w-full min-w-[760px]"><thead><tr><th className="th">ID</th><th className="th">Class</th><th className="th">Confidence</th><th className="th">Latitude / Longitude</th><th className="th">Est. size</th><th className="th">Box (x, y, w, h)</th></tr></thead>
          <tbody>{scan.detections.map(d => (<tr key={d.id}><td className="td font-mono">{d.id}</td><td className="td">{d.class}</td><td className="td"><ConfidenceBadge level={d.confidence_level} value={d.confidence} /></td>
            <td className="td font-mono text-[12px]">{fmtCoord(d.location.latitude, d.location.longitude)}{d.location.source === 'demo' ? '  (demo)' : ''}</td>
            <td className="td">{d.estimated_dimensions.length_m} x {d.estimated_dimensions.width_m} m</td><td className="td font-mono text-[12px]">{d.bbox.x}, {d.bbox.y}, {d.bbox.width}, {d.bbox.height}</td></tr>))}</tbody></table></div>
        <p className="border-t border-line px-4 py-3 text-[11px] text-haze">{scan.disclaimer}{scan.detections[0]?.estimated_dimensions.scale_source === 'assumed' ? ' Sizes use an assumed pixel scale because no metadata scale was provided.' : ''}</p>
      </div>
    </div>
  )
}
