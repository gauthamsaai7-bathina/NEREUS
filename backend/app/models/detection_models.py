"""Internal (non-API) data structures shared by the pipeline services."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

import numpy as np

# Canonical classes the system can output.
CLASSES = [
    "Ghost Net", "Fishing Gear", "Shipwreck", "Pipe", "Cylinder",
    "Metal Debris", "Unknown Anomaly", "Other Man-Made Object",
]
# Classes that count as "marine debris" on the dashboard.
MARINE_DEBRIS = {"Ghost Net", "Fishing Gear", "Metal Debris", "Other Man-Made Object"}


@dataclass
class PreprocessResult:
    original: np.ndarray            # uint8 grayscale, working resolution
    enhanced: np.ndarray            # uint8, contrast-enhanced for viewing and detection
    flattened: np.ndarray           # float32, range-normalised intensity (~1.0 = typical seafloor)
    scale_factor: float             # working size / original size
    nadir_x: int                    # across-track column of the nadir (centre) line
    baseline: float = 1.0           # median of `flattened`: typical seafloor level
    steps: list[str] = field(default_factory=list)


@dataclass
class Candidate:
    """A region proposed by a model, before noise filtering and scoring."""
    bbox: tuple[int, int, int, int]                 # x, y, w, h
    contour: Optional[np.ndarray] = None            # OpenCV contour (N,1,2)
    label: Optional[str] = None
    model_score: Optional[float] = None             # 0-1, only for trained models
    features: dict[str, float] = field(default_factory=dict)
    keep: bool = True
    reject_reason: Optional[str] = None
    notes: list[str] = field(default_factory=list)
    confidence: float = 0.0
    factors: dict[str, float] = field(default_factory=dict)
