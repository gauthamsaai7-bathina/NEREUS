"""Convert pixel positions into geographic coordinates using survey metadata.

Geometry: image X is across-track (nadir at the centre column, positive X = starboard) and image Y is
along-track (increasing Y = later pings, i.e. ahead along the vessel heading). Both axes share the same
pixel size. This is a flat-earth approximation that is adequate for swaths of a few hundred metres.
"""
from __future__ import annotations

import math

from app.config import settings
from app.models.schemas import Location, SurveyMetadata

M_PER_DEG_LAT = 111_320.0


def resolve_pixel_size(meta: SurveyMetadata | None, scale_factor: float) -> tuple[float, str]:
    """Metres per pixel of the WORKING image, and where the value came from."""
    if meta and meta.pixel_size_m:
        return meta.pixel_size_m / scale_factor, "metadata"
    return settings.default_pixel_size_m / scale_factor, "assumed"


def locate(cx: float, cy: float, width: int, height: int, nadir_x: int, px_m: float,
           meta: SurveyMetadata | None, demo_coordinates: bool) -> Location:
    if meta and meta.latitude is not None and meta.longitude is not None:
        lat0, lon0, heading = meta.latitude, meta.longitude, meta.heading or 0.0
        is_demo = meta.data_source == "demo"
    elif demo_coordinates:
        lat0, lon0, heading, is_demo = settings.demo_latitude, settings.demo_longitude, settings.demo_heading, True
    else:
        return Location()

    along = (cy - height / 2) * px_m
    across = (cx - nadir_x) * px_m
    h = math.radians(heading)
    d_north = along * math.cos(h) - across * math.sin(h)
    d_east = along * math.sin(h) + across * math.cos(h)
    lat = lat0 + d_north / M_PER_DEG_LAT
    lon = lon0 + d_east / (M_PER_DEG_LAT * max(math.cos(math.radians(lat0)), 1e-6))
    return Location(
        latitude=round(lat, 6), longitude=round(lon, 6),
        source="demo" if is_demo else "metadata",
        label="DEMO COORDINATES" if is_demo else "From survey metadata",
    )
