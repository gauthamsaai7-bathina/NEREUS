"""Survey metadata endpoints and bundled synthetic sample scans."""
from __future__ import annotations

import json
from typing import Optional

from fastapi import APIRouter
from fastapi.responses import FileResponse

from app.api.deps import ApiError
from app.config import settings
from app.models.schemas import ErrorResponse, MetadataAccepted, SurveyMetadata
from app.services import storage

router = APIRouter(prefix="/api", tags=["Metadata"])


@router.post("/metadata", response_model=MetadataAccepted, responses={422: {"model": ErrorResponse}},
             summary="Validate and store survey metadata; pass the returned id as `metadata_id` to /api/analyze")
def post_metadata(meta: SurveyMetadata):
    return MetadataAccepted(metadata_id=storage.save_metadata(meta.model_dump_json()), metadata=meta)


def _sample_dir():
    for d in settings.sample_dirs:
        if (d / "sample_metadata.json").exists():
            return d
    return None


@router.get("/samples", summary="Bundled SYNTHETIC demo sonar scans")
def samples():
    d = _sample_dir()
    if not d:
        return []
    meta = json.loads((d / "sample_metadata.json").read_text(encoding="utf-8"))
    out = []
    for name, m in meta.items():
        if name.startswith("_") or not (d / name).exists():
            continue
        out.append({"name": name, "description": m.get("description", "Synthetic demo sonar image"),
                    "synthetic": True, "metadata": {k: v for k, v in m.items() if k != "description"}})
    return out


@router.get("/samples/{name}/image", summary="Download a bundled synthetic sample image")
def sample_image(name: str):
    d = _sample_dir()
    allowed = {p.name for p in d.glob("sample_sonar_*.png")} if d else set()
    if name not in allowed:  # whitelist lookup prevents path traversal
        raise ApiError(404, "sample_not_found", "Sample not found.")
    return FileResponse(d / name, media_type="image/png")
