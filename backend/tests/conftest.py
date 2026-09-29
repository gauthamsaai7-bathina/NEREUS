"""Test setup: use a throwaway output folder, no pacing delay, and the demo model."""
import os
import sys
import tempfile
from pathlib import Path

_tmp = tempfile.mkdtemp(prefix="nereus_test_")
os.environ.update({"OUTPUT_DIR": _tmp, "DATABASE_PATH": str(Path(_tmp) / "test.db"),
                   "STAGE_PACING_MS": "0", "MODEL_TYPE": "demo", "MAX_UPLOAD_MB": "2"})
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="session")
def client():
    from app.main import app
    with TestClient(app) as c:
        yield c


SAMPLES = Path(__file__).resolve().parents[2] / "sample_data"


@pytest.fixture(scope="session")
def sample_bytes():
    return (SAMPLES / "sample_sonar_01.png").read_bytes()
