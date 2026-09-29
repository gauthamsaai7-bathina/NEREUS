"""Model abstraction layer.

Any detector only needs to implement DetectionModel.predict(): return Candidate regions for a
preprocessed sonar image. Noise filtering, scoring, geotagging and reporting are model-independent.

  MODEL_TYPE=demo  -> DemoCVModel  (classical computer vision, NOT a trained AI model)
  MODEL_TYPE=yolo  -> YOLOModel    (trained weights; requires `pip install ultralytics`)
"""
from __future__ import annotations

import logging
from abc import ABC, abstractmethod

import cv2
import numpy as np

from app.config import settings
from app.models.detection_models import CLASSES, Candidate, PreprocessResult
from app.services import noise_filter

log = logging.getLogger("nereus.model")


class ModelError(Exception):
    """Raised when inference fails. Message is user-safe."""


class DetectionModel(ABC):
    type: str = "base"           # value reported as processing_mode
    name: str = "Base model"
    mode_label: str = ""
    validated: bool = False
    note: str = ""

    def load(self) -> None:  # optional hook
        return None

    @abstractmethod
    def predict(self, prep: PreprocessResult) -> list[Candidate]:
        """Return candidate regions (bbox + optional contour/label/model_score)."""

    def min_area(self, prep: PreprocessResult) -> float:
        return 60.0


class DemoCVModel(DetectionModel):
    """DEMO / FALLBACK inference using classical computer vision only.

    Pipeline: robust z-score of the enhanced image -> bright-return mask -> morphology ->
    connected components -> contours. Labels are heuristic guesses from shape features and
    are NOT trained-model predictions.
    """
    type = "demo_cv"
    name = "Demo / Classical CV"
    mode_label = "Demo / Classical CV"
    validated = False
    note = "Classical computer-vision fallback. Labels are heuristic guesses, not trained-model predictions."

    Z_HIGH = 2.3

    def predict(self, prep: PreprocessResult) -> list[Candidate]:
        H, W = prep.enhanced.shape
        g = cv2.GaussianBlur(prep.enhanced.astype(np.float32), (0, 0), 1.6)
        med = float(np.median(g))
        mad = float(np.median(np.abs(g - med))) * 1.4826 + 1e-6
        z = (g - med) / mad
        bright = (z > self.Z_HIGH).astype(np.uint8)
        # Ignore the nadir / water-column strip in the centre of the swath.
        hw = max(6, int(0.03 * W))
        bright[:, prep.nadir_x - hw:prep.nadir_x + hw] = 0

        bright = cv2.morphologyEx(bright, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
        k = max(9, int(0.012 * max(H, W)) | 1)
        bright = cv2.morphologyEx(bright, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))

        n, labels, stats, _ = cv2.connectedComponentsWithStats(bright, connectivity=8)
        cands: list[Candidate] = []
        for i in range(1, n):
            x, y, w, h, area = stats[i]
            if area < self.min_area(prep) * 0.6:
                continue
            mask = (labels == i).astype(np.uint8)
            cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            if not cnts:
                continue
            c = max(cnts, key=cv2.contourArea)
            cand = Candidate(bbox=(int(x), int(y), int(w), int(h)), contour=c)
            cand.features = noise_filter.compute_features(cand, prep)
            cand.label = self._classify(cand.features)
            cands.append(cand)
        return cands

    @staticmethod
    def _classify(f: dict[str, float]) -> str:
        """Transparent shape rules. These are heuristics for the demo, not learned decision boundaries."""
        length, aspect, sol = f["length_px"], f["aspect_ratio"], f["solidity"]
        shadow, hollow = f["shadow_ratio"], f["hollow"]
        if hollow > 0.3 and length > 40 and shadow < 0.4:
            return "Ghost Net" if sol > 0.85 and length > 90 else "Fishing Gear"
        if sol < 0.8 and length > 60 and shadow < 0.4 and aspect < 4:
            return "Fishing Gear"
        if length > 170 and shadow > 0.3 and aspect < 4.5:
            return "Shipwreck"
        if aspect >= 5.5 and length >= 60:
            return "Pipe"
        if 1.8 <= aspect < 5.5 and sol > 0.8 and shadow > 0.15:
            return "Cylinder"
        if length < 45 and f["brightness_ratio"] > 1.9:
            return "Metal Debris"
        if sol > 0.8 and shadow > 0.15:
            return "Other Man-Made Object"
        return "Unknown Anomaly"


class YOLOModel(DetectionModel):
    """Adapter for a trained Ultralytics YOLO detector / segmenter (UNTESTED here: no weights are bundled)."""
    type = "yolo"
    name = "YOLO (trained weights)"
    mode_label = "Trained model (YOLO)"
    note = "Trained model output. Validate on your own labelled sonar data before operational use."

    # Map your training labels to canonical NEREUS classes here.
    CLASS_MAP = {"ghost_net": "Ghost Net", "fishing_gear": "Fishing Gear", "shipwreck": "Shipwreck",
                 "pipe": "Pipe", "cylinder": "Cylinder", "metal_debris": "Metal Debris"}

    def __init__(self) -> None:
        self._model = None

    def load(self) -> None:
        try:
            from ultralytics import YOLO  # imported lazily so the demo needs no extra dependency
        except ImportError as exc:
            raise ModelError("ultralytics is not installed. Run: pip install ultralytics") from exc
        if not settings.model_path.exists():
            raise ModelError(f"Model weights not found at {settings.model_path}")
        self._model = YOLO(str(settings.model_path))

    def predict(self, prep: PreprocessResult) -> list[Candidate]:
        if self._model is None:
            raise ModelError("Model is not loaded.")
        rgb = cv2.cvtColor(prep.enhanced, cv2.COLOR_GRAY2BGR)
        res = self._model.predict(rgb, verbose=False)[0]
        names = res.names
        out: list[Candidate] = []
        for i, box in enumerate(res.boxes):
            x1, y1, x2, y2 = [int(v) for v in box.xyxy[0].tolist()]
            raw = str(names[int(box.cls[0])]).lower().replace(" ", "_")
            label = self.CLASS_MAP.get(raw, "Unknown Anomaly")
            cand = Candidate(bbox=(x1, y1, max(1, x2 - x1), max(1, y2 - y1)), label=label,
                             model_score=float(box.conf[0]))
            if res.masks is not None:  # optional segmentation output
                poly = res.masks.xy[i]
                if len(poly) >= 3:
                    cand.contour = np.asarray(poly, np.int32).reshape(-1, 1, 2)
            cand.features = noise_filter.compute_features(cand, prep)
            out.append(cand)
        return out


_instance: DetectionModel | None = None
_warning: str | None = None


def get_model() -> DetectionModel:
    """Return the configured model (singleton). Falls back to demo mode with a visible warning."""
    global _instance, _warning
    if _instance is not None:
        return _instance
    if settings.model_type == "yolo":
        try:
            m = YOLOModel()
            m.load()
            _instance = m
            return m
        except ModelError as exc:
            _warning = f"MODEL_TYPE=yolo requested but unavailable ({exc}). Running in DEMO mode."
            log.warning(_warning)
    _instance = DemoCVModel()
    return _instance


def model_warning() -> str | None:
    return _warning


def canonical_class(label: str | None) -> str:
    return label if label in CLASSES else "Unknown Anomaly"
