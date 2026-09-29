// The ONLY place that talks to the backend. Components import these functions, never axios directly.
import axios, { AxiosError } from 'axios'
import type { AnalyzeAccepted, Health, HistoryItem, SampleScan, ScanResult, ScanStatus, Stats, SurveyMetadata } from '../types/api'

export const API_BASE_URL: string = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') || 'http://localhost:8000'

/** Error with a message that is always safe to show to a user. */
export class ApiError extends Error {
  code: string
  constructor(code: string, message: string) { super(message); this.code = code }
}

const http = axios.create({ baseURL: API_BASE_URL, timeout: 60_000 })

function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err
  const e = err as AxiosError<{ error?: { code: string; message: string } }>
  if (e.code === 'ECONNABORTED') return new ApiError('timeout', 'The request timed out. The image may be too large or the backend is busy. Please try again.')
  if (!e.response) return new ApiError('backend_unavailable', `Backend unavailable. Verify the NEREUS API is running at ${API_BASE_URL}.`)
  const body = e.response.data
  if (body && typeof body === 'object' && body.error) return new ApiError(body.error.code, body.error.message)
  return new ApiError('http_error', 'Unable to process this sonar image. Please verify the image format and try again.')
}

async function call<T>(fn: () => Promise<{ data: T }>): Promise<T> {
  try { return (await fn()).data } catch (err) { throw toApiError(err) }
}

function assertScan(data: unknown): ScanResult {
  const d = data as ScanResult
  if (!d || typeof d.scan_id !== 'string' || !Array.isArray(d.detections) || !d.image || !d.summary) {
    throw new ApiError('malformed_response', 'The server returned an unexpected response. Please try again.')
  }
  return d
}

export const getHealth = () => call<Health>(() => http.get('/api/health', { timeout: 8000 }))
export const getStats = () => call<Stats>(() => http.get('/api/stats'))
export const getSamples = () => call<SampleScan[]>(() => http.get('/api/samples'))
export const getHistory = (params: { search?: string; sort?: string; order?: 'asc' | 'desc' } = {}) =>
  call<HistoryItem[]>(() => http.get('/api/history', { params }))
export const getScanStatus = (scanId: string) => call<ScanStatus>(() => http.get(`/api/scans/${scanId}/status`))
export const postMetadata = (m: SurveyMetadata) => call<{ metadata_id: string; metadata: SurveyMetadata }>(() => http.post('/api/metadata', m))

export async function getDetection(scanId: string): Promise<ScanResult> {
  return assertScan(await call(() => http.get(`/api/detections/${scanId}`)))
}

export interface AnalyzeOptions { metadata?: SurveyMetadata | null; metadataId?: string | null; demoCoordinates: boolean }

/** Upload an image and start analysis. Returns immediately with a scan id; poll getScanStatus(). */
export function startAnalysis(file: File, opts: AnalyzeOptions): Promise<AnalyzeAccepted> {
  const form = new FormData()
  form.append('file', file)
  form.append('demo_coordinates', String(opts.demoCoordinates))
  if (opts.metadataId) form.append('metadata_id', opts.metadataId)
  else if (opts.metadata) form.append('metadata', JSON.stringify(opts.metadata))
  return call<AnalyzeAccepted>(() => http.post('/api/analyze', form))
}

/** Upload, wait for completion (polling) and return the finished result. */
export async function uploadAndDetect(file: File, opts: AnalyzeOptions, onStatus?: (s: ScanStatus) => void): Promise<ScanResult> {
  const { scan_id } = await startAnalysis(file, opts)
  for (let i = 0; i < 600; i++) {
    const s = await getScanStatus(scan_id)
    onStatus?.(s)
    if (s.status === 'completed') return getDetection(scan_id)
    if (s.status === 'failed') throw new ApiError('processing_failed', s.error || 'Unable to process this sonar image. Please verify the image format and try again.')
    await new Promise(r => setTimeout(r, 250))
  }
  throw new ApiError('timeout', 'Processing is taking longer than expected. Please check the History page later.')
}

export const imageUrl = (scanId: string, variant: 'original' | 'enhanced') => `${API_BASE_URL}/api/scans/${scanId}/image?variant=${variant}`

export async function fetchSampleFile(name: string): Promise<File> {
  try {
    const res = await http.get(`/api/samples/${name}/image`, { responseType: 'blob' })
    return new File([res.data], name, { type: 'image/png' })
  } catch (e) { throw toApiError(e) }
}

async function download(path: string, fallbackName: string) {
  try {
    const res = await http.get(path, { responseType: 'blob' })
    const cd = String(res.headers['content-disposition'] || '')
    const name = /filename=([^;]+)/.exec(cd)?.[1] || fallbackName
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch (e) { throw toApiError(e) }
}
export const downloadJSON = (scanId: string) => download(`/api/report/${scanId}/json`, `${scanId}_report.json`)
export const downloadCSV = (scanId: string) => download(`/api/report/${scanId}/csv`, `${scanId}_detections.csv`)
