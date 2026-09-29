"""Filename and path safety helpers."""
from __future__ import annotations

import re
from pathlib import Path

ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".tif", ".tiff"}
_SAFE = re.compile(r"[^A-Za-z0-9._-]+")
_SCAN_ID = re.compile(r"^SCAN-\d{4}-\d{4,}$")


def sanitize_filename(name: str | None) -> str:
    """Strip directories and unsafe characters. The result is only used for display, never as a storage path."""
    base = (name or "upload").replace("\\", "/").split("/")[-1]
    base = _SAFE.sub("_", base).strip("._") or "upload"
    return base[:80]


def has_allowed_extension(name: str) -> bool:
    return Path(name).suffix.lower() in ALLOWED_EXTENSIONS


def is_valid_scan_id(scan_id: str) -> bool:
    """Scan IDs are used to build folder paths, so only the exact generated format is accepted."""
    return bool(_SCAN_ID.match(scan_id))
