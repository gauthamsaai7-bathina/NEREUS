"""SQLite persistence (stdlib only). Schema is simple so it can move to PostgreSQL later."""
from __future__ import annotations

import json
import sqlite3
import threading
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from app.config import settings
from app.models.schemas import ScanResult

_lock = threading.Lock()

SCHEMA = """
CREATE TABLE IF NOT EXISTS scans (
    scan_id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    filename TEXT NOT NULL,
    status TEXT NOT NULL,
    processing_mode TEXT,
    processing_time_ms INTEGER DEFAULT 0,
    detection_count INTEGER DEFAULT 0,
    high_count INTEGER DEFAULT 0,
    marine_debris_count INTEGER DEFAULT 0,
    result_json TEXT,
    metadata_json TEXT,
    error TEXT
);
CREATE TABLE IF NOT EXISTS metadata (
    metadata_id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    metadata_json TEXT NOT NULL
);
"""


def _conn() -> sqlite3.Connection:
    settings.output_dir.mkdir(parents=True, exist_ok=True)
    c = sqlite3.connect(settings.database_path, timeout=15)
    c.row_factory = sqlite3.Row
    return c


def init_db() -> None:
    with _lock, _conn() as c:
        c.executescript(SCHEMA)
        # A restart abandons any job that was mid-flight.
        c.execute("UPDATE scans SET status=\"failed\", error=\"Interrupted by server restart\" WHERE status=\"processing\"")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def create_scan(filename: str, metadata_json: Optional[str]) -> str:
    """Reserve a new scan ID (SCAN-YYYY-NNNN) and insert a row in `processing` state."""
    year = datetime.now(timezone.utc).year
    with _lock, _conn() as c:
        row = c.execute("SELECT COUNT(*) AS n FROM scans WHERE scan_id LIKE ?", (f"SCAN-{year}-%",)).fetchone()
        n = row["n"] + 1
        while True:
            scan_id = f"SCAN-{year}-{n:04d}"
            if not c.execute("SELECT 1 FROM scans WHERE scan_id=?", (scan_id,)).fetchone():
                break
            n += 1
        c.execute("INSERT INTO scans (scan_id, created_at, filename, status, metadata_json) VALUES (?,?,?,?,?)",
                  (scan_id, now_iso(), filename, "processing", metadata_json))
    return scan_id


def complete_scan(result: ScanResult) -> None:
    with _lock, _conn() as c:
        c.execute(
            """UPDATE scans SET status=?, processing_mode=?, processing_time_ms=?, detection_count=?, high_count=?,
               marine_debris_count=?, result_json=?, error=NULL WHERE scan_id=?""",
            ("completed", result.processing_mode, result.processing_time_ms, result.summary.count,
             result.summary.high, result.summary.marine_debris,
             result.model_dump_json(by_alias=True), result.scan_id))


def fail_scan(scan_id: str, error: str) -> None:
    with _lock, _conn() as c:
        c.execute("UPDATE scans SET status=\"failed\", error=? WHERE scan_id=?", (error, scan_id))


def get_scan(scan_id: str) -> Optional[ScanResult]:
    with _lock, _conn() as c:
        row = c.execute("SELECT result_json FROM scans WHERE scan_id=? AND status=\"completed\"", (scan_id,)).fetchone()
    return ScanResult.model_validate_json(row["result_json"]) if row and row["result_json"] else None


def get_scan_row(scan_id: str) -> Optional[dict[str, Any]]:
    with _lock, _conn() as c:
        row = c.execute("SELECT scan_id, status, error, filename FROM scans WHERE scan_id=?", (scan_id,)).fetchone()
    return dict(row) if row else None


def list_history(search: str = "", sort: str = "date", order: str = "desc", limit: int = 200) -> list[dict[str, Any]]:
    cols = {"date": "created_at", "detections": "detection_count", "high": "high_count",
            "time": "processing_time_ms", "name": "filename", "id": "scan_id"}
    col = cols.get(sort, "created_at")
    direction = "ASC" if order.lower() == "asc" else "DESC"
    sql = "SELECT scan_id, created_at, filename, detection_count, high_count, processing_time_ms, processing_mode, status FROM scans"
    params: list[Any] = []
    if search:
        sql += " WHERE scan_id LIKE ? OR filename LIKE ?"
        params += [f"%{search}%", f"%{search}%"]
    sql += f" ORDER BY {col} {direction} LIMIT ?"  # col/direction come from fixed whitelists above
    params.append(limit)
    with _lock, _conn() as c:
        return [dict(r) for r in c.execute(sql, params).fetchall()]


def all_completed() -> list[ScanResult]:
    with _lock, _conn() as c:
        rows = c.execute("SELECT result_json FROM scans WHERE status=\"completed\" ORDER BY created_at ASC").fetchall()
    return [ScanResult.model_validate_json(r["result_json"]) for r in rows]


def health_stats() -> dict[str, Any]:
    with _lock, _conn() as c:
        agg = c.execute("SELECT COUNT(*) AS n, AVG(processing_time_ms) AS avg_ms FROM scans WHERE status=\"completed\"").fetchone()
        last = c.execute("SELECT scan_id, created_at, filename FROM scans WHERE status=\"completed\" ORDER BY created_at DESC LIMIT 1").fetchone()
    return {"total": agg["n"], "avg_ms": agg["avg_ms"], "last": dict(last) if last else None}


def save_metadata(metadata_json: str) -> str:
    mid = f"META-{uuid.uuid4().hex[:8].upper()}"
    with _lock, _conn() as c:
        c.execute("INSERT INTO metadata VALUES (?,?,?)", (mid, now_iso(), metadata_json))
    return mid


def load_metadata(metadata_id: str) -> Optional[str]:
    with _lock, _conn() as c:
        row = c.execute("SELECT metadata_json FROM metadata WHERE metadata_id=?", (metadata_id,)).fetchone()
    return row["metadata_json"] if row else None
