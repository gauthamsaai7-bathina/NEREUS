"""JSON and CSV report generation from a stored scan result."""
from __future__ import annotations

import io
from datetime import datetime, timezone

import pandas as pd

from app.models.schemas import ScanResult

CSV_COLUMNS = ["ID", "Class", "Confidence", "Confidence Level", "Latitude", "Longitude",
               "X", "Y", "Width", "Height", "Estimated Area", "Timestamp", "Coordinate Source"]


def build_json(scan: ScanResult) -> dict:
    return {
        "report_generated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "scan_id": scan.scan_id,
        "timestamp": scan.timestamp,
        "image_name": scan.image.filename,
        "image": scan.image.model_dump(),
        "processing_mode": scan.processing_mode,
        "processing_mode_label": scan.processing_mode_label,
        "processing_time_ms": scan.processing_time_ms,
        "metadata": scan.metadata.model_dump() if scan.metadata else None,
        "summary": scan.summary.model_dump(),
        "detections": [d.model_dump(by_alias=True, mode="json") for d in scan.detections],
        "disclaimer": scan.disclaimer,
    }


def build_csv(scan: ScanResult) -> str:
    rows = [{
        "ID": d.id, "Class": d.class_name, "Confidence": d.confidence, "Confidence Level": d.confidence_level,
        "Latitude": d.location.latitude, "Longitude": d.location.longitude,
        "X": d.bbox.x, "Y": d.bbox.y, "Width": d.bbox.width, "Height": d.bbox.height,
        "Estimated Area": d.estimated_dimensions.area_m2, "Timestamp": d.timestamp,
        "Coordinate Source": d.location.source,
    } for d in scan.detections]
    df = pd.DataFrame(rows, columns=CSV_COLUMNS)
    buf = io.StringIO()
    df.to_csv(buf, index=False)
    return buf.getvalue()
