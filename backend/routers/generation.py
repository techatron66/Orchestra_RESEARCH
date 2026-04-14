"""
Generation router: SSE streaming + abort control.
Uses shared state module for document reference lookups.
"""
import asyncio
import json
import uuid
from typing import AsyncGenerator

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
import structlog

from ..models.generation import GenerationRequest
from ..agents.orchestrator import run_generation, trigger_abort
from .. import state

logger = structlog.get_logger()
router = APIRouter()


async def _event_stream(request: GenerationRequest, request_id: str) -> AsyncGenerator[str, None]:
    """Convert orchestrator generator events to SSE wire format."""
    doc_id = request.document_id
    ref_ids = state.get_doc_references(doc_id)

    try:
        async for event in run_generation(
            document_id=doc_id,
            section=request.section,
            instruction=request.instruction,
            context_paragraphs=request.context_paragraphs,
            mention_override=request.mention_override,
            request_id=request_id,
            doc_references=ref_ids,
        ):
            yield f"data: {json.dumps(event)}\n\n"
    except asyncio.CancelledError:
        yield f"data: {json.dumps({'event': 'aborted', 'data': {'partial': ''}})}\n\n"
    except Exception as e:
        logger.error("generation_stream_error", error=str(e))
        yield f"data: {json.dumps({'event': 'error', 'data': {'message': str(e)}})}\n\n"
    finally:
        yield f"data: {json.dumps({'event': 'stream_end', 'data': {}})}\n\n"


@router.post("/generate")
async def generate(request: GenerationRequest):
    """
    SSE endpoint. Events: thought | delta | ghost_complete | verified |
    flagged | image_ready | aborted | done | error | stream_end
    """
    request_id = request.request_id or str(uuid.uuid4())
    return StreamingResponse(
        _event_stream(request, request_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "X-Request-ID": request_id,
        },
    )


@router.post("/abort/{request_id}")
async def abort_generation(request_id: str):
    trigger_abort(request_id)
    logger.info("generation_aborted", request_id=request_id)
    return {"status": "aborted", "request_id": request_id}
