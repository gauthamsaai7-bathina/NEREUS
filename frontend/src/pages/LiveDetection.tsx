import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Pause, Play } from 'lucide-react'
import { useScan } from '../context/ScanContext'
import { imageUrl } from '../services/api'
import { PageHeader, Tag } from '../components/ui'
import { levelColor } from '../utils/format'

const CW = 720, CH = 440
const SPEED = 70 // image rows per second replayed

function Metric({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return <div className="panel px-3 py-2.5"><div className="label">{label}</div><div className="mt-0.5 font-mono text-lg tabular-nums">{value}<span className="ml-1 text-[11px] text-haze">{unit}</span></div></div>
}

/** SIMULATION: replays a stored scan as a scrolling waterfall. No sonar sensor is connected. */
export default function LiveDetection() {
  const { scan } = useScan()
  const canvas = useRef<HTMLCanvasElement>(null)
  const [running, setRunning] = useState(true)
  const [stats, setStats] = useState({ ping: 0, depth: 0, fps: 0, found: 0 })
  const imgRef = useRef<HTMLImageElement | null>(null)
  const state = useRef({ off: 0, last: 0, frames: 0, t0: 0 })

  useEffect(() => {
    imgRef.current = null
    state.current = { off: 0, last: 0, frames: 0, t0: performance.now() }
    if (!scan) return
    const im = new Image(); im.crossOrigin = 'anonymous'
    im.onload = () => { imgRef.current = im }
    im.src = imageUrl(scan.scan_id, 'original')
  }, [scan])

  useEffect(() => {
    const cv = canvas.current!; const ctx = cv.getContext('2d')!
    let raf = 0
    const buf = document.createElement('canvas'); buf.width = CW; buf.height = CH
    const bctx = buf.getContext('2d')!
    bctx.fillStyle = '#04101a'; bctx.fillRect(0, 0, CW, CH)
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      const s = state.current
      if (!running) { s.last = now; return }
      const dt = s.last ? Math.min(0.1, (now - s.last) / 1000) : 0
      s.last = now; s.frames++
      const im = imgRef.current
      let found = 0
      if (im) {
        const scale = CW / im.naturalWidth
        const rows = Math.max(1, Math.round(SPEED * dt))
        s.off = (s.off + rows) % im.naturalHeight
        // scroll the waterfall down and draw the newest rows at the top
        bctx.drawImage(buf, 0, rows)
        const srcY = im.naturalHeight - 1 - s.off
        const sy = Math.max(0, srcY - rows + 1)
        bctx.drawImage(im, 0, sy, im.naturalWidth, rows, 0, 0, CW, rows * scale)
        ctx.drawImage(buf, 0, 0)
        // Rows already revealed are those with index > bottomRow; row r sits at canvas y = (r - bottomRow) * scale.
        const bottomRow = im.naturalHeight - 1 - s.off
        if (s.off < rows) { bctx.fillStyle = '#04101a'; bctx.fillRect(0, 0, CW, CH) } // wrapped: restart the pass
        for (const d of scan!.detections) {
          const y0 = (d.bbox.y - bottomRow) * scale, y1 = (d.bbox.y + d.bbox.height - bottomRow) * scale
          if (d.bbox.y + d.bbox.height < bottomRow) continue // not scrolled into view yet
          found++
          if (y0 > CH) continue
          ctx.strokeStyle = levelColor[d.confidence_level]; ctx.lineWidth = 1.5
          ctx.strokeRect(d.bbox.x * scale, y0, d.bbox.width * scale, y1 - y0)
          ctx.fillStyle = levelColor[d.confidence_level]; ctx.font = '11px Consolas, monospace'
          ctx.fillText(`${d.id} ${d.class} ${d.confidence.toFixed(0)}%`, d.bbox.x * scale, Math.max(11, y0 - 3))
        }
      } else {
        bctx.drawImage(buf, 0, 3)
        const row = bctx.createImageData(CW, 3)
        for (let i = 0; i < row.data.length; i += 4) { const v = 22 + Math.random() * 40; row.data[i] = v * 0.5; row.data[i + 1] = v; row.data[i + 2] = v * 1.1; row.data[i + 3] = 255 }
        bctx.putImageData(row, 0, 0)
        ctx.drawImage(buf, 0, 0)
      }
      // sonar sweep line for visual feedback
      ctx.strokeStyle = 'rgba(55,213,214,0.55)'; ctx.lineWidth = 1
      const y = (now / 12) % CH; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CW, y); ctx.stroke()
      ctx.strokeStyle = 'rgba(55,213,214,0.35)'; ctx.beginPath(); ctx.moveTo(CW / 2, 0); ctx.lineTo(CW / 2, CH); ctx.stroke()
      if (s.frames % 20 === 0) {
        const fps = Math.round(s.frames / ((now - s.t0) / 1000))
        setStats({ ping: 12, depth: +(28.5 + Math.sin(now / 3000) * 0.6).toFixed(1), fps, found: im ? found : 0 })
        if (now - s.t0 > 2000) { s.frames = 0; s.t0 = now }
      }
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [running, scan])

  return (
    <div>
      <PageHeader title="Live Detection" subtitle="Streaming workflow visualisation."
        actions={<><Tag tone="signal">SIMULATION / DEMO MODE</Tag><button className="btn" onClick={() => setRunning(r => !r)}>{running ? <Pause size={14} /> : <Play size={14} />}{running ? 'Pause' : 'Resume'}</button></>} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="panel p-3">
          <div className="mb-2 flex items-center justify-between text-[11px] text-haze"><span>SONAR STREAM · port | nadir | starboard</span><Tag tone="signal">SIMULATED</Tag></div>
          <canvas ref={canvas} width={CW} height={CH} className="w-full rounded border border-line bg-black" aria-label="Simulated sonar waterfall" />
          <p className="mt-2 text-[12px] text-haze">
            {scan ? <>Replaying imagery from <span className="font-mono">{scan.scan_id}</span> as a scrolling waterfall. No sonar sensor is connected.</>
              : <>No sensor is connected. Showing procedural noise. <Link to="/analysis" className="text-sonar underline">Analyse a scan</Link> to replay real stored imagery here.</>}
          </p>
        </div>
        <div className="space-y-3">
          <Metric label="PING RATE" value={String(stats.ping)} unit="Hz (simulated)" />
          <Metric label="CURRENT DEPTH" value={stats.depth.toFixed(1)} unit="m (simulated)" />
          <Metric label="PROCESSING FPS" value={String(stats.fps)} unit="render fps" />
          <Metric label="DETECTIONS" value={scan ? `${stats.found} / ${scan.summary.count}` : '0'} unit={scan ? 'in replayed scan' : ''} />
          <div className="panel px-3 py-2.5"><div className="label">SYSTEM STATUS</div>
            <div className="mt-1 flex items-center gap-2 text-[13px]"><span className={`h-2 w-2 rounded-full ${running ? 'bg-signal' : 'bg-haze'}`} />{running ? 'Simulation running' : 'Paused'}</div></div>
          {scan && <div className="panel p-3 text-[11px]"><div className="label mb-1">Scan detections</div>
            {scan.detections.map(d => <div key={d.id} className="flex justify-between py-0.5"><span className="font-mono">{d.id} {d.class}</span><span style={{ color: levelColor[d.confidence_level] }}>{d.confidence.toFixed(0)}%</span></div>)}</div>}
        </div>
      </div>
    </div>
  )
}
