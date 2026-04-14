"""
Sidecar manager: every reference document gets a .json sidecar tracking
which claims it contributed to the research document, and their verification status.
"""
import json
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional
import structlog

logger = structlog.get_logger()

SIDECAR_DIR = os.getenv("SIDECAR_DIR", "./sidecars")


def _sidecar_path(ref_id: str) -> Path:
    return Path(SIDECAR_DIR) / f"{ref_id}.json"


def create_sidecar(ref_id: str, meta: dict):
    """Initialize a sidecar file for a reference document."""
    path = _sidecar_path(ref_id)
    data = {
        "reference_id": ref_id,
        "filename": meta.get("filename", ""),
        "metadata": meta,
        "inferences": [],
        "created_at": datetime.utcnow().isoformat(),
    }
    path.write_text(json.dumps(data, indent=2))
    logger.info("sidecar_created", ref_id=ref_id)


def add_inference(ref_id: str, document_id: str, paragraph_id: str,
                  claim: str, source_chunk_index: int, source_text: str,
                  verified_by: str, confidence: float) -> dict:
    """Append an inference record to the sidecar."""
    path = _sidecar_path(ref_id)
    if not path.exists():
        logger.warning("sidecar_not_found", ref_id=ref_id)
        return {}

    data = json.loads(path.read_text())
    inference = {
        "inference_id": str(uuid.uuid4()),
        "document_id": document_id,
        "paragraph_id": paragraph_id,
        "claim": claim,
        "source_chunk_index": source_chunk_index,
        "source_text": source_text,
        "verified_by": verified_by,
        "confidence": confidence,
        "status": "verified",
        "timestamp": datetime.utcnow().isoformat(),
    }
    data["inferences"].append(inference)
    path.write_text(json.dumps(data, indent=2))
    return inference


def remove_inferences_for_paragraph(paragraph_id: str):
    """
    Called when a paragraph is deleted.
    Flags all inferences linked to that paragraph as 'unverified'.
    Scans all sidecars (no index needed at this scale).
    """
    sidecar_dir = Path(SIDECAR_DIR)
    if not sidecar_dir.exists():
        return

    for path in sidecar_dir.glob("*.json"):
        try:
            data = json.loads(path.read_text())
            modified = False
            for inf in data["inferences"]:
                if inf.get("paragraph_id") == paragraph_id and inf.get("status") == "verified":
                    inf["status"] = "unverified"
                    inf["unverified_at"] = datetime.utcnow().isoformat()
                    modified = True
            if modified:
                path.write_text(json.dumps(data, indent=2))
        except Exception as e:
            logger.warning("sidecar_remove_error", path=str(path), error=str(e))


def get_inferences_for_paragraph(paragraph_id: str) -> list[dict]:
    """Return all inference records linked to a paragraph, across all sidecars."""
    results = []
    sidecar_dir = Path(SIDECAR_DIR)
    if not sidecar_dir.exists():
        return results

    for path in sidecar_dir.glob("*.json"):
        try:
            data = json.loads(path.read_text())
            for inf in data["inferences"]:
                if inf.get("paragraph_id") == paragraph_id:
                    inf["reference_filename"] = data.get("filename", "")
                    results.append(inf)
        except Exception as e:
            logger.warning("sidecar_read_error", path=str(path), error=str(e))

    results.sort(key=lambda x: x.get("timestamp", ""))
    return results


def get_sidecar(ref_id: str) -> Optional[dict]:
    """Read a sidecar file."""
    path = _sidecar_path(ref_id)
    if not path.exists():
        return None
    return json.loads(path.read_text())


def delete_sidecar(ref_id: str):
    """Delete a sidecar file."""
    path = _sidecar_path(ref_id)
    if path.exists():
        path.unlink()
        logger.info("sidecar_deleted", ref_id=ref_id)
