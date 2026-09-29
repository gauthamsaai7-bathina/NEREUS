"""Pipeline orchestrator: preprocess -> model -> noise filter -> confidence -> geotag -> result."""
from __future__ import annotations

import logging
import time
from collections import Counter
from typing import Callable, Optional

import cv2
import numpy as np

from app.config import settings
from app.models.detection_models import MARINE_DEBRIS
from app.models.schemas import (BBox, Detection, EstimatedDimensions, ImageInfo, ModelInfo, PipelineInfo, ScanResult,
                                ScanSummary, Segmentation, StageTiming, SurveyMetadata)
from app.services import confidence, geotagging, noise_filter
from app.services.jobs import STAGES, STAGE_INDEX
from app.services.model_adapter import ModelError, canonical_class, get_model
from app.services.preprocessing import preprocess, resize_for_processing
from app.utils.image_utils import DecodedImage, encode_png

log = logging.getLogger("nereus.pipeline")

DISCLAIMER = ("Confidence is a heuristic score derived from image evidence, not a statistical probability. "
              "Results are decision support for a prototype and have not been scientifically validated.")


def run_pipeline(scan_id: str, decoded: DecodedImage, filename: str, meta: Optional[SurveyMetadata],
                 demo_coordinates: bool, pacing_ms: int = 0,
                 on_stage: Callable[[str], None] = lambda _k: None) -> ScanResult:
    """Run the full analysis and persist the original/enhanced images. Returns the structured result."""
    timings: dict[str, float] = {}

    def stage(key: str, fn):
        on_stage(key)
        if pacing_ms:
            time.sleep(pacing_ms / 1000)  # demo pacing only; excluded from reported timings
        t0 = time.perf_counter()
        out = fn()
        timings[key] = (time.perf_counter() - t0) * 1000
        return out

    model = get_model()
    scan_dir = settings.scans_dir / scan_id
    scan_dir.mkdir(parents=True, exist_ok=True)

    def ingest():
        work, scale = resize_for_processing(decoded.gray)
        (scan_dir / "original.png").write_bytes(encode_png(work))
        return work, scale

    work, scale = stage("ingest", ingest)

    def enhance():
        result = preprocess(work, scale)
        (scan_dir / "enhanced.png").write_bytes(encode_png(result.enhanced))
        return result

    prep = stage("preprocess", enhance)
    H, W = prep.enhanced.shape

    try:
        cands = stage("inference", lambda: model.predict(prep))
    except ModelError:
        raise
    except Exception as exc:  # any model crash becomes a safe ModelError
        log.exception("Model inference failed")
        raise ModelError("The inference engine failed on this image.") from exc

    min_area = max(model.min_area(prep), 0.00004 * W * H)
    kept, reasons = stage("filter", lambda: noise_filter.filter_candidates(cands, prep, min_area))
    for c in kept:
        confidence.score_candidate(c)
    kept = [c for c in kept if c.confidence >= settings.min_confidence]
    if len(kept) < len([c for c in cands if c.keep]):
        reasons["Below minimum confidence threshold"] = len([c for c in cands if c.keep]) - len(kept)
    kept.sort(key=lambda c: -c.confidence)

    px_m, scale_src = geotagging.resolve_pixel_size(meta, prep.scale_factor)
    ts = (meta.timestamp if meta and meta.timestamp else None)

    def build():
        from app.services.storage import now_iso
        stamp = ts or now_iso()
        dets: list[Detection] = []
        for i, c in enumerate(kept, 1):
            x, y, w, h = c.bbox
            f = c.features
            loc = geotagging.locate(x + w / 2, y + h / 2, W, H, prep.nadir_x, px_m, meta, demo_coordinates)
            seg = None
            if c.contour is not None:
                eps = 0.01 * cv2.arcLength(c.contour, True)
                poly = cv2.approxPolyDP(c.contour, eps, True).reshape(-1, 2)
                seg = Segmentation(polygon=[[int(px), int(py)] for px, py in poly[:80]])
            dets.append(Detection(
                id=f"ANM-{i:03d}", **{"class": canonical_class(c.label)},
                confidence=c.confidence, confidence_level=confidence.level_for(c.confidence),
                bbox=BBox(x=x, y=y, width=w, height=h), area=int(f["area_px"]),
                estimated_dimensions=EstimatedDimensions(
                    length_m=round(f["length_px"] * px_m, 2), width_m=round(f["thickness_px"] * px_m, 2),
                    area_m2=round(f["area_px"] * px_m * px_m, 2), scale_m_per_px=round(px_m, 4), scale_source=scale_src),
                location=loc, segmentation=seg, timestamp=stamp,
                processing_mode=model.type, mode_label=model.mode_label,
                explanation=c.notes, confidence_factors=c.factors,
                features={k: round(v, 3) for k, v in f.items()}))
        return dets

    dets = stage("geotag", build)

    counts = Counter(d.class_name for d in dets)
    levels = Counter(d.confidence_level for d in dets)
    src = dets[0].location.source if dets else ("metadata" if meta and meta.latitude is not None else
                                                "demo" if demo_coordinates else "unavailable")
    summary = ScanSummary(
        count=len(dets), high=levels["High"], medium=levels["Medium"], low=levels["Low"],
        marine_debris=sum(1 for d in dets if d.class_name in MARINE_DEBRIS), by_class=dict(counts),
        mean_confidence=round(float(np.mean([d.confidence for d in dets])), 1) if dets else None,
        coordinates_available=any(d.location.latitude is not None for d in dets), coordinate_source=src)

    on_stage("complete")
    total_ms = int(sum(timings.values()))
    stage_list = [StageTiming(key=k, label=lbl, duration_ms=int(timings.get(k, 0)))
                  for k, lbl, _ in STAGES if k in timings]
    stage_list.sort(key=lambda s: STAGE_INDEX[s.key])
    from app.services.storage import now_iso
    return ScanResult(
        scan_id=scan_id, status="completed", processing_mode=model.type, processing_mode_label=model.mode_label,
        processing_time_ms=total_ms, timestamp=now_iso(),
        image=ImageInfo(filename=filename, width=W, height=H, original_width=decoded.width,
                        original_height=decoded.height, resized=prep.scale_factor < 1, scale_factor=round(prep.scale_factor, 4),
                        format=decoded.format),
        metadata=meta, model=ModelInfo(name=model.name, type=model.type, validated=model.validated, note=model.note),
        summary=summary, detections=dets,
        pipeline=PipelineInfo(stages=stage_list, preprocessing_steps=prep.steps, candidates_found=len(cands),
                              filtered_out=len(cands) - len(dets), filter_reasons=reasons),
        disclaimer=DISCLAIMER)
