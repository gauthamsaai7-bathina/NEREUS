"""Shared request helpers: upload validation, metadata parsing, uniform API errors."""
from __future__ import annotations

import json
from typing import Optional

from fastapi import HTTPException, UploadFile
from pydantic import ValidationError

from app.config import settings
from app.models.schemas import SurveyMetadata
from app.services import storage
from app.utils.file_utils import has_allowed_extension, sanitize_filename
from app.utils.image_utils import DecodedImage, ImageValidationError, decode_image


class ApiError(HTTPException):
    def __init__(self, status: int, code: str, message: str):
        super().__init__(status_code=status, detail={"code": code, "message": message})


async def read_upload(file: UploadFile) -> tuple[DecodedImage, str]:
    """Validate type and size, decode the image. Raises ApiError with user-safe messages."""
    name = sanitize_filename(file.filename)
    if not has_allowed_extension(name):
        raise ApiError(415, "unsupported_type", "Unsupported file type. Upload a PNG, JPG or TIFF sonar image.")
    data = await file.read(settings.max_upload_bytes + 1)
    if len(data) > settings.max_upload_bytes:
        mb = settings.max_upload_bytes // (1024 * 1024)
        raise ApiError(413, "file_too_large", f"The image exceeds the {mb} MB upload limit.")
    try:
        return decode_image(data), name
    except ImageValidationError as exc:
        raise ApiError(422, "invalid_image", str(exc))


def parse_metadata(metadata: Optional[str], metadata_id: Optional[str]) -> tuple[Optional[SurveyMetadata], Optional[str]]:
    """Metadata may be sent inline (JSON string) or referenced by an id from POST /api/metadata."""
    raw = metadata
    if not raw and metadata_id:
        raw = storage.load_metadata(metadata_id)
        if raw is None:
            raise ApiError(404, "metadata_not_found", "The referenced metadata record does not exist.")
    if not raw:
        return None, None
    try:
        meta = SurveyMetadata.model_validate(json.loads(raw))
    except (json.JSONDecodeError, ValidationError, TypeError):
        raise ApiError(422, "invalid_metadata", "Survey metadata is invalid. Check latitude, longitude, heading and depth values.")
    return meta, meta.model_dump_json()
