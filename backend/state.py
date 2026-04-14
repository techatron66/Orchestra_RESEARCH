"""
Shared in-memory state for all routers.
Single source of truth — avoids broken cross-router imports of module-level dicts.

All routers import from here so mutations are always visible everywhere.
"""
import uuid
from datetime import datetime
from typing import Optional

# ── Documents ──────────────────────────────────────────────────────────────────
# doc_id → { meta: {...}, content: {...}, references: [ref_id, ...] }
documents: dict[str, dict] = {}

# ── References ─────────────────────────────────────────────────────────────────
# ref_id → Reference.model_dump(mode="json")
references: dict[str, dict] = {}

# doc_id → [ref_id, ...]
doc_references: dict[str, list[str]] = {}

# ── Ingest jobs ────────────────────────────────────────────────────────────────
# job_id → IngestJob dict
ingest_jobs: dict[str, dict] = {}


# ── Helpers ────────────────────────────────────────────────────────────────────
def create_document(doc_id: str, title: str, template: str, content: dict) -> dict:
    now = datetime.utcnow().isoformat()
    doc = {
        "meta": {
            "id": doc_id,
            "title": title,
            "template": template,
            "created_at": now,
            "updated_at": now,
            "word_count": 0,
            "citation_count": 0,
            "references": [],
        },
        "content": content,
        "references": [],
    }
    documents[doc_id] = doc
    doc_references[doc_id] = []
    return doc


def get_doc_references(doc_id: str) -> list[str]:
    return doc_references.get(doc_id, [])


def add_reference_to_doc(doc_id: str, ref_id: str):
    if doc_id not in doc_references:
        doc_references[doc_id] = []
    if ref_id not in doc_references[doc_id]:
        doc_references[doc_id].append(ref_id)
    if doc_id in documents:
        documents[doc_id]["references"] = doc_references[doc_id]
        documents[doc_id]["meta"]["references"] = doc_references[doc_id]


def register_reference(ref_id: str, ref_dict: dict):
    references[ref_id] = ref_dict


def remove_reference(ref_id: str):
    references.pop(ref_id, None)
    for doc_id in doc_references:
        if ref_id in doc_references[doc_id]:
            doc_references[doc_id].remove(ref_id)


def create_ingest_job(job_id: str, doc_id: str, ref_id: str, filename: str) -> dict:
    job = {
        "job_id": job_id,
        "document_id": doc_id,
        "ref_id": ref_id,
        "filename": filename,
        "status": "pending",
        "progress": 0.0,
        "stage": "Queued",
        "reference": None,
        "error": None,
    }
    ingest_jobs[job_id] = job
    return job


def update_ingest_job(job_id: str, **kwargs):
    if job_id in ingest_jobs:
        ingest_jobs[job_id].update(kwargs)


def complete_ingest_job(job_id: str, ref_dict: dict):
    if job_id in ingest_jobs:
        ingest_jobs[job_id]["status"] = "complete"
        ingest_jobs[job_id]["progress"] = 1.0
        ingest_jobs[job_id]["stage"] = "Complete"
        ingest_jobs[job_id]["reference"] = ref_dict
