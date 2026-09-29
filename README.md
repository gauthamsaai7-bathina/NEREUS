# NEREUS - Intelligent Sonar. Safer Seas.

Prototype for the problem statement **AI-Powered Automated Underwater Marine Debris and Anomaly Detection System using Side-Scan Sonar Imagery**.

> **Read this first.** No trained model or real sonar data is bundled. The default engine is a clearly labelled **Demo / Classical CV** detector (CLAHE, denoising, thresholding, contours, shadow analysis) running on **synthetic** sonar images. Its classes are heuristic guesses, its confidence is a heuristic score (not a probability), and nothing here is scientifically validated. The pipeline is built so a trained YOLO/segmentation model can replace the demo engine (see Model integration).

## Features
Upload/drag-drop sonar images (PNG, JPG, TIFF) · preprocessing (median/Gaussian, gain flattening, CLAHE, unsharp) · candidate detection · explainable noise filtering · confidence scoring (High >= 80, Medium 60-79, Low < 60) · bounding boxes + segmentation outlines · zoom/pan/fullscreen viewer with original/enhanced toggle · metadata-based geotagging · Leaflet anomaly map · SQLite history · JSON/CSV reports and printable report · live processing stages · real system health · simulated live view (labelled) · demo/live mode indicator.

## Architecture
React + TypeScript SPA -> `src/services/api.ts` (Axios) -> FastAPI -> preprocessing -> `DetectionModel` -> noise filter -> confidence -> geotagging -> SQLite + PNG files. Details in `docs/architecture.md`; endpoints in `docs/api.md`.

## Technology
Frontend: React 18, TypeScript, Vite, Tailwind CSS, React Router, Recharts, React-Leaflet, Axios, Framer Motion, Lucide.
Backend: Python, FastAPI, Uvicorn, Pydantic, OpenCV, NumPy, Pillow, scikit-image, pandas, scikit-learn, SQLite.

## Folder structure
```
NEREUS/
  frontend/   React app (src/pages, components, services, context)
  backend/    FastAPI app (app/api, services, models, utils), tests/, models/, outputs/
  sample_data/ synthetic sonar images, metadata, generator, ground truth (tests only)
  docs/       architecture.md, api.md, demo.md
  start.bat   one-click Windows launcher
```

## Requirements
Windows 10/11, **Python 3.10+** (tick "Add to PATH"), **Node.js 18+**. Internet is needed once for installing packages. The map base tiles need internet; turn them off in Settings for a fully offline demo (markers still render).

## Quick start (Windows)
Double-click `start.bat` (or run it from Command Prompt). It creates the venv, installs everything, starts both servers and opens the browser.

## Manual setup (Command Prompt)
Backend:
```
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --port 8000
```
Frontend (second window):
```
cd frontend
npm install
copy .env.example .env
npm run dev
```
| Item | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend | http://localhost:8000 |
| Swagger | http://localhost:8000/docs |
| Demo login | `operator@nereus.demo` / `nereus2026` (UI-only sign-in; the API has no auth) |

## Demo workflow
Login -> Sonar Analysis -> **Load Demo Scan** -> **Analyze** -> click a detection -> Anomaly Map -> Reports (JSON/CSV) -> System Health. Full script: `docs/demo.md`.

## Regenerating sample data
```
cd sample_data
python generate_sample_data.py
```
Needs `numpy` and `opencv-python-headless` (installed with the backend requirements).

## Model integration (YOLO / U-Net)
1. Train a detector or segmenter on labelled side-scan sonar data (for example Ultralytics YOLOv8/YOLO11, detect or segment).
2. Copy the weights to `backend/models/nereus_yolo.pt`.
3. `pip install ultralytics`, then in `backend/.env` set `MODEL_TYPE=yolo` and `MODEL_PATH=models/nereus_yolo.pt`.
4. Edit `YOLOModel.CLASS_MAP` in `backend/app/services/model_adapter.py` to map your training labels to the NEREUS classes.
5. Restart. `/api/health` reports mode LIVE when the model loads; if it cannot load, the API stays in DEMO mode and shows a warning.
For a different architecture (U-Net etc.) subclass `DetectionModel`, implement `predict(prep) -> list[Candidate]`, and register it in `get_model()`. Noise filtering, scoring, geotagging, storage and reports need no change. **The YOLO adapter was not run here because no weights exist; test it with your model.**

## Testing
```
cd backend
venv\Scripts\activate
python -m pytest -q
```
13 tests cover health, upload, validation and errors, detection recall against the synthetic ground truth, geotag geometry, async status flow, JSON/CSV reports, history/stats, metadata and path-traversal checks. Frontend: `cd frontend && npm run build` type-checks and builds.

## Known limitations
- Demo detector is tuned on synthetic images; real sonar (rocks, ripples, tow-fish motion) will produce different false positives and misses. Class labels are heuristics.
- Confidence is heuristic, not calibrated. Dimensions use an assumed 0.10 m/pixel unless metadata gives `pixel_size_m` (labelled "assumed").
- Geotagging assumes the nadir is the centre column and a flat-earth projection; real XTF/JSF data would need slant-range correction and proper navigation.
- No XTF/JSF ingestion; images only. TIFF previews are not shown before analysis (browsers cannot render them) but are processed.
- Demo login is UI-only. The API has no authentication; do not expose it publicly.
- Live Detection is a simulation that replays a stored scan.
- One process, thread-based jobs, SQLite; not built for concurrent multi-user load.
- The browser UI was type-checked, built and served, and the full API flow was exercised over HTTP with browser-style CORS requests, but it was not driven in a real browser in the build environment. Do a first click-through yourself before the jury.

## Future improvements
Trained detector + segmentation, XTF/JSF readers with slant-range correction, real navigation fusion, calibrated confidence, human review/label export, PostgreSQL, authentication, live sensor ingest.
