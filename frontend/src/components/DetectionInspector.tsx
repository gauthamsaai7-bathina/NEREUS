import { Info } from 'lucide-react'
import type { Detection, ScanResult } from '../types/api'
import { fmtCoord, fmtDate } from '../utils/format'
import { ConfidenceBadge, Tag } from './ui'

const FACTOR_LABELS: Record<string, string> = { contrast: 'Return strength', shadow: 'Acoustic shadow', size: 'Size plausibility', structure: 'Structure', shape: 'Shape regularity' }

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return <div className="flex items-start justify-between gap-3 border-b border-line/60 py-2 text-[13px]"><span className="label pt-0.5">{k}</span><span className="text-right">{children}</span></div>
}

export default function DetectionInspector({ scan, detection }: { scan: ScanResult | null; detection: Detection | null }) {
  if (!detection) {
    return (
      <div className="panel h-full p-4">
        <div className="panel-title">Detection Inspector</div>
        <div className="mt-6 flex flex-col items-center gap-2 text-center text-[13px] text-haze">
          <Info size={22} />
          {scan ? (scan.detections.length ? 'Select a bounding box on the image or a row in the table to inspect it.' : 'No anomalies were retained for this scan.') : 'Upload or load a sonar image and run the analysis to inspect detections.'}
        </div>
      </div>
    )
  }
  const d = detection
  const loc = d.location
  return (
    <div className="panel h-full overflow-y-auto p-4">
      <div className="flex items-start justify-between gap-2">
        <div><div className="font-mono text-[12px] text-sonar">{d.id}</div><div className="mt-0.5 text-lg font-semibold">{d.class}</div></div>
        <ConfidenceBadge level={d.confidence_level} />
      </div>
      <div className="mt-3 flex items-end gap-2"><span className="text-3xl font-semibold tabular-nums">{d.confidence.toFixed(1)}%</span><span className="label pb-1">heuristic score, not a probability</span></div>
      <div className="mt-2"><Row k="Dimensions (est.)">{d.estimated_dimensions.length_m} m x {d.estimated_dimensions.width_m} m
        {d.estimated_dimensions.scale_source === 'assumed' && <div className="text-[11px] text-signal">assumed scale {d.estimated_dimensions.scale_m_per_px} m/px</div>}</Row>
        <Row k="Area">{d.estimated_dimensions.area_m2} m² ({d.area} px)</Row>
        <Row k="Bounding box">{d.bbox.x}, {d.bbox.y} · {d.bbox.width} x {d.bbox.height} px</Row>
        <Row k="Coordinates">
          <div className="font-mono text-[12px]">{fmtCoord(loc.latitude, loc.longitude)}</div>
          {loc.source === 'demo' && <div className="mt-1"><Tag tone="signal">DEMO COORDINATES</Tag></div>}
          {loc.source === 'unavailable' && <div className="mt-1 text-[11px] text-haze">No survey metadata supplied</div>}
        </Row>
        <Row k="Timestamp">{fmtDate(d.timestamp)}</Row>
        <Row k="Processing mode"><Tag tone="signal">{d.mode_label}</Tag></Row>
      </div>
      <div className="mt-4 label">Evidence behind the score</div>
      <div className="mt-2 space-y-1.5">
        {Object.entries(d.confidence_factors).map(([k, v]) => (
          <div key={k} className="grid grid-cols-[120px_1fr_34px] items-center gap-2 text-[12px]">
            <span className="text-haze">{FACTOR_LABELS[k] ?? k}</span>
            <div className="h-1.5 rounded bg-shelf"><div className="h-full rounded bg-sonar" style={{ width: `${Math.round(v * 100)}%` }} /></div>
            <span className="text-right tabular-nums">{Math.round(v * 100)}</span>
          </div>
        ))}
      </div>
      {d.explanation.length > 0 && <ul className="mt-3 list-disc space-y-1 pl-4 text-[12px] text-haze">{d.explanation.map(e => <li key={e}>{e}</li>)}</ul>}
      {d.mode_label.startsWith('Demo') && <p className="mt-3 rounded border border-signal/30 bg-signal/10 px-2.5 py-2 text-[11px] text-signal">Demo / Classical CV: the class is a shape-based guess, not a trained-model prediction.</p>}
    </div>
  )
}
