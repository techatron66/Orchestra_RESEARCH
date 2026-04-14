"""
Document ingestion pipeline:
1. Extract text from PDF or DOCX
2. Extract metadata via GLM-5
3. Chunk with 512-token windows / 64-token overlap
4. Embed locally with sentence-transformers
5. Store in ChromaDB
6. Create sidecar
"""
import asyncio
import json
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

import httpx
import structlog

from . import vector_store, sidecar
from ..models.document import Reference

logger = structlog.get_logger()

NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY", "")
NVIDIA_BASE_URL = os.getenv("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1")
CHUNK_SIZE = 512
CHUNK_OVERLAP = 64


def _extract_pdf(file_path: Path) -> list[dict]:
    """Extract text from PDF, preserving page numbers."""
    try:
        import pypdf
        reader = pypdf.PdfReader(str(file_path))
        pages = []
        for i, page in enumerate(reader.pages):
            text = page.extract_text() or ""
            pages.append({"page": i + 1, "text": text.strip()})
        return pages
    except Exception as e:
        logger.error("pdf_extraction_failed", error=str(e))
        return []


def _extract_docx(file_path: Path) -> list[dict]:
    """Extract text from DOCX preserving paragraph structure."""
    try:
        from docx import Document
        doc = Document(str(file_path))
        pages = []
        current_text = []
        for para in doc.paragraphs:
            if para.text.strip():
                current_text.append(para.text.strip())
        pages.append({"page": 1, "text": "\n".join(current_text)})
        return pages
    except Exception as e:
        logger.error("docx_extraction_failed", error=str(e))
        return []


def _tokenize_and_chunk(pages: list[dict]) -> list[dict]:
    """Split pages into overlapping chunks using tiktoken."""
    try:
        import tiktoken
        enc = tiktoken.get_encoding("cl100k_base")
    except Exception:
        # Fallback: simple word-based chunking
        return _simple_chunk(pages)

    all_chunks = []
    for page_data in pages:
        text = page_data["text"]
        tokens = enc.encode(text)
        page_num = page_data["page"]

        i = 0
        chunk_idx = 0
        while i < len(tokens):
            chunk_tokens = tokens[i: i + CHUNK_SIZE]
            chunk_text = enc.decode(chunk_tokens)
            all_chunks.append({
                "text": chunk_text,
                "chunk_index": len(all_chunks),
                "page": page_num,
            })
            i += CHUNK_SIZE - CHUNK_OVERLAP
            chunk_idx += 1

    return all_chunks


def _simple_chunk(pages: list[dict]) -> list[dict]:
    """Fallback chunker using word count."""
    all_chunks = []
    for page_data in pages:
        words = page_data["text"].split()
        page_num = page_data["page"]
        i = 0
        while i < len(words):
            chunk_words = words[i: i + 400]
            chunk_text = " ".join(chunk_words)
            all_chunks.append({
                "text": chunk_text,
                "chunk_index": len(all_chunks),
                "page": page_num,
            })
            i += 400 - 50
    return all_chunks


async def _extract_metadata_nim(text_sample: str) -> dict:
    """Call GLM-5 via NVIDIA NIM to extract structured metadata."""
    system_prompt = (
        "Extract the following from the provided academic text and respond ONLY with valid JSON:\n"
        '{"doi": "...", "title": "...", "authors": [...], "year": ..., "journal": "...", '
        '"key_claims": ["claim 1", "claim 2", "claim 3"]}\n'
        "If a field cannot be found, use null. Key claims must be verbatim sentences from the abstract or conclusion."
    )

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{NVIDIA_BASE_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {NVIDIA_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "z-ai/glm-5",
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": text_sample[:4000]},
                    ],
                    "max_tokens": 800,
                    "temperature": 0.1,
                },
            )
            if resp.status_code == 200:
                content = resp.json()["choices"][0]["message"]["content"]
                # Strip markdown fences if present
                content = content.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
                return json.loads(content)
    except Exception as e:
        logger.warning("metadata_extraction_failed", error=str(e))

    return {
        "doi": None,
        "title": None,
        "authors": None,
        "year": None,
        "journal": None,
        "key_claims": [],
    }


async def ingest_document(file_path: Path, doc_id: str, ref_id: Optional[str] = None) -> Reference:
    """
    Full ingestion pipeline. Returns a Reference object.
    Runs CPU-heavy work in thread pool to avoid blocking event loop.
    """
    if ref_id is None:
        ref_id = str(uuid.uuid4())

    filename = file_path.name
    suffix = file_path.suffix.lower()

    logger.info("ingestion_start", filename=filename, doc_id=doc_id, ref_id=ref_id)

    # Step 1: Extract text
    if suffix == ".pdf":
        pages = await asyncio.to_thread(_extract_pdf, file_path)
    elif suffix in (".docx", ".doc"):
        pages = await asyncio.to_thread(_extract_docx, file_path)
    else:
        raise ValueError(f"Unsupported file type: {suffix}")

    if not pages:
        raise RuntimeError("Failed to extract text from document")

    full_text = " ".join(p["text"] for p in pages)

    # Step 2: Extract metadata via NIM
    meta = await _extract_metadata_nim(full_text[:6000])

    # Step 3: Chunk
    chunks = await asyncio.to_thread(_tokenize_and_chunk, pages)
    logger.info("chunking_complete", n_chunks=len(chunks))

    # Step 4: Store in ChromaDB
    documents = [c["text"] for c in chunks]
    metadatas = [
        {
            "source_doc": ref_id,
            "chunk_index": c["chunk_index"],
            "page": c["page"],
            "doc_id": doc_id,
        }
        for c in chunks
    ]
    ids = [f"{ref_id}_chunk_{c['chunk_index']}" for c in chunks]

    await vector_store.upsert_chunks(ref_id, documents, metadatas, ids)
    logger.info("vector_store_upsert_complete", ref_id=ref_id, n_chunks=len(chunks))

    # Step 5: Build Reference object
    reference = Reference(
        id=ref_id,
        filename=filename,
        doi=meta.get("doi"),
        title=meta.get("title") or filename,
        authors=meta.get("authors"),
        year=meta.get("year"),
        journal=meta.get("journal"),
        key_claims=meta.get("key_claims") or [],
        chunk_count=len(chunks),
        indexed_at=datetime.utcnow(),
    )

    # Step 6: Create sidecar
    sidecar_meta = {
        "filename": filename,
        "ref_id": ref_id,
        "doc_id": doc_id,
        **meta,
    }
    sidecar.create_sidecar(ref_id, sidecar_meta)

    logger.info("ingestion_complete", ref_id=ref_id, filename=filename)
    return reference
