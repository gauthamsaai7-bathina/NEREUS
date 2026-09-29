"""Central configuration. Values come from environment variables or an optional backend/.env file."""
from __future__ import annotations

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent  # the backend/ folder


def _load_env_file() -> None:
    env_path = BASE_DIR / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


_load_env_file()


def _resolve(path_str: str) -> Path:
    p = Path(path_str)
    return p if p.is_absolute() else BASE_DIR / p


class Settings:
    app_name = "NEREUS"
    version = "1.0.0"

    def __init__(self) -> None:
        self.model_type = os.getenv("MODEL_TYPE", "demo").strip().lower()
        self.model_path = _resolve(os.getenv("MODEL_PATH", "models/nereus_yolo.pt"))
        self.max_upload_bytes = int(float(os.getenv("MAX_UPLOAD_MB", "25")) * 1024 * 1024)
        self.max_processing_dim = int(os.getenv("MAX_PROCESSING_DIM", "1600"))
        self.cors_origins = [o.strip() for o in os.getenv(
            "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if o.strip()]
        self.output_dir = _resolve(os.getenv("OUTPUT_DIR", "outputs"))
        self.database_path = _resolve(os.getenv("DATABASE_PATH", "outputs/nereus.db"))
        self.min_confidence = float(os.getenv("MIN_CONFIDENCE", "35"))
        self.stage_pacing_ms = int(os.getenv("STAGE_PACING_MS", "450"))
        self.default_pixel_size_m = float(os.getenv("DEFAULT_PIXEL_SIZE_M", "0.10"))
        self.demo_latitude = float(os.getenv("DEMO_LATITUDE", "13.0600"))
        self.demo_longitude = float(os.getenv("DEMO_LONGITUDE", "80.3300"))
        self.demo_heading = float(os.getenv("DEMO_HEADING_DEG", "90"))
        self.sample_dirs = [BASE_DIR.parent / "sample_data", BASE_DIR / "sample_data"]

    @property
    def scans_dir(self) -> Path:
        return self.output_dir / "scans"


settings = Settings()
