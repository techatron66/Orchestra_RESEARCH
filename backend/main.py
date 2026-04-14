"""
Orchestra Research — FastAPI backend entry point.
"""
import os
from contextlib import asynccontextmanager
from pathlib import Path

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.routers import documents, generation, references, config as config_router, panel_debate

logger = structlog.get_logger()

# Get the backend directory (where main.py is located)
BACKEND_DIR = Path(__file__).parent

UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", str(BACKEND_DIR / "uploads")))
SIDECAR_DIR = Path(os.getenv("SIDECAR_DIR", str(BACKEND_DIR / "sidecars")))
CHROMA_DIR = Path(os.getenv("CHROMA_PERSIST_DIR", str(BACKEND_DIR / "chroma_db")))
STATIC_DIR = Path(os.getenv("STATIC_DIR", str(BACKEND_DIR / "static")))

# Create directories immediately (before app initialization)
for d in [UPLOAD_DIR, SIDECAR_DIR, CHROMA_DIR, STATIC_DIR]:
    d.mkdir(parents=True, exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("orchestra_research_started", env="development")
    yield
    logger.info("orchestra_research_shutdown")


app = FastAPI(
    title="Orchestra Research API",
    description="Multi-agent AI research authoring backend",
    version="1.0.0",
    lifespan=lifespan,
)

cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID"],
)

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

app.include_router(documents.router, prefix="/api", tags=["documents"])
app.include_router(generation.router, prefix="/api", tags=["generation"])
app.include_router(references.router, prefix="/api", tags=["references"])
app.include_router(config_router.router, prefix="/api", tags=["config"])
app.include_router(panel_debate.router, prefix="/api", tags=["debate"])


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "orchestra-research"}
