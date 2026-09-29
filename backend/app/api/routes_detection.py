"""Upload, analysis and result endpoints."""
from __future__ import annotations

import logging
import threading
from typing import Optional

from fastapi import APIRouter, File, Form, Query, UploadFile
from fastapi.responses import FileResponse

from app.api.deps import ApiError, parse_metadata, read_upload
from app.config import settings
from app.models.schemas import AnalyzeAccepted, ErrorResponse, ScanResult, ScanStatus
from app.services import jobs, storage
from app.services.inference import run_pipeline
from app.services.model_adapter import ModelError
from app.utils.file_utils import is_valid_scan_id

log = logging.getLogger("nereus.api")
router = APIRouter(prefix="/api", tags=["Detection"])
ERR = {400: {"model": ErrorResponse}, 413: {"model": ErrorResponse}, 415: {"model": ErrorResponse}, 422: {"model": ErrorResponse}}


def _execute(scan_id, decoded, name, meta, demo, pacing_ms) -> ScanResult:
    try:
        result = run_pipeline(scan_id, decoded, name, meta, demo, pacing_ms, on_stage=lambda k: jobs.set_stage(scan_id, k))
        storage.complete_scan(result)
        return result
    except ModelError as exc:
        storage.fail_scan(scan_id, str(exc))
        raise ApiError(500, "model_error", "The inference engine could not process this image. Please try again.")
    except ApiError:
        raise
    except Exception:  # never leak internals
        log.exception("Pipeline failure for %s", scan_id)
        storage.fail_scan(scan_id, "Unexpected processing error")
        raise ApiError(500, "processing_failed", "Unable to process this sonar image. Please verify the image format and try again.")


@router.post("/detect", response_model=ScanResult, responses=ERR, summary="Synchronous detection (returns the finished result)")
async def detect(file: UploadFile = File(...), metadata: Optional[str] = Form(None), metadata_id: Optional[str] = Form(None),
                 demo_coordinates: bool = Form(True)):
    """Upload a sonar image and receive the complete structured result in one call."""
    decoded, name = await read_upload(file)
    meta, meta_json = parse_metadata(metadata, metadata_id)
    scan_id = storage.create_scan(name, meta_json)
    return _execute(scan_id, decoded, name, meta, demo_coordinates, 0)


@router.post("/analyze", response_model=AnalyzeAccepted, status_code=202, responses=ERR,
             summary="Asynchronous analysis with live stage status")
async def analyze(file: UploadFile = File(...), metadata: Optional[str] = Form(None), metadata_id: Optional[str] = Form(None),
                  demo_coordinates: bool = Form(True)):
    """Validate the upload, start processing in a background thread and return immediately.
    Poll `status_url` for the current stage, then fetch `result_url`."""
    decoded, name = await read_upload(file)
    meta, meta_json = parse_metadata(metadata, metadata_id)
    scan_id = storage.create_scan(name, meta_json)
    jobs.set_stage(scan_id, "ingest")

    def work():
        try:
            _execute(scan_id, decoded, name, meta, demo_coordinates, settings.stage_pacing_ms)
        except Exception:  # already recorded in the database by _execute
            pass

    threading.Thread(target=work, daemon=True).start()
    return AnalyzeAccepted(scan_id=scan_id, status_url=f"/api/scans/{scan_id}/status", result_url=f"/api/detections/{scan_id}")


def _check_id(scan_id: str) -> None:
    if not is_valid_scan_id(scan_id):
        raise ApiError(400, "invalid_scan_id", "Invalid scan ID.")


@router.get("/scans/{scan_id}/status", response_model=ScanStatus, responses=ERR, summary="Live processing status")
def scan_status(scan_id: str):
    _check_id(scan_id)
    row = storage.get_scan_row(scan_id)
    if not row:
        raise ApiError(404, "scan_not_found", "Scan not found.")
    total = len(jobs.STAGES)
    if row["status"] == "completed":
        _, label, msg = jobs.STAGES[-1]
        return ScanStatus(scan_id=scan_id, status="completed", stage_key="complete", stage_label=label, message=msg,
                          stage_index=total - 1, stage_total=total, progress=100)
    if row["status"] == "failed":
        return ScanStatus(scan_id=scan_id, status="failed", stage_key="failed", stage_label="ANALYSIS FAILED",
                          message="Processing failed.", stage_index=0, stage_total=total, progress=0,
                          error="Unable to process this sonar image. Please verify the image format and try again.")
    st = jobs.get_stage(scan_id) or {"stage_key": "ingest", "stage_label": jobs.STAGES[0][1], "message": jobs.STAGES[0][2], "index": 0}
    return ScanStatus(scan_id=scan_id, status="processing", stage_key=st["stage_key"], stage_label=st["stage_label"],
                      message=st["message"], stage_index=st["index"], stage_total=total,
                      progress=int(st["index"] / (total - 1) * 100))


@router.get("/detections/{scan_id}", response_model=ScanResult, responses=ERR, summary="Full result of a completed scan")
def get_detections(scan_id: str):
    _check_id(scan_id)
    result = storage.get_scan(scan_id)
    if not result:
        row = storage.get_scan_row(scan_id)
        if row and row["status"] == "processing":
            raise ApiError(409, "still_processing", "This scan is still being processed.")
        raise ApiError(404, "scan_not_found", "Scan not found.")
    return result


@router.get("/scans/{scan_id}/image", summary="Original or enhanced image (PNG)")
def scan_image(scan_id: str, variant: str = Query("original", pattern="^(original|enhanced)$")):
    _check_id(scan_id)
    path = settings.scans_dir / scan_id / f"{variant}.png"  # fixed file names: no user-controlled path parts
    if not path.exists():
        raise ApiError(404, "image_not_found", "Image not available.")
    return FileResponse(path, media_type="image/png", headers={"Cache-Control": "private, max-age=3600"})
