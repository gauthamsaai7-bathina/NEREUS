# NEREUS API

Base URL `http://localhost:8000`. Interactive docs: `/docs` (Swagger) and `/redoc`.
Errors always have the shape `{"error": {"code": "...", "message": "..."}}`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Real probes of API, OpenCV, inference engine and SQLite; mode `DEMO` or `LIVE` |
| POST | `/api/detect` | Multipart `file` (+ optional `metadata` JSON string, `metadata_id`, `demo_coordinates`). Runs synchronously, returns the full result |
| POST | `/api/analyze` | Same inputs. Returns `202 {scan_id, status_url, result_url}` and processes in the background |
| GET | `/api/scans/{scan_id}/status` | Live stage: `stage_label`, `message`, `stage_index`, `progress`, `status` |
| GET | `/api/detections/{scan_id}` | Full result of a completed scan (409 while processing) |
| GET | `/api/scans/{scan_id}/image?variant=original|enhanced` | Stored working-resolution PNG. Bounding boxes use this image's pixel coordinates |
| GET | `/api/report/{scan_id}/json` | JSON report (attachment) |
| GET | `/api/report/{scan_id}/csv` | CSV: ID, Class, Confidence, Confidence Level, Latitude, Longitude, X, Y, Width, Height, Estimated Area, Timestamp, Coordinate Source |
| POST | `/api/metadata` | Validate and store survey metadata; returns `metadata_id` |
| GET | `/api/history?search=&sort=&order=` | Stored scans (`sort`: date, id, name, detections, high, time) |
| GET | `/api/stats` | Dashboard aggregates computed from stored scans |
| GET | `/api/samples`, `/api/samples/{name}/image` | Bundled SYNTHETIC demo scans |

## Metadata fields
`latitude`, `longitude` (image centre), `timestamp`, `heading` (0-360, 0 = north), `depth`, `ping_number`, `vehicle_id`, `survey_id`, `pixel_size_m`, `data_source` (`real` or `demo`).

## Detection object
```json
{
  "id": "ANM-001", "class": "Shipwreck", "confidence": 91.5, "confidence_level": "High",
  "bbox": {"x": 302, "y": 110, "width": 257, "height": 121}, "area": 21200,
  "estimated_dimensions": {"length_m": 25.0, "width_m": 8.9, "area_m2": 212.0, "scale_m_per_px": 0.1, "scale_source": "metadata"},
  "location": {"latitude": 13.060025, "longitude": 80.329675, "source": "demo", "label": "DEMO COORDINATES"},
  "segmentation": {"polygon": [[302, 110]]},
  "timestamp": "2026-09-21T06:10:00Z", "processing_mode": "demo_cv", "mode_label": "Demo / Classical CV"
}
```
`location.source` is `metadata`, `demo` or `unavailable` (latitude/longitude are then `null`). `confidence` is a heuristic score, not a probability.
