"""NEREUS API entry point. Run with: uvicorn app.main:app --reload"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api import routes_detection, routes_health, routes_metadata, routes_reports
from app.config import settings
from app.services import storage
from app.services.model_adapter import get_model

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("nereus")


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings.scans_dir.mkdir(parents=True, exist_ok=True)
    storage.init_db()
    m = get_model()
    log.info("NEREUS started. Inference engine: %s (%s)", m.name, m.type)
    yield


app = FastAPI(title="NEREUS API", version=settings.version, lifespan=lifespan,
              description="Intelligent Sonar. Safer Seas. Side-scan sonar anomaly detection prototype. "
                          "Default mode is DEMO (classical computer vision), not a validated AI model.")

app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_methods=["GET", "POST"],
                   allow_headers=["*"], expose_headers=["Content-Disposition"])


def _err(status: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status, content={"error": {"code": code, "message": message}})


@app.exception_handler(StarletteHTTPException)
async def http_error(_: Request, exc: StarletteHTTPException):
    d = exc.detail
    if isinstance(d, dict) and "code" in d:
        return _err(exc.status_code, d["code"], d["message"])
    return _err(exc.status_code, "http_error", str(d) if exc.status_code < 500 else "Request failed.")


@app.exception_handler(RequestValidationError)
async def validation_error(_: Request, exc: RequestValidationError):
    return _err(422, "invalid_request", "The request is missing required data or contains invalid values.")


@app.exception_handler(Exception)
async def unhandled(_: Request, exc: Exception):
    log.exception("Unhandled error")
    return _err(500, "internal_error", "An unexpected error occurred. Please try again.")


for r in (routes_health.router, routes_detection.router, routes_reports.router, routes_metadata.router):
    app.include_router(r)


@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse("/docs")
