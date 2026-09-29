"""Feature extraction and rule-based false-positive suppression.

Every rule is explainable: a rejected candidate carries a plain-language reason that is aggregated
into the pipeline summary. Rules target rocks, sand ripples, natural ridges, isolated shadows and
image artefacts.
"""
from __future__ import annotations

import math

import cv2
import numpy as np

from app.models.detection_models import Candidate, PreprocessResult


def _mask_from(cand: Candidate, shape: tuple[int, int]) -> np.ndarray:
    mask = np.zeros(shape, np.uint8)
    if cand.contour is not None:
        cv2.drawContours(mask, [cand.contour], -1, 1, thickness=-1)
    else:
        x, y, w, h = cand.bbox
        mask[y:y + h, x:x + w] = 1
    return mask


def compute_features(cand: Candidate, prep: PreprocessResult) -> dict[str, float]:
    """Compute area, size, aspect ratio, complexity, local contrast, shadow relation and edge density."""
    img = prep.enhanced.astype(np.float32)
    H, W = img.shape
    x, y, w, h = cand.bbox
    mask = _mask_from(cand, (H, W))
    area = float(mask.sum()) or float(w * h)

    # Oriented size and elongation.
    pts = cv2.findNonZero(mask)
    (_, _), (rw, rh), _ = cv2.minAreaRect(pts) if pts is not None else ((0, 0), (w, h), 0)
    length, width = max(rw, rh), max(min(rw, rh), 1.0)
    aspect = length / width

    # Contour complexity: 1.0 for a circle, larger for ragged / net-like shapes. Solidity: 1.0 for convex.
    cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    solidity, complexity = 1.0, 1.0
    if cnts:
        c = max(cnts, key=cv2.contourArea)
        hull_area = cv2.contourArea(cv2.convexHull(c)) or 1.0
        solidity = min(1.0, cv2.contourArea(c) / hull_area)
        complexity = (cv2.arcLength(c, True) ** 2) / (4 * math.pi * max(cv2.contourArea(c), 1.0))

    # Local contrast against a surrounding ring (z-scored by ring noise).
    k = max(5, int(0.5 * min(w, h)))
    dil = cv2.dilate(mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * k + 1, 2 * k + 1)))
    ring = (dil - mask) > 0
    ring[:, max(0, prep.nadir_x - 12):prep.nadir_x + 12] = False
    inside = img[mask > 0]
    ring_px = img[ring]
    ring_mean = float(ring_px.mean()) if ring_px.size else float(img.mean())
    ring_std = float(ring_px.std()) if ring_px.size else 1.0
    contrast = (float(inside.mean()) - ring_mean) / (ring_std + 5.0)

    # Brightness ratio in the linear (range-flattened) domain: object mean / surrounding seafloor mean.
    flat = prep.flattened
    flat_ring = flat[ring]
    brightness_ratio = float(flat[mask > 0].mean() / prep.baseline)
    background_level = float(flat_ring.mean() / prep.baseline) if flat_ring.size else 1.0

    # Hollow fraction: share of the object outline that is NOT a bright return (mesh / net-like structures).
    thresh = ring_mean + 1.2 * ring_std
    fill_ratio = float((inside > thresh).mean()) if inside.size else 1.0

    # Acoustic shadow: sweep the object mask away from the nadir (shadows fall away from the sonar).
    side = 1 if (x + w / 2) >= prep.nadir_x else -1
    s_len = int(min(max(w, 24) * 1.6, 0.25 * W))
    shadow_ratio = 0.0
    local = mask[y:y + h, x:x + w]
    sweep = np.zeros((h, w + s_len), np.uint8)
    for s in range(2, s_len + 1, 2):
        off = s if side == 1 else s_len - s
        sweep[:, off:off + w] |= local
    x_off = x if side == 1 else x - s_len
    own = np.zeros_like(sweep)
    own[:, (0 if side == 1 else s_len):(0 if side == 1 else s_len) + w] = cv2.dilate(local, np.ones((3, 3), np.uint8))
    region = (sweep > 0) & (own == 0)
    xa, xb = max(0, x_off), min(W, x_off + w + s_len)
    if xb > xa:
        reg = region[:, xa - x_off:xb - x_off]
        vals = img[y:y + h, xa:xb][reg]
        if vals.size >= 12:
            sh_mean = float(np.sort(vals)[: max(1, vals.size // 2)].mean())
            shadow_ratio = float(np.clip(1.0 - sh_mean / max(ring_mean, 1.0), 0.0, 1.0))

    # Edge density inside the (slightly grown) object region.
    edges = cv2.Canny(prep.enhanced, 60, 140)
    grown = cv2.dilate(mask, np.ones((3, 3), np.uint8)) > 0
    edge_density = float((edges[grown] > 0).mean()) if grown.any() else 0.0

    return {
        "area_px": area, "width_px": float(w), "height_px": float(h),
        "length_px": float(length), "thickness_px": float(width),
        "aspect_ratio": float(aspect), "solidity": float(solidity), "complexity": float(complexity),
        "contrast": float(contrast), "brightness_ratio": brightness_ratio, "background_level": background_level, "hollow": 1.0 - fill_ratio,
        "shadow_ratio": shadow_ratio, "edge_density": edge_density,
        "shadow_side": float(side),
    }


def evaluate(cand: Candidate, prep: PreprocessResult, min_area: float) -> None:
    """Apply explainable rejection rules in place. Sets cand.keep and cand.reject_reason."""
    f = cand.features
    H, W = prep.enhanced.shape
    x, y, w, h = cand.bbox
    has_shadow = f["shadow_ratio"] >= 0.18

    def reject(reason: str) -> None:
        cand.keep, cand.reject_reason = False, reason

    if f["area_px"] < min_area or f["thickness_px"] < 3:
        return reject("Too small / thin to be a structure (speckle or sensor artefact)")
    if f["background_level"] < 0.6:
        return reject("Located inside an acoustic shadow (contrast is amplified noise, not a real return)")
    if h > 0.6 * H and w < 10:
        return reject("Full-length vertical stripe (ping dropout or striping artefact)")
    if f["area_px"] > 0.2 * W * H:
        return reject("Region too large to be a discrete object (seafloor texture change)")
    if f["aspect_ratio"] > 9 and f["brightness_ratio"] < 1.8:
        return reject("Long, faint linear feature (natural ridge or sand ripple)")
    if f["solidity"] < 0.6 and f["length_px"] < 40:
        return reject("Fragmentary, irregular region (partial return)")
    if f["brightness_ratio"] < 1.45 and f["length_px"] < 60:
        return reject("Small, weak return (speckle cluster or fragmentary texture)")
    if f["aspect_ratio"] < 1.7 and f["solidity"] > 0.8 and f["brightness_ratio"] < 1.85 and f["hollow"] < 0.3:
        return reject("Smooth rounded blob with modest return (rock-like natural feature)")
    if f["brightness_ratio"] < 1.35 and not has_shadow:
        return reject("Weak return with no acoustic shadow (unstructured seafloor variation)")
    if has_shadow:
        cand.notes.append("Acoustic shadow detected on the far side of the object")
    if f["edge_density"] > 0.25:
        cand.notes.append("High internal edge density (textured / mesh-like structure)")
    if f["aspect_ratio"] > 4:
        cand.notes.append("Elongated linear structure")


def filter_candidates(cands: list[Candidate], prep: PreprocessResult, min_area: float) -> tuple[list[Candidate], dict[str, int]]:
    """Compute features (if missing), apply rules, return retained candidates and reject-reason counts."""
    reasons: dict[str, int] = {}
    kept: list[Candidate] = []
    for c in cands:
        if not c.features:
            c.features = compute_features(c, prep)
        evaluate(c, prep, min_area)
        if c.keep:
            kept.append(c)
        else:
            reasons[c.reject_reason or "Rejected"] = reasons.get(c.reject_reason or "Rejected", 0) + 1
    return kept, reasons
