"""Real health endpoint: probes the actual components instead of returning a constant."""
from __future__ import annotations

import logging
import time

import cv2
import numpy as np
from fastapi import APIRouter

from app.config import settings
from app.models.schemas import ComponentHealth, HealthResponse
from app.services import storage
from app.services.model_adapter import get_model, model_warning

log = logging.getLogger("nereus.health")
router = APIRouter(prefix="/api", tags=["Health"])


@router.get("/health", response_model=HealthResponse, summary="Backend, inference engine and storage status")
def health():
    comps: list[ComponentHealth] = [ComponentHealth(name="API", status="ok", detail=f"NEREUS API v{settings.version} responding")]
    warnings = [w for w in [model_warning()] if w]

    try:  # image processing probe: run a real OpenCV operation
        t0 = time.perf_counter()
        probe = cv2.GaussianBlur((np.random.rand(256, 256) * 255).astype(np.uint8), (0, 0), 1.5)
        comps.append(ComponentHealth(name="Image processing", status="ok",
                                     detail=f"OpenCV {cv2.__version__} probe passed in {(time.perf_counter() - t0) * 1000:.1f} ms ({probe.shape[0]}px)"))
    except Exception:
        comps.append(ComponentHealth(name="Image processing", status="error", detail="OpenCV probe failed"))

    try:
        m = get_model()
        comps.append(ComponentHealth(name="Inference engine", status="degraded" if warnings else "ok",
                                     detail=f"{m.name} ({m.type}) loaded" + ("; fallback active" if warnings else "")))
    except Exception:
        comps.append(ComponentHealth(name="Inference engine", status="error", detail="Model failed to load"))

    stats = {"total": 0, "avg_ms": None, "last": None}
    try:
        stats = storage.health_stats()
        comps.append(ComponentHealth(name="Storage (SQLite)", status="ok", detail=f"{stats["total"]} scans stored"))
    except Exception:
        log.exception("Storage health probe failed")
        comps.append(ComponentHealth(name="Storage (SQLite)", status="error", detail="Database unavailable"))

    overall = "error" if any(c.status == "error" for c in comps) else "degraded" if any(c.status == "degraded" for c in comps) else "ok"
    mode = "LIVE" if get_model().type != "demo_cv" else "DEMO"
    return HealthResponse(status=overall, mode=mode, version=settings.version, model_type=get_model().type, components=comps,
                          total_scans=stats["total"], avg_processing_time_ms=round(stats["avg_ms"]) if stats["avg_ms"] else None,
                          last_scan=stats["last"], warnings=warnings)
