import csv
import io
import json
import time
from pathlib import Path

import numpy as np

from tests.conftest import SAMPLES

META = json.loads((SAMPLES / "sample_metadata.json").read_text())["sample_sonar_01.png"]
META = {k: v for k, v in META.items() if k != "description"}


def _upload(client, data, name="sample_sonar_01.png", url="/api/detect", **form):
    return client.post(url, files={"file": (name, data, "image/png")}, data=form)


def test_health_is_real(client):
    r = client.get("/api/health").json()
    assert r["mode"] == "DEMO" and r["model_type"] == "demo_cv"
    assert {c["name"] for c in r["components"]} >= {"API", "Inference engine", "Image processing", "Storage (SQLite)"}
    assert all(c["status"] == "ok" for c in r["components"])


def test_detect_returns_structured_result(client, sample_bytes):
    r = _upload(client, sample_bytes, metadata=json.dumps(META))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "completed" and body["processing_mode"] == "demo_cv"
    assert body["scan_id"].startswith("SCAN-") and body["image"]["width"] == 1400
    assert len(body["detections"]) >= 5
    d = body["detections"][0]
    assert {"id", "class", "confidence", "confidence_level", "bbox", "location", "estimated_dimensions"} <= d.keys()
    assert d["confidence_level"] in ("High", "Medium", "Low") and 0 <= d["confidence"] <= 100
    assert d["location"]["source"] == "demo" and d["location"]["label"] == "DEMO COORDINATES"
    assert "not a statistical probability" in body["disclaimer"]


def test_confidence_levels_match_spec():
    from app.services.confidence import level_for
    assert [level_for(v) for v in (100, 80, 79.9, 60, 59.9, 0)] == ["High", "High", "Medium", "Medium", "Low", "Low"]


def test_detection_recall_against_synthetic_truth(client, sample_bytes):
    """The synthetic generator knows where its objects are; the classical CV should find (nearly) all of them."""
    truth = json.loads((SAMPLES / "sample_ground_truth.json").read_text())["sample_sonar_01.png"]
    dets = _upload(client, sample_bytes).json()["detections"]

    def iou(a, b):
        ax, ay, aw, ah = a; bx, by, bw, bh = b
        ix = max(0, min(ax + aw, bx + bw) - max(ax, bx)); iy = max(0, min(ay + ah, by + bh) - max(ay, by))
        inter = ix * iy
        return inter / (aw * ah + bw * bh - inter)

    found = sum(any(iou(t["bbox"], [d["bbox"][k] for k in ("x", "y", "width", "height")]) > 0.4 for d in dets) for t in truth)
    assert found >= len(truth) - 1, f"only {found}/{len(truth)} synthetic objects found"
    assert len(dets) <= len(truth) + 3, "too many false positives"


def test_without_metadata_location_can_be_unavailable(client, sample_bytes):
    body = _upload(client, sample_bytes, demo_coordinates="false").json()
    assert all(d["location"]["latitude"] is None and d["location"]["label"] == "Location unavailable" for d in body["detections"])
    assert body["summary"]["coordinates_available"] is False


def test_geotag_projection_geometry():
    from app.models.schemas import SurveyMetadata
    from app.services.geotagging import locate
    m = SurveyMetadata(latitude=10.0, longitude=20.0, heading=0, pixel_size_m=1.0)
    # 111 px ahead (increasing y) with heading north => ~0.001 deg north; nadir column => no east offset
    loc = locate(700, 400 + 111.32, 1400, 800, 700, 1.0, m, False)
    assert abs(loc.latitude - 10.001) < 1e-4 and abs(loc.longitude - 20.0) < 1e-6 and loc.source == "metadata"
    # starboard (x > nadir) with heading north => east
    loc = locate(800, 400, 1400, 800, 700, 1.0, m, False)
    assert loc.longitude > 20.0 and abs(loc.latitude - 10.0) < 1e-6


def test_reports_json_and_csv(client, sample_bytes):
    sid = _upload(client, sample_bytes, metadata=json.dumps(META)).json()["scan_id"]
    j = client.get(f"/api/report/{sid}/json")
    assert j.status_code == 200 and "attachment" in j.headers["content-disposition"]
    rep = j.json()
    assert rep["scan_id"] == sid and rep["image_name"] == "sample_sonar_01.png" and rep["detections"]
    c = client.get(f"/api/report/{sid}/csv")
    rows = list(csv.reader(io.StringIO(c.text)))
    assert rows[0][:12] == ["ID", "Class", "Confidence", "Confidence Level", "Latitude", "Longitude", "X", "Y",
                            "Width", "Height", "Estimated Area", "Timestamp"]
    assert len(rows) - 1 == len(rep["detections"])


def test_history_and_stats_and_detections_endpoint(client, sample_bytes):
    sid = _upload(client, sample_bytes).json()["scan_id"]
    hist = client.get("/api/history", params={"search": sid}).json()
    assert hist and hist[0]["scan_id"] == sid and hist[0]["status"] == "completed"
    assert client.get(f"/api/detections/{sid}").json()["scan_id"] == sid
    st = client.get("/api/stats").json()
    assert st["total_scans"] >= 1 and sum(st["by_level"].values()) == st["total_detections"]
    assert client.get(f"/api/scans/{sid}/image", params={"variant": "enhanced"}).headers["content-type"] == "image/png"


def test_async_analyze_with_status_polling(client, sample_bytes):
    acc = _upload(client, sample_bytes, url="/api/analyze")
    assert acc.status_code == 202
    sid = acc.json()["scan_id"]
    for _ in range(100):
        st = client.get(f"/api/scans/{sid}/status").json()
        if st["status"] != "processing":
            break
        time.sleep(0.1)
    assert st["status"] == "completed" and st["progress"] == 100
    assert client.get(f"/api/detections/{sid}").status_code == 200


def test_errors_are_friendly(client, sample_bytes):
    r = _upload(client, b"not an image at all", name="x.png")
    assert r.status_code == 422 and r.json()["error"]["code"] == "invalid_image" and "Traceback" not in r.text
    assert _upload(client, b"GIF89a", name="x.gif").status_code == 415
    assert _upload(client, b"0" * (3 * 1024 * 1024), name="big.png").status_code == 413
    assert _upload(client, sample_bytes, metadata='{"latitude": 999}').json()["error"]["code"] == "invalid_metadata"
    assert client.get("/api/detections/SCAN-2026-9999").status_code == 404
    assert client.get("/api/detections/..%2F..%2Fetc%2Fpasswd").status_code in (400, 404)
    assert client.get("/api/scans/SCAN-1/image").status_code == 400
    assert client.get("/api/samples/..%2F..%2Fsecret.png/image").status_code == 404


def test_metadata_endpoint_and_reference(client, sample_bytes):
    r = client.post("/api/metadata", json=META)
    assert r.status_code == 200
    mid = r.json()["metadata_id"]
    body = _upload(client, sample_bytes, metadata_id=mid).json()
    assert body["metadata"]["survey_id"] == META["survey_id"]
    assert client.post("/api/metadata", json={"latitude": 120}).status_code == 422


def test_samples_listing(client):
    s = client.get("/api/samples").json()
    assert [x["name"] for x in s] == ["sample_sonar_01.png", "sample_sonar_02.png"] and all(x["synthetic"] for x in s)
    assert client.get("/api/samples/sample_sonar_02.png/image").status_code == 200


def test_preprocessing_handles_formats_and_sizes(client):
    import cv2
    img = (np.random.rand(3000, 2200) * 255).astype(np.uint8)
    for ext, mime in ((".jpg", "image/jpeg"), (".tif", "image/tiff")):
        ok, buf = cv2.imencode(ext, img)
        r = client.post("/api/detect", files={"file": (f"big{ext}", buf.tobytes(), mime)})
        if r.status_code == 413:  # noise images compress poorly; the size limit itself is tested above
            continue
        assert r.status_code == 200, r.text
        info = r.json()["image"]
        assert max(info["width"], info["height"]) <= 1600 and info["resized"] and info["original_height"] == 3000
