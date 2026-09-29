"""Pydantic schemas that define the public API contract (also rendered in Swagger)."""
from __future__ import annotations

from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

ConfidenceLevel = Literal["High", "Medium", "Low"]
CoordinateSource = Literal["metadata", "demo", "unavailable"]


class SurveyMetadata(BaseModel):
    """Sonar survey metadata. All fields are optional; coordinates are validated when present."""
    latitude: Optional[float] = Field(None, ge=-90, le=90, description="Latitude of the image centre (decimal degrees)")
    longitude: Optional[float] = Field(None, ge=-180, le=180, description="Longitude of the image centre (decimal degrees)")
    timestamp: Optional[str] = Field(None, max_length=40, description="ISO-8601 acquisition time")
    heading: Optional[float] = Field(None, ge=0, le=360, description="Vessel heading in degrees (0 = north)")
    depth: Optional[float] = Field(None, ge=0, le=12000, description="Sensor depth in metres")
    ping_number: Optional[int] = Field(None, ge=0)
    vehicle_id: Optional[str] = Field(None, max_length=64)
    survey_id: Optional[str] = Field(None, max_length=64)
    pixel_size_m: Optional[float] = Field(None, gt=0, le=50, description="Metres per pixel (both axes)")
    data_source: Literal["real", "demo"] = Field("real", description="Set to \"demo\" for synthetic/demo data")


class BBox(BaseModel):
    x: int
    y: int
    width: int
    height: int


class Location(BaseModel):
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    source: CoordinateSource = "unavailable"
    label: str = "Location unavailable"


class EstimatedDimensions(BaseModel):
    length_m: float
    width_m: float
    area_m2: float
    scale_m_per_px: float
    scale_source: Literal["metadata", "assumed"]


class Segmentation(BaseModel):
    polygon: list[list[int]] = Field(default_factory=list, description="Simplified outline, [x, y] pairs in image pixels")


class Detection(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    class_name: str = Field(alias="class")
    confidence: float = Field(description="Heuristic score 0-100. NOT a statistical probability.")
    confidence_level: ConfidenceLevel
    bbox: BBox
    area: int = Field(description="Area in pixels")
    estimated_dimensions: EstimatedDimensions
    location: Location
    segmentation: Optional[Segmentation] = None
    timestamp: str
    processing_mode: str
    mode_label: str
    explanation: list[str] = Field(default_factory=list)
    confidence_factors: dict[str, float] = Field(default_factory=dict)
    features: dict[str, float] = Field(default_factory=dict)


class ImageInfo(BaseModel):
    filename: str
    width: int
    height: int
    original_width: int
    original_height: int
    resized: bool
    scale_factor: float
    format: str


class StageTiming(BaseModel):
    key: str
    label: str
    duration_ms: int


class PipelineInfo(BaseModel):
    stages: list[StageTiming]
    preprocessing_steps: list[str]
    candidates_found: int
    filtered_out: int
    filter_reasons: dict[str, int]


class ModelInfo(BaseModel):
    name: str
    type: str
    validated: bool = False
    note: str


class ScanSummary(BaseModel):
    count: int
    high: int
    medium: int
    low: int
    marine_debris: int
    by_class: dict[str, int]
    mean_confidence: Optional[float] = None
    coordinates_available: bool
    coordinate_source: CoordinateSource


class ScanResult(BaseModel):
    scan_id: str
    status: Literal["processing", "completed", "failed"]
    processing_mode: str
    processing_mode_label: str
    processing_time_ms: int
    timestamp: str
    image: ImageInfo
    metadata: Optional[SurveyMetadata] = None
    model: ModelInfo
    summary: ScanSummary
    detections: list[Detection]
    pipeline: PipelineInfo
    disclaimer: str


class ScanStatus(BaseModel):
    scan_id: str
    status: Literal["processing", "completed", "failed"]
    stage_key: str
    stage_label: str
    message: str
    stage_index: int
    stage_total: int
    progress: int
    error: Optional[str] = None


class AnalyzeAccepted(BaseModel):
    scan_id: str
    status: Literal["processing"] = "processing"
    status_url: str
    result_url: str


class HistoryItem(BaseModel):
    scan_id: str
    timestamp: str
    filename: str
    detection_count: int
    high_confidence: int
    processing_time_ms: int
    processing_mode: str
    status: str


class MetadataAccepted(BaseModel):
    metadata_id: str
    metadata: SurveyMetadata


class ErrorBody(BaseModel):
    code: str
    message: str


class ErrorResponse(BaseModel):
    error: ErrorBody


class ComponentHealth(BaseModel):
    name: str
    status: Literal["ok", "degraded", "error"]
    detail: str


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded", "error"]
    mode: Literal["DEMO", "LIVE"]
    version: str
    model_type: str
    components: list[ComponentHealth]
    total_scans: int
    avg_processing_time_ms: Optional[float] = None
    last_scan: Optional[dict[str, Any]] = None
    warnings: list[str] = Field(default_factory=list)
