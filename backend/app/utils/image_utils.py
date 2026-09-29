"""Image decoding, validation and encoding."""
from __future__ import annotations

import io
from dataclasses import dataclass

import cv2
import numpy as np
from PIL import Image, UnidentifiedImageError

Image.MAX_IMAGE_PIXELS = 60_000_000  # guards against decompression bombs
ALLOWED_FORMATS = {"PNG", "JPEG", "TIFF"}


class ImageValidationError(Exception):
    """Raised for files that are not usable sonar images. The message is safe to show to users."""


@dataclass
class DecodedImage:
    gray: np.ndarray   # uint8 grayscale, original resolution
    format: str
    width: int
    height: int


def decode_image(data: bytes) -> DecodedImage:
    """Validate by content (not extension) and return an 8-bit grayscale array."""
    if not data:
        raise ImageValidationError("The uploaded file is empty.")
    try:
        with Image.open(io.BytesIO(data)) as probe:
            probe.verify()
        img = Image.open(io.BytesIO(data))
        fmt = (img.format or "").upper()
        if fmt not in ALLOWED_FORMATS:
            raise ImageValidationError("Unsupported image format. Use PNG, JPG or TIFF sonar imagery.")
        img.load()
    except ImageValidationError:
        raise
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError, SyntaxError):
        raise ImageValidationError("Unable to read this file as an image. Please verify the format and try again.")

    if img.width < 64 or img.height < 64:
        raise ImageValidationError("The image is too small to analyse (minimum 64 x 64 pixels).")

    arr = np.array(img.convert("F") if img.mode in ("I;16", "I", "F") else img.convert("L"))
    if arr.dtype != np.uint8:  # 16-bit / float TIFF -> 8-bit using robust percentile scaling
        lo, hi = np.percentile(arr, (0.5, 99.5))
        arr = np.clip((arr - lo) / max(hi - lo, 1e-6) * 255.0, 0, 255).astype(np.uint8)
    return DecodedImage(gray=arr, format=fmt, width=img.width, height=img.height)


def encode_png(arr: np.ndarray) -> bytes:
    ok, buf = cv2.imencode(".png", arr)
    if not ok:
        raise ValueError("PNG encoding failed")
    return buf.tobytes()
