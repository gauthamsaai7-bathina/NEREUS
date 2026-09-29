import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileImage, FlaskConical, Play, UploadCloud, X } from 'lucide-react'
import ImageViewer from '../components/ImageViewer'
import DetectionInspector from '../components/DetectionInspector'
import DetectionTable from '../components/DetectionTable'
import ProcessingPanel from '../components/ProcessingPanel'
import { ErrorState, PageHeader, Tag } from '../components/ui'
import { useScan } from '../context/ScanContext'
import { useToast } from '../context/ToastContext'
import { fetchSampleFile, getSamples, imageUrl, uploadAndDetect } from '../services/api'
import type { SampleScan, ScanStatus, SurveyMetadata } from '../types/api'
import { fmtMs } from '../utils/format'

const ACCEPT = '.png,.jpg,.jpeg,.tif,.tiff'
const MAX_MB = 25

export default function SonarAnalysis() {
  const { scan, setScan, selectedId, select, settings } = useScan()
  const { toast } = useToast()
  const nav = useNavigate()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [meta, setMeta] = useState<SurveyMetadata | null>(null)
  const [samples, setSamples] = useState<SampleScan[]>([])
  const [drag, setDrag] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<ScanStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => { getSamples().then(setSamples).catch(() => setSamples([])) }, [])
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  const accept = useCallback((f: File, m: SurveyMetadata | null = null) => {
    setError(null)
    if (!/\.(png|jpe?g|tiff?)$/i.test(f.name)) { setError('Unsupported file type. Upload a PNG, JPG or TIFF sonar image.'); return }
    if (f.size > MAX_MB * 1024 * 1024) { setError(`The image exceeds the ${MAX_MB} MB upload limit.`); return }
    setFile(f); setMeta(m); setScan(null)
    setPreview(prev => { if (prev) URL.revokeObjectURL(prev); return /\.tiff?$/i.test(f.name) ? null : URL.createObjectURL(f) })
  }, [setScan])

  const loadDemo = async (s: SampleScan) => {
    try { accept(await fetchSampleFile(s.name), s.metadata); toast('info', `${s.name} loaded (synthetic demo data).`) }
    catch (e) { setError((e as Error).message) }
  }

  const analyze = async () => {
    if (!file) return
    setBusy(true); setError(null); setStatus(null)
    try {
      const result = await uploadAndDetect(file, { metadata: meta, demoCoordinates: settings.demoCoordinates }, setStatus)
      setScan(result)
      toast('success', result.summary.count ? `${result.summary.count} anomalies detected in ${fmtMs(result.processing_time_ms)}.` : 'Analysis complete: no anomalies retained.')
    } catch (e) { setError((e as Error).message); toast('error', (e as Error).message) }
    finally { setBusy(false) }
  }

  const selected = scan?.detections.find(d => d.id === selectedId) ?? null
  const viewSrc = scan ? imageUrl(scan.scan_id, 'original') : preview
  const filename = file?.name ?? scan?.image.filename ?? ''

  return (
    <div>
      <PageHeader title="Sonar Analysis" subtitle="Upload side-scan sonar imagery, run the detection pipeline and review anomalies."
        actions={<>{scan && <button className="btn" onClick={() => nav('/map')}>Open map</button>}{scan && <button className="btn" onClick={() => nav('/reports')}>Reports</button>}</>} />
      <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
        {/* LEFT: input */}
        <div className="space-y-4">
          <div className="panel p-4">
            <div className="panel-title mb-3">Input</div>
            <div onDragOver={e => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)}
              onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) accept(f) }}
              onClick={() => input.current?.click()} role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') input.current?.click() }}
              className={`grid cursor-pointer place-items-center rounded-md border border-dashed px-3 py-8 text-center transition-colors ${drag ? 'border-sonar bg-sonar/10' : 'border-line hover:border-sonar/50'}`}>
              <UploadCloud size={26} className="text-sonar" />
              <div className="mt-2 text-[13px] font-medium">Drop Side-Scan Sonar imagery here</div>
              <div className="mt-1 text-[11px] text-haze">PNG · JPG · JPEG · TIFF, up to {MAX_MB} MB</div>
              <input ref={input} type="file" accept={ACCEPT} className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) accept(f); e.target.value = '' }} />
            </div>
            {file && (
              <div className="mt-3 flex items-center gap-2 rounded border border-line bg-shelf px-2.5 py-2 text-[12px]">
                <FileImage size={15} className="shrink-0 text-haze" /><span className="min-w-0 flex-1 truncate">{file.name}</span>
                <button aria-label="Remove file" className="text-haze hover:text-mist" onClick={() => { setFile(null); setPreview(null); setMeta(null); setScan(null) }}><X size={14} /></button>
              </div>
            )}
            <div className="mt-3 space-y-2">
              <button className="btn btn-primary w-full" disabled={!file || busy} onClick={analyze}><Play size={14} />{busy ? 'Analysing...' : 'Analyze'}</button>
              <div className="label pt-1">Demo scans <Tag tone="signal">SYNTHETIC</Tag></div>
              {samples.length === 0 && <div className="text-[12px] text-haze">No demo scans found. Run sample_data/generate_sample_data.py.</div>}
              {samples.map((s, i) => (
                <button key={s.name} className="btn w-full justify-start" onClick={() => loadDemo(s)} disabled={busy} title={s.description}><FlaskConical size={14} />{i === 0 ? 'Load Demo Scan' : `Load Demo Scan ${i + 1}`}</button>
              ))}
            </div>
          </div>
          <div className="panel p-4 text-[12px]">
            <div className="panel-title mb-2">Survey metadata</div>
            {meta ? (
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                {Object.entries(meta).filter(([, v]) => v != null && v !== '').map(([k, v]) => (<><dt key={k + 'k'} className="text-haze">{k}</dt><dd key={k + 'v'} className="truncate text-right font-mono">{String(v)}</dd></>))}
              </dl>
            ) : <p className="text-haze">{settings.demoCoordinates ? 'None supplied. Coordinates will be generated as clearly labelled DEMO COORDINATES.' : 'None supplied. Detections will show "Location unavailable".'}</p>}
            {meta?.data_source === 'demo' && <div className="mt-2"><Tag tone="signal">SYNTHETIC DEMO DATA</Tag></div>}
          </div>
        </div>

        {/* MIDDLE: viewer */}
        <div className="min-w-0 space-y-4">
          <div className="relative h-[520px]">
            {viewSrc ? (
              <ImageViewer key={viewSrc} originalUrl={viewSrc} enhancedUrl={scan ? imageUrl(scan.scan_id, 'enhanced') : undefined}
                detections={scan?.detections ?? []} selectedId={selectedId} onSelect={select}
                showLabelsDefault={settings.showLabels} showSegmentationDefault={settings.showSegmentation} />
            ) : (
              <div className="grid h-full place-items-center rounded-md border border-line bg-trench grid-bg text-center text-[13px] text-haze">
                <div><FileImage size={30} className="mx-auto mb-2" />{file ? 'Preview unavailable for this format. Click Analyze to process it.' : 'The sonar viewer will appear here.'}</div>
              </div>
            )}
            {busy && <ProcessingPanel status={status} filename={filename} />}
          </div>
          {error && <ErrorState message={error} onRetry={file ? analyze : undefined} />}
          {scan && (
            <div className="panel">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="panel-title">{scan.scan_id}</div><Tag tone="signal">{scan.processing_mode_label}</Tag>
                  <span className="text-[12px] text-haze">{scan.summary.count} detections · {scan.pipeline.filtered_out} filtered out · {fmtMs(scan.processing_time_ms)}</span>
                </div>
                <span className="text-[11px] text-haze">{scan.image.width} x {scan.image.height} px{scan.image.resized ? ` (from ${scan.image.original_width} x ${scan.image.original_height})` : ''}</span>
              </div>
              {scan.detections.length ? <DetectionTable detections={scan.detections} selectedId={selectedId} onSelect={select} />
                : <p className="px-4 py-8 text-center text-[13px] text-haze">No anomalies were retained. Try another image, or review how many candidates were filtered as natural features in Reports.</p>}
              <p className="border-t border-line px-4 py-2 text-[11px] text-haze">{scan.disclaimer}</p>
            </div>
          )}
        </div>

        {/* RIGHT: inspector */}
        <div className="xl:h-[520px]"><DetectionInspector scan={scan} detection={selected} /></div>
      </div>
    </div>
  )
}
