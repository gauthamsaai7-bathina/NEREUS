"""Side-scan sonar preprocessing.

Design notes: median filtering (edge preserving) is used instead of heavy blurring so acoustic
shadows keep their sharp boundaries. Range flattening removes the intensity fall-off with distance
from the nadir so a single threshold works across the whole swath.
"""
from __future__ import annotations

import cv2
import numpy as np

from app.config import settings
from app.models.detection_models import PreprocessResult


def resize_for_processing(gray: np.ndarray, max_dim: int | None = None) -> tuple[np.ndarray, float]:
    """Downscale so the longest side is <= max_dim (aspect ratio preserved). Returns (image, scale_factor)."""
    max_dim = max_dim or settings.max_processing_dim
    h, w = gray.shape
    if max(h, w) <= max_dim:
        return gray, 1.0
    scale = max_dim / max(h, w)
    return cv2.resize(gray, (int(round(w * scale)), int(round(h * scale))), interpolation=cv2.INTER_AREA), scale


def preprocess(gray: np.ndarray, scale: float = 1.0) -> PreprocessResult:
    """`gray` must already be at working resolution (see resize_for_processing); `scale` is recorded for geometry."""
    steps: list[str] = ["Grayscale conversion (8-bit)"]
    if scale < 1.0:
        steps.append(f"Resized to {gray.shape[1]}x{gray.shape[0]} (aspect ratio preserved)")
    original = gray.copy()

    # 2. Speckle reduction: median (keeps shadow edges) followed by a light Gaussian.
    den = cv2.medianBlur(gray, 3)
    den = cv2.GaussianBlur(den, (0, 0), 0.8)
    steps.append("Speckle suppression (3x3 median + Gaussian sigma 0.8)")

    # 3. Range / gain flattening: divide by a heavily smoothed background estimate.
    f = den.astype(np.float32) + 1.0
    nadir_x = gray.shape[1] // 2
    # Gain fall-off is mostly a function of across-track range, so estimate it as a robust per-column profile.
    # (A 2-D blur would also "flatten away" large acoustic shadows, which carry information we want to keep.)
    col = np.median(f, axis=0)
    col = cv2.GaussianBlur(col.reshape(1, -1), (0, 0), sigmaX=max(3.0, gray.shape[1] / 60.0)).ravel()
    flat = f / (col[None, :] + 1e-3)
    row = np.median(flat, axis=1)  # slow along-track drift (e.g. vehicle altitude changes)
    row = cv2.GaussianBlur(row.reshape(-1, 1), (0, 0), sigmaX=0, sigmaY=max(3.0, gray.shape[0] / 6.0)).ravel()
    flat = flat / (row[:, None] + 1e-3)
    steps.append("Range/gain flattening (per-column gain profile, shadows preserved)")

    # 4. Robust histogram normalisation (1st-99th percentile).
    lo, hi = np.percentile(flat, (1, 99.5))
    norm = np.clip((flat - lo) / max(hi - lo, 1e-6), 0, 1)
    base8 = (norm * 255).astype(np.uint8)
    steps.append("Histogram normalisation (1-99.5 percentile stretch)")

    # 5. CLAHE for local contrast.
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    eq = clahe.apply(base8)
    steps.append("CLAHE local contrast enhancement (clip 2.0, 8x8 tiles)")

    # 6. Mild unsharp mask as edge enhancement.
    blur = cv2.GaussianBlur(eq, (0, 0), 2.0)
    enhanced = cv2.addWeighted(eq, 1.5, blur, -0.5, 0)
    steps.append("Edge enhancement (unsharp mask, amount 0.5)")
    steps.append("Intensity normalisation to 0-255")

    return PreprocessResult(
        original=original,
        enhanced=enhanced,
        flattened=flat.astype(np.float32),
        scale_factor=scale,
        nadir_x=nadir_x,
        baseline=float(np.median(flat)),
        steps=steps,
    )
