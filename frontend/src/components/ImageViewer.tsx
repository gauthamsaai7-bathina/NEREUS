import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Eye, EyeOff, Maximize, Minimize, RotateCcw, Shapes, Tag as TagIcon, ZoomIn, ZoomOut } from 'lucide-react'
import type { Detection } from '../types/api'
import { levelColor } from '../utils/format'

interface Props {
  originalUrl: string
  enhancedUrl?: string          // available once the backend has produced the enhanced image
  detections: Detection[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  showLabelsDefault?: boolean
  showSegmentationDefault?: boolean
}

interface Transform { k: number; x: number; y: number }
const MIN_K = 0.05, MAX_K = 12

export default function ImageViewer({ originalUrl, enhancedUrl, detections, selectedId, onSelect, showLabelsDefault = true, showSegmentationDefault = false }: Props) {
  const wrap = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })              // natural image size
  const [t, setT] = useState<Transform>({ k: 1, x: 0, y: 0 })
  const [variant, setVariant] = useState<'original' | 'enhanced'>('original')
  const [overlay, setOverlay] = useState(true)
  const [labels, setLabels] = useState(showLabelsDefault)
  const [seg, setSeg] = useState(showSegmentationDefault)
  const [fullscreen, setFullscreen] = useState(false)
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null)
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null)

  const src = variant === 'enhanced' && enhancedUrl ? enhancedUrl : originalUrl

  const fit = useCallback(() => {
    const el = wrap.current
    if (!el || !size.w) return
    const k = Math.min(el.clientWidth / size.w, el.clientHeight / size.h) * 0.98
    setT({ k, x: (el.clientWidth - size.w * k) / 2, y: (el.clientHeight - size.h * k) / 2 })
  }, [size])

  useLayoutEffect(() => { fit() }, [fit])
  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(() => fit())
    ro.observe(el)
    return () => ro.disconnect()
  }, [fit])
  useEffect(() => { if (!enhancedUrl) setVariant('original') }, [enhancedUrl])
  useEffect(() => {
    const on = () => setFullscreen(document.fullscreenElement === wrap.current)
    document.addEventListener('fullscreenchange', on)
    return () => document.removeEventListener('fullscreenchange', on)
  }, [])

  const zoomAt = useCallback((factor: number, px: number, py: number) => {
    setT(p => {
      const k = Math.min(MAX_K, Math.max(MIN_K, p.k * factor))
      const r = k / p.k
      return { k, x: px - (px - p.x) * r, y: py - (py - p.y) * r }
    })
  }, [])

  useEffect(() => {  // non-passive wheel listener so the page does not scroll while zooming
    const el = wrap.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomAt])

  const center = () => { const r = wrap.current!.getBoundingClientRect(); return [r.width / 2, r.height / 2] as const }

  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { sx: e.clientX, sy: e.clientY, ox: t.x, oy: t.y, moved: false }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const r = wrap.current!.getBoundingClientRect()
    setCursor({ x: Math.round((e.clientX - r.left - t.x) / t.k), y: Math.round((e.clientY - r.top - t.y) / t.k) })
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true
    if (d.moved) setT(p => ({ ...p, x: d.ox + dx, y: d.oy + dy }))
  }
  const onPointerUp = () => { setTimeout(() => { drag.current = null }, 0) }
  const clickBox = (id: string) => { if (!drag.current?.moved) onSelect(id) }

  const toggleFullscreen = () => { if (document.fullscreenElement) document.exitFullscreen(); else wrap.current?.requestFullscreen() }

  const Btn = ({ onClick, title, active, children }: { onClick: () => void; title: string; active?: boolean; children: React.ReactNode }) => (
    <button onClick={onClick} title={title} aria-label={title} aria-pressed={active}
      className={`grid h-8 w-8 place-items-center rounded border text-mist transition-colors ${active ? 'border-sonar/60 bg-sonar/15 text-sonar' : 'border-line bg-trench/90 hover:border-sonar/40'}`}>{children}</button>
  )

  return (
    <div ref={wrap} className="relative h-full min-h-[360px] w-full select-none overflow-hidden rounded-md border border-line bg-black"
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={() => setCursor(null)}
      style={{ cursor: drag.current?.moved ? 'grabbing' : 'grab', touchAction: 'none' }}>
      {size.w > 0 && (
        <div style={{ position: 'absolute', left: 0, top: 0, width: size.w, height: size.h, transform: `translate(${t.x}px, ${t.y}px) scale(${t.k})`, transformOrigin: '0 0' }}>
          <img src={src} alt="Side-scan sonar imagery" draggable={false} width={size.w} height={size.h} style={{ display: 'block', imageRendering: t.k > 3 ? 'pixelated' : 'auto' }} />
          {overlay && (
            <svg width={size.w} height={size.h} viewBox={`0 0 ${size.w} ${size.h}`} style={{ position: 'absolute', inset: 0 }}>
              {detections.map(d => {
                const c = levelColor[d.confidence_level]
                const sel = d.id === selectedId
                const { x, y, width, height } = d.bbox
                const fs = 12 / t.k
                const text = `${d.id}  ${d.class}  ${d.confidence.toFixed(0)}%`
                const above = y > 22 / t.k
                return (
                  <g key={d.id} onClick={e => { e.stopPropagation(); clickBox(d.id) }} style={{ cursor: 'pointer' }}>
                    {seg && d.segmentation && d.segmentation.polygon.length > 2 && (
                      <polygon points={d.segmentation.polygon.map(p => p.join(',')).join(' ')} fill={`${c}22`} stroke={c} strokeWidth={1.2 / t.k} strokeDasharray={`${4 / t.k} ${3 / t.k}`} />
                    )}
                    <rect x={x} y={y} width={width} height={height} fill={sel ? `${c}26` : 'transparent'} stroke={c} strokeWidth={(sel ? 3 : 1.6) / t.k} />
                    {sel && <rect x={x - 3 / t.k} y={y - 3 / t.k} width={width + 6 / t.k} height={height + 6 / t.k} fill="none" stroke="#ffffff" strokeWidth={1 / t.k} strokeDasharray={`${5 / t.k} ${3 / t.k}`} />}
                    {labels && (
                      <g>
                        <rect x={x} y={above ? y - fs * 1.6 : y + height} width={text.length * fs * 0.58 + fs} height={fs * 1.5} fill="#050b14" fillOpacity={0.88} stroke={c} strokeWidth={0.8 / t.k} />
                        <text x={x + fs * 0.45} y={(above ? y - fs * 1.6 : y + height) + fs * 1.1} fontSize={fs} fill={c} fontFamily="Cascadia Mono, Consolas, monospace">{text}</text>
                      </g>
                    )}
                  </g>
                )
              })}
            </svg>
          )}
        </div>
      )}
      {/* hidden loader to learn the natural size before layout */}
      <img src={originalUrl} alt="" className="hidden" onLoad={e => setSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} />

      <div className="absolute left-2 top-2 flex flex-wrap items-center gap-1.5" onPointerDown={e => e.stopPropagation()}>
        {enhancedUrl && (
          <div className="flex overflow-hidden rounded border border-line bg-trench/90 text-[12px]" role="group" aria-label="Image variant">
            {(['original', 'enhanced'] as const).map(v => (
              <button key={v} onClick={() => setVariant(v)} aria-pressed={variant === v}
                className={`h-8 px-3 capitalize ${variant === v ? 'bg-sonar/15 text-sonar' : 'text-haze hover:text-mist'}`}>{v}</button>
            ))}
          </div>
        )}
        {detections.length > 0 && <>
          <Btn onClick={() => setOverlay(v => !v)} title={overlay ? 'Hide detections' : 'Show detections'} active={overlay}>{overlay ? <Eye size={15} /> : <EyeOff size={15} />}</Btn>
          <Btn onClick={() => setLabels(v => !v)} title="Toggle confidence labels" active={labels}><TagIcon size={15} /></Btn>
          <Btn onClick={() => setSeg(v => !v)} title="Toggle segmentation outlines" active={seg}><Shapes size={15} /></Btn>
        </>}
      </div>
      <div className="absolute right-2 top-2 flex gap-1.5" onPointerDown={e => e.stopPropagation()}>
        <Btn onClick={() => zoomAt(1.4, ...center())} title="Zoom in"><ZoomIn size={15} /></Btn>
        <Btn onClick={() => zoomAt(1 / 1.4, ...center())} title="Zoom out"><ZoomOut size={15} /></Btn>
        <Btn onClick={fit} title="Reset view"><RotateCcw size={15} /></Btn>
        <Btn onClick={toggleFullscreen} title="Fullscreen">{fullscreen ? <Minimize size={15} /> : <Maximize size={15} />}</Btn>
      </div>
      <div className="pointer-events-none absolute bottom-2 left-2 rounded border border-line bg-trench/90 px-2 py-1 font-mono text-[11px] text-haze">
        {Math.round(t.k * 100)}%{cursor && cursor.x >= 0 && cursor.y >= 0 && cursor.x < size.w && cursor.y < size.h ? `  x ${cursor.x}  y ${cursor.y}` : ''}
      </div>
    </div>
  )
}
