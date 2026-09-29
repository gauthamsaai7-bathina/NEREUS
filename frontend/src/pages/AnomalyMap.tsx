import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import { useScan } from '../context/ScanContext'
import { EmptyState, PageHeader, Tag } from '../components/ui'
import { CLASS_GROUPS, fmtCoord, fmtDate, levelColor, matchesGroup } from '../utils/format'

function Fit({ points }: { points: [number, number][] }) {
  const map = useMap()
  useEffect(() => { if (points.length) map.fitBounds(L.latLngBounds(points).pad(0.4), { maxZoom: 17 }) }, [points, map])
  return null
}

export default function AnomalyMap() {
  const { scan, selectedId, select, settings } = useScan()
  const [group, setGroup] = useState('All')
  const located = useMemo(() => (scan?.detections ?? []).filter(d => d.location.latitude != null && d.location.longitude != null), [scan])
  const shown = located.filter(d => matchesGroup(d, group))
  const points = useMemo(() => shown.map(d => [d.location.latitude!, d.location.longitude!] as [number, number]), [shown])
  const anyDemo = located.some(d => d.location.source === 'demo')

  if (!scan) return <div><PageHeader title="Anomaly Map" /><div className="panel"><EmptyState title="No scan selected" body="Run an analysis or open a scan from History to see its anomalies on the map." action={<Link to="/analysis" className="btn btn-primary mt-1">Go to Sonar Analysis</Link>} /></div></div>
  if (!located.length) return <div><PageHeader title="Anomaly Map" subtitle={scan.scan_id} /><div className="panel"><EmptyState title="Location unavailable" body="This scan has no survey coordinates, so detections cannot be placed on a map. Re-run it with survey metadata or with demo coordinates enabled in Settings." /></div></div>

  return (
    <div>
      <PageHeader title="Anomaly Map" subtitle={`${scan.scan_id} · ${shown.length} of ${located.length} anomalies shown`}
        actions={anyDemo ? <Tag tone="signal">DEMO COORDINATES</Tag> : <Tag tone="kelp">Coordinates from survey metadata</Tag>} />
      <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Filter by class">
        {Object.keys(CLASS_GROUPS).map(g => (
          <button key={g} onClick={() => setGroup(g)} aria-pressed={group === g} className={`btn h-8 ${group === g ? 'border-sonar/60 bg-sonar/15 text-sonar' : ''}`}>{g}</button>
        ))}
      </div>
      <div className="panel relative h-[calc(100vh-250px)] min-h-[420px] overflow-hidden">
        <MapContainer center={points[0] ?? [0, 0]} zoom={15} className="h-full w-full" attributionControl>
          {settings.basemap && <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap contributors" />}
          <Fit points={points} />
          {shown.map(d => {
            const c = levelColor[d.confidence_level]
            const sel = d.id === selectedId
            return (
              <CircleMarker key={d.id} center={[d.location.latitude!, d.location.longitude!]} radius={sel ? 13 : 5 + d.confidence / 12}
                pathOptions={{ color: sel ? '#ffffff' : c, fillColor: c, fillOpacity: 0.55, weight: sel ? 3 : 1.5 }} eventHandlers={{ click: () => select(d.id) }}>
                <Popup>
                  <div className="min-w-[190px] text-[12px] leading-relaxed">
                    <div className="font-mono text-sonar">{d.id}</div>
                    <div className="text-sm font-semibold">{d.class}</div>
                    <div>Confidence: <b>{d.confidence.toFixed(1)}%</b> ({d.confidence_level})</div>
                    <div className="font-mono">{fmtCoord(d.location.latitude, d.location.longitude)}</div>
                    <div className="text-haze">Detected {fmtDate(d.timestamp)}</div>
                    {d.location.source === 'demo' && <div className="mt-1 font-semibold text-signal">DEMO COORDINATES</div>}
                  </div>
                </Popup>
              </CircleMarker>
            )
          })}
        </MapContainer>
        <div className="pointer-events-none absolute bottom-3 left-3 z-[500] rounded border border-line bg-trench/90 px-3 py-2 text-[11px]">
          {(['High', 'Medium', 'Low'] as const).map(l => <div key={l} className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: levelColor[l] }} />{l} confidence</div>)}
        </div>
        {!settings.basemap && <div className="pointer-events-none absolute right-3 top-3 z-[500] rounded border border-line bg-trench/90 px-2 py-1 text-[11px] text-haze">Offline: base map tiles disabled</div>}
      </div>
    </div>
  )
}
