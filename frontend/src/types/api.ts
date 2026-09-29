// Types mirror the backend Pydantic schemas (backend/app/models/schemas.py).
export type ConfidenceLevel = 'High' | 'Medium' | 'Low'
export type CoordinateSource = 'metadata' | 'demo' | 'unavailable'

export interface BBox { x: number; y: number; width: number; height: number }
export interface Location { latitude: number | null; longitude: number | null; source: CoordinateSource; label: string }
export interface EstimatedDimensions { length_m: number; width_m: number; area_m2: number; scale_m_per_px: number; scale_source: 'metadata' | 'assumed' }

export interface Detection {
  id: string
  class: string
  confidence: number
  confidence_level: ConfidenceLevel
  bbox: BBox
  area: number
  estimated_dimensions: EstimatedDimensions
  location: Location
  segmentation: { polygon: number[][] } | null
  timestamp: string
  processing_mode: string
  mode_label: string
  explanation: string[]
  confidence_factors: Record<string, number>
  features: Record<string, number>
}

export interface SurveyMetadata {
  latitude?: number | null; longitude?: number | null; timestamp?: string | null; heading?: number | null
  depth?: number | null; ping_number?: number | null; vehicle_id?: string | null; survey_id?: string | null
  pixel_size_m?: number | null; data_source?: 'real' | 'demo'
}

export interface ScanResult {
  scan_id: string
  status: 'processing' | 'completed' | 'failed'
  processing_mode: string
  processing_mode_label: string
  processing_time_ms: number
  timestamp: string
  image: { filename: string; width: number; height: number; original_width: number; original_height: number; resized: boolean; scale_factor: number; format: string }
  metadata: SurveyMetadata | null
  model: { name: string; type: string; validated: boolean; note: string }
  summary: {
    count: number; high: number; medium: number; low: number; marine_debris: number
    by_class: Record<string, number>; mean_confidence: number | null
    coordinates_available: boolean; coordinate_source: CoordinateSource
  }
  detections: Detection[]
  pipeline: {
    stages: { key: string; label: string; duration_ms: number }[]
    preprocessing_steps: string[]; candidates_found: number; filtered_out: number
    filter_reasons: Record<string, number>
  }
  disclaimer: string
}

export interface ScanStatus {
  scan_id: string; status: 'processing' | 'completed' | 'failed'; stage_key: string; stage_label: string
  message: string; stage_index: number; stage_total: number; progress: number; error: string | null
}

export interface AnalyzeAccepted { scan_id: string; status: 'processing'; status_url: string; result_url: string }

export interface HistoryItem {
  scan_id: string; timestamp: string; filename: string; detection_count: number; high_confidence: number
  processing_time_ms: number; processing_mode: string; status: string
}

export interface ComponentHealth { name: string; status: 'ok' | 'degraded' | 'error'; detail: string }
export interface Health {
  status: 'ok' | 'degraded' | 'error'; mode: 'DEMO' | 'LIVE'; version: string; model_type: string
  components: ComponentHealth[]; total_scans: number; avg_processing_time_ms: number | null
  last_scan: { scan_id: string; created_at: string; filename: string } | null; warnings: string[]
}

export interface Stats {
  total_scans: number; total_detections: number; high_confidence: number; marine_debris: number
  avg_processing_time_ms: number | null
  by_class: Record<string, number>; by_level: Record<ConfidenceLevel, number>
  confidence_histogram: { range: string; count: number }[]
  over_time: { date: string; scans: number; detections: number }[]
  recent_detections: { scan_id: string; id: string; class: string; confidence: number; confidence_level: ConfidenceLevel; timestamp: string; location_source: CoordinateSource }[]
}

export interface SampleScan { name: string; description: string; synthetic: boolean; metadata: SurveyMetadata }
