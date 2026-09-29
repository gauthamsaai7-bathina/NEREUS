"""In-memory tracker for the live processing stage of each scan (the final result lives in SQLite)."""
from __future__ import annotations

import threading
from typing import Optional

STAGES = [
    ("ingest", "INGESTING SONAR DATA", "Validating and decoding sonar imagery..."),
    ("preprocess", "PREPROCESSING", "Enhancing acoustic contrast and suppressing speckle noise..."),
    ("inference", "RUNNING INFERENCE", "Searching for anomalous structures..."),
    ("filter", "FILTERING ANOMALIES", "Filtering natural geological features..."),
    ("geotag", "GENERATING GEO DATA", "Generating anomaly coordinates..."),
    ("complete", "ANALYSIS COMPLETE", "Analysis complete."),
]
STAGE_INDEX = {k: i for i, (k, _, _) in enumerate(STAGES)}

_lock = threading.Lock()
_jobs: dict[str, dict] = {}


def set_stage(scan_id: str, key: str) -> None:
    _, label, message = STAGES[STAGE_INDEX[key]]
    with _lock:
        _jobs[scan_id] = {"stage_key": key, "stage_label": label, "message": message, "index": STAGE_INDEX[key]}


def get_stage(scan_id: str) -> Optional[dict]:
    with _lock:
        return dict(_jobs[scan_id]) if scan_id in _jobs else None
