"""
Documents router: CRUD + PDF/DOCX upload + background ingestion.
Uses backend.state for shared in-memory storage accessible by all routers.
"""
import os
import uuid
from datetime import datetime
from pathlib import Path

import aiofiles
from fastapi import APIRouter, BackgroundTasks, File, HTTPException, UploadFile
import structlog

from ..models.document import DocumentCreate, IngestJob
from ..rag import ingestor, vector_store, sidecar as sidecar_mod
from .. import state

logger = structlog.get_logger()
router = APIRouter()

UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "./uploads"))


def _default_content(template: str) -> dict:
    headings = {
        "ieee": ["Abstract", "1. Introduction", "1.1 Background", "1.2 Related Work",
                 "2. Methodology", "2.1 Architecture", "2.2 Training Protocol",
                 "3. Results", "3.1 Benchmarks", "3.2 Ablation Study",
                 "4. Discussion", "5. Conclusion", "References"],
        "nature": ["Abstract", "Introduction", "Results", "Discussion", "Methods", "References"],
        "apa": ["Abstract", "Introduction", "Method", "Results", "Discussion", "Conclusion", "References"],
        "blank": [],
    }
    content = []
    for h in headings.get(template, []):
        level = 1 if not h[0].isdigit() or "." not in h else (2 if h.count(".") == 1 else 3)
        content.extend([
            {"type": "heading", "attrs": {"level": level}, "content": [{"type": "text", "text": h}]},
            {"type": "paragraph", "content": []},
        ])
    if not content:
        content.append({"type": "paragraph", "content": []})
    return {"type": "doc", "content": content}


@router.post("/documents")
async def create_document(body: DocumentCreate):
    doc_id = str(uuid.uuid4())
    content = _default_content(body.template)
    doc = state.create_document(doc_id, body.title, body.template, content)
    logger.info("document_created", doc_id=doc_id, template=body.template)
    return {"id": doc_id, "template": body.template, "meta": doc["meta"]}


@router.get("/documents/{doc_id}")
async def get_document(doc_id: str):
    if doc_id not in state.documents:
        raise HTTPException(status_code=404, detail="Document not found")
    doc = state.documents[doc_id]
    ref_ids = state.get_doc_references(doc_id)
    refs = [state.references[r] for r in ref_ids if r in state.references]
    return {**doc, "references_detail": refs}


@router.put("/documents/{doc_id}")
async def update_document(doc_id: str, body: dict):
    if doc_id not in state.documents:
        raise HTTPException(status_code=404, detail="Document not found")
    doc = state.documents[doc_id]
    if "content" in body:
        doc["content"] = body["content"]
    if "title" in body:
        doc["meta"]["title"] = body["title"]
    doc["meta"]["updated_at"] = datetime.utcnow().isoformat()
    doc["meta"]["word_count"] = body.get("word_count", doc["meta"].get("word_count", 0))
    return {"status": "saved", "updated_at": doc["meta"]["updated_at"]}


@router.delete("/documents/{doc_id}")
async def delete_document(doc_id: str):
    if doc_id not in state.documents:
        raise HTTPException(status_code=404, detail="Document not found")
    del state.documents[doc_id]
    for ref_id in state.doc_references.pop(doc_id, []):
        await vector_store.delete_document(ref_id)
        sidecar_mod.delete_sidecar(ref_id)
        state.remove_reference(ref_id)
    logger.info("document_deleted", doc_id=doc_id)
    return {"status": "deleted"}


@router.post("/documents/{doc_id}/upload")
async def upload_reference(doc_id: str, background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    if doc_id not in state.documents:
        raise HTTPException(status_code=404, detail="Document not found")
    suffix = Path(file.filename or "file.pdf").suffix.lower()
    if suffix not in (".pdf", ".docx", ".doc"):
        raise HTTPException(status_code=400, detail="Only PDF and DOCX files are supported")

    ref_id = str(uuid.uuid4())
    job_id = str(uuid.uuid4())
    UPLOAD_DIR.mkdir(exist_ok=True)
    dest = UPLOAD_DIR / f"{ref_id}{suffix}"

    async with aiofiles.open(dest, "wb") as f:
        await f.write(await file.read())

    state.create_ingest_job(job_id, doc_id, ref_id, file.filename or "upload")

    async def _run():
        try:
            state.update_ingest_job(job_id, status="processing", stage="Extracting text...", progress=0.1)
            ref = await ingestor.ingest_document(dest, doc_id, ref_id)
            ref_dict = ref.model_dump(mode="json")
            state.register_reference(ref_id, ref_dict)
            state.add_reference_to_doc(doc_id, ref_id)
            state.complete_ingest_job(job_id, ref_dict)
            logger.info("ingest_complete", job_id=job_id)
        except Exception as e:
            logger.error("ingest_failed", job_id=job_id, error=str(e))
            state.update_ingest_job(job_id, status="error", error=str(e))

    background_tasks.add_task(_run)
    return {"job_id": job_id, "ref_id": ref_id, "filename": file.filename, "status": "pending"}


@router.get("/documents/{doc_id}/references/status/{job_id}")
async def get_ingest_status(doc_id: str, job_id: str):
    if job_id not in state.ingest_jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    return state.ingest_jobs[job_id]


@router.delete("/documents/{doc_id}/citations/{citation_id}")
async def remove_citation(doc_id: str, citation_id: str):
    sidecar_mod.remove_inferences_for_paragraph(citation_id)
    return {"status": "removed", "citation_id": citation_id}
