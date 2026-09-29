"""Confidence scoring (0-100) and level mapping.

The score is a transparent weighted heuristic of image evidence, NOT a calibrated probability.
"""
from __future__ import annotations

import numpy as np

from app.models.detection_models import Candidate


def level_for(score: float) -> str:
    if score >= 80:
        return "High"
    if score >= 60:
        return "Medium"
    return "Low"


def _clip01(v: float) -> float:
    return float(np.clip(v, 0.0, 1.0))


def score_candidate(c: Candidate) -> None:
    f = c.features
    # Evidence components, each 0..1.
    contrast = _clip01((f["brightness_ratio"] - 1.15) / 0.95)
    shadow = _clip01(f["shadow_ratio"] / 0.45)
    # Size plausibility: objects between ~12 and ~400 px long are most plausible.
    length = f["length_px"]
    size = 1.0 if 12 <= length <= 400 else _clip01(1 - abs(np.log10(max(length, 1) / 100)) / 1.5)
    structure = max(_clip01(0.5 * _clip01(f["edge_density"] / 0.25) + 0.5 * _clip01(f["hollow"] / 0.35)), 0.55) \
        if f["aspect_ratio"] < 4 else _clip01(f["aspect_ratio"] / 6)
    regular = _clip01(f["solidity"]) if f["aspect_ratio"] >= 2 else _clip01(1 - abs(f["solidity"] - 0.85))

    weights = {"contrast": 0.30, "shadow": 0.28, "size": 0.12, "structure": 0.18, "shape": 0.12}
    parts = {"contrast": contrast, "shadow": shadow, "size": size, "structure": structure, "shape": regular}
    heuristic = sum(weights[k] * parts[k] for k in weights) * 100

    if c.model_score is not None:  # trained model: blend model output with image evidence
        score = 0.75 * (c.model_score * 100) + 0.25 * heuristic
    else:
        score = heuristic
    score = float(np.clip(score, 5, 98))
    c.confidence = round(score, 1)
    c.factors = {k: round(v, 3) for k, v in parts.items()}
