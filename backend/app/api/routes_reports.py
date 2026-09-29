"""Report downloads, dashboard statistics and scan history."""
from __future__ import annotations

from collections import Counter
from typing import Optional

from fastapi import APIRouter, Query, Response

from app.api.deps import ApiError
from app.models.schemas import HistoryItem
from app.services import report_generator, storage
from app.utils.file_utils import is_valid_scan_id

router = APIRouter(prefix="/api", tags=["Reports"])


def _scan_or_404(scan_id: str):
    if not is_valid_scan_id(scan_id):
        raise ApiError(400, "invalid_scan_id", "Invalid scan ID.")
    scan = storage.get_scan(scan_id)
    if not scan:
        raise ApiError(404, "scan_not_found", "Scan not found.")
    return scan


@router.get("/report/{scan_id}/json", summary="Download the scan report as JSON")
def report_json(scan_id: str):
    import json
    scan = _scan_or_404(scan_id)
    body = json.dumps(report_generator.build_json(scan), indent=2)
    return Response(body, media_type="application/json",
                    headers={"Content-Disposition": f"attachment; filename={scan_id}_report.json"})


@router.get("/report/{scan_id}/csv", summary="Download the detections as CSV")
def report_csv(scan_id: str):
    scan = _scan_or_404(scan_id)
    return Response(report_generator.build_csv(scan), media_type="text/csv",
                    headers={"Content-Disposition": f"attachment; filename={scan_id}_detections.csv"})


@router.get("/history", response_model=list[HistoryItem], summary="Stored scans")
def history(search: str = Query("", max_length=80), sort: str = "date", order: str = "desc", limit: int = Query(200, ge=1, le=500)):
    rows = storage.list_history(search, sort, order, limit)
    return [HistoryItem(scan_id=r["scan_id"], timestamp=r["created_at"], filename=r["filename"],
                        detection_count=r["detection_count"] or 0, high_confidence=r["high_count"] or 0,
                        processing_time_ms=r["processing_time_ms"] or 0, processing_mode=r["processing_mode"] or "-",
                        status=r["status"]) for r in rows]


@router.get("/stats", summary="Aggregated dashboard statistics computed from stored scans")
def stats():
    scans = storage.all_completed()
    dets = [d for s in scans for d in s.detections]
    by_class = Counter(d.class_name for d in dets)
    by_level = Counter(d.confidence_level for d in dets)
    buckets = Counter(min(int(d.confidence // 10) * 10, 90) for d in dets)
    per_day: dict[str, dict[str, int]] = {}
    for s in scans:
        day = s.timestamp[:10]
        rec = per_day.setdefault(day, {"scans": 0, "detections": 0})
        rec["scans"] += 1
        rec["detections"] += s.summary.count
    times = [s.processing_time_ms for s in scans]
    recent = [{"scan_id": s.scan_id, "id": d.id, "class": d.class_name, "confidence": d.confidence,
               "confidence_level": d.confidence_level, "timestamp": s.timestamp, "location_source": d.location.source}
              for s in reversed(scans[-4:]) for d in s.detections[:6]][:10]
    return {
        "total_scans": len(scans), "total_detections": len(dets),
        "high_confidence": by_level["High"], "marine_debris": sum(s.summary.marine_debris for s in scans),
        "avg_processing_time_ms": round(sum(times) / len(times)) if times else None,
        "by_class": dict(by_class), "by_level": {k: by_level[k] for k in ("High", "Medium", "Low")},
        "confidence_histogram": [{"range": f"{b}-{b + 9 if b < 90 else 100}", "count": buckets[b]} for b in range(0, 100, 10)],
        "recent_detections": recent,
        "over_time": [{"date": d, **v} for d, v in sorted(per_day.items())],
    }
