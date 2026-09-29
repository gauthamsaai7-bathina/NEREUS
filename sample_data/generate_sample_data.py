"""Generate SYNTHETIC side-scan sonar demo imagery (NOT real sonar recordings).

Run:  python generate_sample_data.py
Writes sample_sonar_01.png, sample_sonar_02.png, sample_metadata.json and sample_ground_truth.json
(ground truth is used only by the automated tests; the application never reads it).

Geometry follows a sonar waterfall image: X = across-track (nadir line in the centre, dark water column),
Y = along-track (ping direction). Objects show a bright return and an acoustic shadow falling AWAY from the nadir.
"""
from __future__ import annotations

import json
from pathlib import Path

import cv2
import numpy as np

W, H = 1400, 800
NADIR = W // 2
OUT = Path(__file__).resolve().parent


def seafloor(rng: np.random.Generator) -> np.ndarray:
    x = np.arange(W, dtype=np.float32)
    r = np.abs(x - NADIR) / (W / 2)
    falloff = (0.55 + 0.45 * np.exp(-2.2 * r))[None, :]
    low = cv2.GaussianBlur(rng.normal(0, 1, (H, W)).astype(np.float32), (0, 0), 55)
    low = low / (np.abs(low).max() + 1e-6)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    theta = rng.uniform(0.2, 1.2)
    ripple_env = np.clip(cv2.GaussianBlur(rng.normal(0, 1, (H, W)).astype(np.float32), (0, 0), 90) * 6, 0, 1)
    ripples = 0.07 * np.sin(2 * np.pi * (xx * np.cos(theta) + yy * np.sin(theta)) / 17.0) * ripple_env
    speckle = cv2.GaussianBlur(rng.gamma(6.0, 1 / 6.0, (H, W)).astype(np.float32), (0, 0), 0.7)
    return 92 * (1 + 0.2 * low) * (1 + ripples) * speckle, falloff


def finish(refl: np.ndarray, falloff: np.ndarray) -> np.ndarray:
    """Apply range-dependent gain loss and the nadir water column to the composited reflectivity image."""
    img = refl * falloff
    xx = np.arange(W)[None, :]
    img = np.where(np.abs(xx - NADIR) < 13, img * 0.3, img)  # dark water column
    img[:, NADIR - 1:NADIR + 1] += 60                          # thin bottom-return line
    return img


def canvas() -> np.ndarray:
    return np.zeros((H, W), np.uint8)


def make_mask(kind: str, p: dict, rng: np.random.Generator):
    """Return (mask_uint8, brightness, shadow_len, shadow_strength)."""
    m = canvas()
    cx, cy = p["x"], p["y"]
    if kind == "net":
        pts = []
        for a in np.linspace(0, 2 * np.pi, 11, endpoint=False):
            rad = rng.uniform(0.75, 1.15)
            pts.append([cx + rad * p["w"] / 2 * np.cos(a), cy + rad * p["h"] / 2 * np.sin(a)])
        poly = np.array(pts, np.int32)
        area = canvas(); cv2.fillPoly(area, [poly], 255)
        lat = canvas()
        for gx in range(int(cx - p["w"]), int(cx + p["w"]), 13):
            cv2.line(lat, (gx, int(cy - p["h"])), (gx + 18, int(cy + p["h"])), 255, 2)
        for gy in range(int(cy - p["h"]), int(cy + p["h"]), 13):
            cv2.line(lat, (int(cx - p["w"]), gy), (int(cx + p["w"]), gy + 6), 255, 2)
        m = cv2.bitwise_and(area, lat)
        cv2.polylines(m, [poly], True, 255, 3)
        return m, 165, 22, 0.25
    if kind == "pipe":
        pts = np.array([[cx - p["w"] // 2, cy - p["h"]], [cx, cy], [cx + p["w"] // 2, cy + p["h"]]], np.int32)
        cv2.polylines(m, [pts], False, 255, 9)
        return m, 205, 34, 0.7
    if kind == "cyl":
        rect = ((cx, cy), (p["w"], p["h"]), p.get("angle", 0))
        cv2.fillPoly(m, [cv2.boxPoints(rect).astype(np.int32)], 255)
        return m, 215, 62, 0.88
    if kind == "wreck":
        rect = ((cx, cy), (p["w"], p["h"]), p.get("angle", 0))
        cv2.fillPoly(m, [cv2.boxPoints(rect).astype(np.int32)], 255)
        cv2.circle(m, (int(cx + p["w"] * 0.18), int(cy)), int(p["h"] * 0.42), 255, -1)
        cv2.rectangle(m, (int(cx - p["w"] * 0.32), int(cy - p["h"] * 0.55)), (int(cx - p["w"] * 0.1), int(cy + p["h"] * 0.1)), 255, -1)
        return m, 195, 150, 0.92
    if kind == "debris":
        for _ in range(6):
            ox, oy = rng.integers(-16, 17), rng.integers(-14, 15)
            cv2.ellipse(m, (int(cx + ox), int(cy + oy)), (int(rng.integers(3, 7)), int(rng.integers(3, 6))), rng.integers(0, 180), 0, 360, 255, -1)
        return m, 240, 14, 0.55
    if kind == "gear":
        for _ in range(5):
            pts = np.array([[cx + rng.integers(-55, 55), cy + rng.integers(-40, 40)] for _ in range(4)], np.int32)
            cv2.polylines(m, [pts], False, 255, 3)
        return m, 185, 14, 0.2
    if kind == "rock":
        cv2.ellipse(m, (cx, cy), (p["w"] // 2, p["h"] // 2), rng.integers(0, 180), 0, 360, 255, -1)
        return m, 128, int(p["w"] * 1.3), 0.55
    if kind == "blob":
        pts = np.array([[cx + rng.integers(-p["w"], p["w"]) // 2, cy + rng.integers(-p["h"], p["h"]) // 2] for _ in range(7)], np.int32)
        cv2.fillPoly(m, [cv2.convexHull(pts)], 255)
        return m, 200, 40, 0.75
    if kind == "ridge":  # natural feature: long, faint, no shadow
        cv2.line(m, (cx - p["w"] // 2, cy - p["h"]), (cx + p["w"] // 2, cy + p["h"]), 255, 7)
        return m, 118, 0, 0.0
    raise ValueError(kind)


def render(scene: list[dict], seed: int) -> tuple[np.ndarray, list[dict]]:
    rng = np.random.default_rng(seed)
    img, falloff = seafloor(rng)
    truth = []
    for obj in scene:
        mask, bright, s_len, s_str = make_mask(obj["kind"], obj, rng)
        soft = cv2.GaussianBlur(mask.astype(np.float32) / 255.0, (0, 0), 0.9)
        side = 1 if obj["x"] >= NADIR else -1
        if s_len > 0 and s_str > 0:
            out = soft.copy()
            for s in range(3, s_len, 3):
                out = np.maximum(out, np.roll(soft, side * s, axis=1) * (1 - 0.45 * s / s_len))
            shadow = cv2.GaussianBlur(np.clip(out - soft, 0, 1), (0, 0), 1.5)
            img *= 1 - s_str * shadow
        tex = cv2.GaussianBlur(rng.gamma(9.0, 1 / 9.0, (H, W)).astype(np.float32), (0, 0), 0.6)
        img = img * (1 - soft) + bright * tex * soft
        if obj["kind"] not in ("rock", "ridge"):
            ys, xs = np.nonzero(mask)
            truth.append({"class": obj["truth"], "bbox": [int(xs.min()), int(ys.min()), int(xs.max() - xs.min() + 1), int(ys.max() - ys.min() + 1)]})
    return np.clip(finish(img, falloff), 0, 255).astype(np.uint8), truth


def rocks(seed: int, n: int, avoid: list[tuple[int, int]]) -> list[dict]:
    r = np.random.default_rng(seed)
    out = []
    while len(out) < n:
        x, y = int(r.integers(60, W - 60)), int(r.integers(60, H - 60))
        if abs(x - NADIR) < 60 or any(abs(x - ax) < 130 and abs(y - ay) < 110 for ax, ay in avoid):
            continue
        s = int(r.integers(26, 62))
        out.append({"kind": "rock", "x": x, "y": y, "w": s, "h": int(s * r.uniform(0.7, 1.0))})
    return out


SCENE_1 = [
    {"kind": "wreck", "x": 430, "y": 170, "w": 250, "h": 88, "angle": 8, "truth": "Shipwreck"},
    {"kind": "net", "x": 1010, "y": 250, "w": 150, "h": 95, "truth": "Ghost Net"},
    {"kind": "pipe", "x": 430, "y": 580, "w": 300, "h": 26, "truth": "Pipe"},
    {"kind": "cyl", "x": 1150, "y": 560, "w": 78, "h": 30, "angle": 20, "truth": "Cylinder"},
    {"kind": "debris", "x": 1220, "y": 110, "truth": "Metal Debris"},
    {"kind": "gear", "x": 860, "y": 690, "truth": "Fishing Gear"},
    {"kind": "blob", "x": 250, "y": 400, "w": 44, "h": 32, "truth": "Unknown Anomaly"},
    {"kind": "ridge", "x": 950, "y": 430, "w": 300, "h": 40},
]
SCENE_2 = [
    {"kind": "wreck", "x": 1040, "y": 520, "w": 210, "h": 80, "angle": -12, "truth": "Shipwreck"},
    {"kind": "net", "x": 300, "y": 150, "w": 170, "h": 100, "truth": "Ghost Net"},
    {"kind": "net", "x": 480, "y": 660, "w": 120, "h": 80, "truth": "Ghost Net"},
    {"kind": "pipe", "x": 1080, "y": 190, "w": 330, "h": -30, "truth": "Pipe"},
    {"kind": "cyl", "x": 310, "y": 420, "w": 70, "h": 26, "angle": -25, "truth": "Cylinder"},
    {"kind": "debris", "x": 820, "y": 320, "truth": "Metal Debris"},
    {"kind": "gear", "x": 1200, "y": 720, "truth": "Fishing Gear"},
    {"kind": "ridge", "x": 400, "y": 300, "w": 340, "h": -35},
]


def main() -> None:
    meta = {"_notice": "SYNTHETIC DEMO DATA. Coordinates are illustrative and are NOT from a real sonar survey."}
    truths = {}
    for i, (scene, seed, extra) in enumerate([(SCENE_1, 11, 9), (SCENE_2, 27, 10)], 1):
        name = f"sample_sonar_{i:02d}.png"
        full = scene + rocks(seed, extra, [(o["x"], o["y"]) for o in scene])
        img, truth = render(full, seed)
        cv2.imwrite(str(OUT / name), img)
        truths[name] = truth
        meta[name] = {
            "description": f"Synthetic demo scan {i}: seafloor texture, rocks, sand ripples and man-made objects",
            "latitude": 13.0600 + 0.004 * (i - 1), "longitude": 80.3300 + 0.003 * (i - 1),
            "timestamp": f"2026-09-2{i}T06:{10 * i:02d}:00Z", "heading": 45.0 + 60 * (i - 1), "depth": 28.5 + 6 * (i - 1),
            "ping_number": 10250 * i, "vehicle_id": "AUV-DEMO-01", "survey_id": f"SYN-DEMO-2026-{'AB'[i - 1]}",
            "pixel_size_m": 0.10, "data_source": "demo",
        }
        print("wrote", name, img.shape, len(truth), "objects")
    (OUT / "sample_metadata.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    (OUT / "sample_ground_truth.json").write_text(json.dumps(truths, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
