"""
References router: RAG source management, sidecar queries, web search.
Uses shared state module — no broken cross-router imports.
"""
from fastapi import APIRouter, HTTPException
import structlog

from ..rag import sidecar as sidecar_mod, vector_store, web_search
from .. import state

logger = structlog.get_logger()
router = APIRouter()


@router.get("/references/{doc_id}")
async def get_references(doc_id: str):
    """All references for a document."""
    ref_ids = state.get_doc_references(doc_id)
    return [state.references[r] for r in ref_ids if r in state.references]


@router.get("/references/{ref_id}/inferences/{paragraph_id}")
async def get_inferences(ref_id: str, paragraph_id: str):
    return sidecar_mod.get_inferences_for_paragraph(paragraph_id)


@router.get("/references/inferences/{paragraph_id}")
async def get_all_inferences(paragraph_id: str):
    return sidecar_mod.get_inferences_for_paragraph(paragraph_id)


@router.delete("/references/{ref_id}")
async def delete_reference(ref_id: str):
    await vector_store.delete_document(ref_id)
    sidecar_mod.delete_sidecar(ref_id)
    state.remove_reference(ref_id)
    logger.info("reference_deleted", ref_id=ref_id)
    return {"status": "deleted", "ref_id": ref_id}


@router.get("/references/{ref_id}/source/{chunk_index}")
async def get_source_chunk(ref_id: str, chunk_index: int):
    chunk = await vector_store.get_chunk(ref_id, chunk_index)
    if chunk is None:
        raise HTTPException(status_code=404, detail="Chunk not found")
    return {"ref_id": ref_id, "chunk_index": chunk_index, "text": chunk}


@router.post("/references/web-search")
async def web_search_papers(body: dict):
    topic = body.get("topic", "")
    n = body.get("n", 5)
    if not topic:
        raise HTTPException(status_code=400, detail="topic is required")
    results = await web_search.search_related_papers(topic, n=n)
    return {"results": results, "topic": topic}
