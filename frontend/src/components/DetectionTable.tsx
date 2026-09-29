import type { Detection } from '../types/api'
import { fmtCoord } from '../utils/format'
import { ConfidenceBadge } from './ui'

export default function DetectionTable({ detections, selectedId, onSelect }: { detections: Detection[]; selectedId: string | null; onSelect: (id: string) => void }) {
  return (
    <div className="overflow-auto">
      <table className="w-full min-w-[640px]">
        <thead><tr><th className="th">ID</th><th className="th">Class</th><th className="th">Confidence</th><th className="th">Size (m)</th><th className="th">Coordinates</th></tr></thead>
        <tbody>
          {detections.map(d => (
            <tr key={d.id} onClick={() => onSelect(d.id)} tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') onSelect(d.id) }}
              className={`cursor-pointer transition-colors hover:bg-shelf ${d.id === selectedId ? 'bg-sonar/10' : ''}`}>
              <td className="td font-mono text-sonar">{d.id}</td>
              <td className="td">{d.class}</td>
              <td className="td"><ConfidenceBadge level={d.confidence_level} value={d.confidence} /></td>
              <td className="td tabular-nums">{d.estimated_dimensions.length_m} x {d.estimated_dimensions.width_m}</td>
              <td className="td font-mono text-[12px]">{fmtCoord(d.location.latitude, d.location.longitude)}{d.location.source === 'demo' && <span className="ml-2 text-[10px] text-signal">DEMO</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
