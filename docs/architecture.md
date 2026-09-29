# NEREUS architecture

```
Browser (React + TS)                     FastAPI backend                                   Storage
┌──────────────────────┐   multipart    ┌───────────────────────────────────────────┐   ┌──────────────┐
│ Sonar Analysis page  │ ─────────────► │ POST /api/analyze  (validate, 202 + id)   │   │ SQLite       │
│ services/api.ts only │                │   └ background thread: run_pipeline()     │──►│ scans,       │
│                      │ ◄── poll ───── │ GET  /api/scans/{id}/status (live stage)  │   │ metadata     │
│ ImageViewer, Map,    │ ◄── JSON ───── │ GET  /api/detections/{id}                 │   ├──────────────┤
│ Reports, History     │                │ GET  /api/report/{id}/json|csv            │   │ outputs/     │
└──────────────────────┘                └───────────────────────────────────────────┘   │ scans/<id>/  │
                                                                                         │ original.png │
Pipeline (backend/app/services)                                                          │ enhanced.png │
 ingest ─► preprocessing ─► model_adapter.predict ─► noise_filter ─► confidence ─► geotagging └──────────────┘
```

## Modules
| Module | Responsibility |
|---|---|
| `utils/image_utils.py` | Content-based validation (PNG/JPEG/TIFF), 16-bit TIFF scaling, decompression-bomb guard |
| `services/preprocessing.py` | Resize, median+Gaussian speckle suppression, per-column gain flattening, percentile stretch, CLAHE, unsharp mask |
| `services/model_adapter.py` | `DetectionModel` interface, `DemoCVModel` (classical CV), `YOLOModel` (optional) |
| `services/noise_filter.py` | Feature extraction and explainable rejection rules (rocks, ripples, ridges, artefacts, shadow-zone noise) |
| `services/confidence.py` | Weighted evidence score 0-100 and level mapping (High >= 80, Medium 60-79, Low < 60) |
| `services/geotagging.py` | Pixel to lat/lon projection using heading, pixel size and nadir position |
| `services/report_generator.py` | JSON and CSV reports |
| `services/storage.py` | SQLite persistence (stdlib `sqlite3`, portable SQL) |
| `services/jobs.py` | In-memory live stage tracking |

## Demo detector (classical CV)
1. Range-flattened, CLAHE-enhanced image -> Gaussian smoothing -> robust z-score (median/MAD).
2. Bright-return mask (z > 2.3), nadir strip excluded, morphological open/close.
3. Connected components -> contours -> features (area, oriented length/width, aspect, solidity, contour complexity, contrast, brightness ratio, hollow fraction, edge density, acoustic-shadow darkness swept away from the nadir).
4. Shape rules assign a heuristic class. Rules reject natural features with a stated reason.
5. Confidence blends return strength, shadow, size plausibility, structure and shape.

These labels are heuristics tuned on the bundled synthetic scans. They are not trained-model predictions and are not scientifically validated.

## Geometry assumptions
X is across-track with the nadir at the centre column (positive X = starboard); Y is along-track (increasing Y = later pings, ahead along the heading). One pixel size is used on both axes. Flat-earth projection, suitable for swaths of a few hundred metres. Real waterfall exports may differ; adjust `geotagging.locate`.

## Async flow
`/api/analyze` validates the file, stores a `processing` row, starts a worker thread and returns 202. The worker updates the stage tracker; `/status` reports it; the final `ScanResult` is written to SQLite. `STAGE_PACING_MS` (default 450) holds each stage on screen for demo legibility and is excluded from the reported processing time. `/api/detect` is the same pipeline run synchronously with no pacing.

## Security
Extension and content validation, size limit, sanitised display filenames, fixed storage file names (no user-controlled paths), scan-ID regex before any path is built, whitelisted sample names, CORS limited to configured origins with GET/POST only, generic error bodies (stack traces are logged, never returned). Demo login is UI-only; the API has no authentication.
