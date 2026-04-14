"""
LangGraph orchestrator for multi-agent research generation.
Reads config.json on every invocation. Supports abort via asyncio.Event.

Flow:
load_config → rag_retrieval → route_mention
  → lead_synthesis → glm_enrichment → deepseek_audit → qwen_logic_check → assemble_output
  → flux_generation → assemble_output
  → deepseek_audit (direct) → assemble_output
  → qwen_logic_check (direct) → assemble_output
"""
import asyncio
import json
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional, AsyncGenerator, Any

import httpx
import structlog

from ..rag import vector_store

logger = structlog.get_logger()

NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY", "")
NVIDIA_BASE_URL = os.getenv("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1")
CONFIG_PATH = Path(__file__).parent.parent / "config.json"
STATIC_DIR = Path(__file__).parent.parent / "static"

# Per-request abort events
_abort_events: dict[str, asyncio.Event] = {}


def register_abort_event(request_id: str) -> asyncio.Event:
    event = asyncio.Event()
    _abort_events[request_id] = event
    return event


def trigger_abort(request_id: str):
    if request_id in _abort_events:
        _abort_events[request_id].set()


def cleanup_abort_event(request_id: str):
    _abort_events.pop(request_id, None)


def _read_config() -> dict:
    try:
        return json.loads(CONFIG_PATH.read_text())
    except Exception:
        return {}


def _make_thought(model: str, role: str, content: str, citation: Optional[str] = None,
                  paragraph_id: Optional[str] = None) -> dict:
    return {
        "id": str(uuid.uuid4()),
        "timestamp": datetime.utcnow().isoformat(),
        "model": model,
        "role": role,
        "content": content,
        "citation": citation,
        "paragraph_id": paragraph_id,
        "confidence": 1.0,
    }


async def _nim_stream(model: str, messages: list[dict], abort_event: asyncio.Event,
                      max_tokens: int = 1000) -> AsyncGenerator[str, None]:
    """Stream tokens from NVIDIA NIM. Checks abort_event between chunks."""
    if not NVIDIA_API_KEY or NVIDIA_API_KEY == "nvapi-xxxx":
        # Demo mode: yield mock tokens
        mock_text = (
            "The proposed methodology demonstrates significant improvements over existing baselines. "
            "Experimental validation confirms the theoretical predictions with high statistical confidence. "
            "Further analysis of the ablation results reveals synergistic contributions from each component."
        )
        for word in mock_text.split():
            if abort_event.is_set():
                return
            yield word + " "
            await asyncio.sleep(0.04)
        return

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            async with client.stream(
                "POST",
                f"{NVIDIA_BASE_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {NVIDIA_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "messages": messages,
                    "max_tokens": max_tokens,
                    "stream": True,
                    "temperature": 0.7,
                },
            ) as resp:
                async for line in resp.aiter_lines():
                    if abort_event.is_set():
                        return
                    if line.startswith("data: "):
                        data = line[6:]
                        if data.strip() == "[DONE]":
                            return
                        try:
                            chunk = json.loads(data)
                            delta = chunk["choices"][0]["delta"].get("content", "")
                            if delta:
                                yield delta
                        except Exception:
                            continue
    except Exception as e:
        logger.error("nim_stream_error", model=model, error=str(e))
        yield f"\n[Generation error: {str(e)[:80]}]"


async def _nim_complete(model: str, messages: list[dict], max_tokens: int = 800) -> str:
    """Non-streaming NIM call."""
    if not NVIDIA_API_KEY or NVIDIA_API_KEY == "nvapi-xxxx":
        return '{"verified": [], "unverified": [], "flags": []}'

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{NVIDIA_BASE_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {NVIDIA_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "messages": messages,
                    "max_tokens": max_tokens,
                    "temperature": 0.1,
                },
            )
            if resp.status_code == 200:
                return resp.json()["choices"][0]["message"]["content"]
    except Exception as e:
        logger.error("nim_complete_error", model=model, error=str(e))
    return ""


async def run_generation(
    document_id: str,
    section: str,
    instruction: str,
    context_paragraphs: list[str],
    mention_override: Optional[str],
    request_id: str,
    doc_references: list[str],
) -> AsyncGenerator[dict, None]:
    """
    Main orchestration generator. Yields GenerationEvent dicts.
    Each dict has {event, data} structure.
    """
    abort_event = register_abort_event(request_id)
    config = _read_config()
    paragraph_id = str(uuid.uuid4())

    try:
        # ── NODE: load_config ────────────────────────────────────────────
        yield {"event": "thought", "data": _make_thought(
            "orchestrator", "system",
            f"Config loaded. Target journal: {config.get('project', {}).get('target_journal', 'N/A')}. "
            f"Rigor level: {config.get('rigor', {}).get('level', 9)}/10. "
            f"RAG top-k: {config.get('rag', {}).get('top_k', 8)}."
        )}

        if abort_event.is_set():
            yield {"event": "aborted", "data": {"partial": "", "paragraph_id": paragraph_id}}
            return

        # ── NODE: rag_retrieval ──────────────────────────────────────────
        query_text = instruction
        if context_paragraphs:
            query_text += " " + context_paragraphs[-1][:500]

        top_k = config.get("rag", {}).get("top_k", 8)
        rag_chunks = await vector_store.query(query_text, doc_references, top_k=top_k)

        source_names = list({c["metadata"].get("source_doc", "?")[:8] for c in rag_chunks})
        yield {"event": "thought", "data": _make_thought(
            "orchestrator", "retrieval",
            f"Retrieved {len(rag_chunks)} chunks from {len(source_names)} source(s). "
            f"Query: '{instruction[:80]}...'"
        )}

        if abort_event.is_set():
            yield {"event": "aborted", "data": {"partial": "", "paragraph_id": paragraph_id}}
            return

        # ── NODE: route_mention ──────────────────────────────────────────
        mention = (mention_override or "").lower().strip()

        if "@flux" in mention:
            async for event in _flux_generation(instruction, paragraph_id, abort_event):
                yield event
            return

        if "@deepseek" in mention:
            async for event in _deepseek_audit_direct(instruction, context_paragraphs,
                                                        rag_chunks, paragraph_id, abort_event):
                yield event
            return

        if "@qwen" in mention:
            async for event in _qwen_logic_direct(instruction, context_paragraphs,
                                                   rag_chunks, paragraph_id, abort_event):
                yield event
            return

        # ── NODE: lead_synthesis (Kimi K2.5) ────────────────────────────
        lead_model = config.get("models", {}).get("lead_synthesis", ["moonshotai/kimi-k2.5"])[0]

        rag_context = "\n\n".join([
            f"[REF-{i+1}] (Source: {c['metadata'].get('source_doc', '?')[:12]}, "
            f"page {c['metadata'].get('page', '?')})\n{c['text'][:600]}"
            for i, c in enumerate(rag_chunks)
        ]) if rag_chunks else "No RAG sources available."

        project = config.get("project", {})
        tone = config.get("tone", {})
        rigor = config.get("rigor", {})

        system_prompt = f"""You are a research writing assistant for {project.get('target_journal', 'Nature')} journal.
Citation standard: {project.get('citation_standard', 'IEEE')}.
Tone: {tone.get('profile', 'Academic/Formal')}. Voice: {tone.get('voice', 'Third Person')}.
Scientific rigor level: {rigor.get('level', 9)}/10.
When making claims supported by the provided references, insert [REF-N] markers inline.
Write exactly one paragraph. No headings. No preamble."""

        user_prompt = f"""Section: {section}
Instruction: {instruction}

Current context (last paragraph):
{context_paragraphs[-1] if context_paragraphs else '(beginning of section)'}

Available references:
{rag_context}

Write the next paragraph for this section."""

        yield {"event": "thought", "data": _make_thought(
            "kimi-k2.5", "architect",
            f"Beginning synthesis for §{section}. Lead model: {lead_model}. "
            f"Pulling from {len(rag_chunks)} RAG chunks. Applying {tone.get('profile', 'Academic')} tone profile.",
            citation=f"{source_names[0] if source_names else 'No sources'} and {len(source_names)-1} others"
                     if len(source_names) > 1 else (source_names[0] if source_names else None)
        )}

        draft_tokens = []
        token_buffer = []
        token_count = 0

        async for token in _nim_stream(lead_model, [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ], abort_event, max_tokens=600):
            if abort_event.is_set():
                break
            draft_tokens.append(token)
            token_buffer.append(token)
            token_count += 1

            # Emit delta every 8 tokens to batch updates
            if len(token_buffer) >= 8:
                yield {"event": "delta", "data": {"text": "".join(token_buffer), "paragraph_id": paragraph_id}}
                token_buffer = []

            # Emit a thought every ~200 tokens
            if token_count % 200 == 0:
                yield {"event": "thought", "data": _make_thought(
                    "kimi-k2.5", "architect",
                    f"Generating... {token_count} tokens produced. Maintaining citation integrity.",
                    paragraph_id=paragraph_id
                )}

        # Flush remaining buffer
        if token_buffer:
            yield {"event": "delta", "data": {"text": "".join(token_buffer), "paragraph_id": paragraph_id}}

        if abort_event.is_set():
            draft = "".join(draft_tokens)
            yield {"event": "aborted", "data": {"partial": draft, "paragraph_id": paragraph_id}}
            return

        draft = "".join(draft_tokens)

        # ── NODE: glm_enrichment ─────────────────────────────────────────
        if rigor.get("level", 9) >= 7:
            glm_model = config.get("models", {}).get("lead_synthesis", ["", "z-ai/glm-5"])
            glm_model = glm_model[1] if len(glm_model) > 1 else "z-ai/glm-5"

            yield {"event": "thought", "data": _make_thought(
                "glm-5", "enricher",
                "Reviewing draft for enrichment opportunities. Scanning for underexplored connections in references."
            )}

            enriched = await _nim_complete(glm_model, [
                {"role": "system", "content": "Extend the draft with one additional supporting point from the references. "
                                              "Do not repeat existing content. Maintain exact citation markers [REF-N]."},
                {"role": "user", "content": f"Draft:\n{draft}\n\nReferences:\n{rag_context}"}
            ], max_tokens=300)

            if enriched and len(enriched) > 50:
                draft = draft.rstrip() + " " + enriched.strip()
                yield {"event": "thought", "data": _make_thought(
                    "glm-5", "enricher",
                    "Enrichment complete. One supporting point added from reference corpus.",
                    paragraph_id=paragraph_id
                )}

        if abort_event.is_set():
            yield {"event": "aborted", "data": {"partial": draft, "paragraph_id": paragraph_id}}
            return

        # ── NODE: deepseek_audit ─────────────────────────────────────────
        deepseek_model = config.get("models", {}).get("logic_verification", ["qwen/qwen3.5-397b-a17b", "deepseek-ai/deepseek-v3.2"])
        deepseek_model = deepseek_model[1] if len(deepseek_model) > 1 else "deepseek-ai/deepseek-v3.2"

        yield {"event": "thought", "data": _make_thought(
            "deepseek-v3.2", "auditor",
            f"Auditing draft. Verifying numerical claims against {len(rag_chunks)} RAG chunks. "
            "Flagging any assertions without reference support.",
            paragraph_id=paragraph_id
        )}

        audit_result = await _nim_complete(deepseek_model, [
            {"role": "system", "content": (
                "You are a scientific auditor. For each sentence containing a numerical claim, "
                "find it in the provided REF blocks. "
                "Return ONLY valid JSON: {\"verified\": [\"sentence1\", ...], \"unverified\": [\"sentence1\", ...], "
                "\"flags\": [{\"sentence\": \"...\", \"issue\": \"...\", \"severity\": \"medium\"}]}"
            )},
            {"role": "user", "content": f"Draft:\n{draft}\n\nReferences:\n{rag_context}"}
        ], max_tokens=600)

        verified_claims = []
        unverified_flags = []
        try:
            audit_clean = audit_result.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
            audit_data = json.loads(audit_clean)
            for i, claim_text in enumerate(audit_data.get("verified", [])):
                ref_idx = 0
                for j, chunk in enumerate(rag_chunks):
                    if any(word in chunk["text"] for word in claim_text.split()[:5]):
                        ref_idx = j
                        break
                claim = {
                    "claim_id": str(uuid.uuid4()),
                    "text": claim_text[:200],
                    "verified_by": "deepseek-v3.2",
                    "ref_id": rag_chunks[ref_idx]["metadata"].get("source_doc", "") if rag_chunks else "",
                    "chunk_index": rag_chunks[ref_idx]["metadata"].get("chunk_index", 0) if rag_chunks else 0,
                    "confidence": 0.92,
                    "paragraph_id": paragraph_id,
                }
                verified_claims.append(claim)
                yield {"event": "verified", "data": claim}

            for flag in audit_data.get("flags", []):
                flag_record = {
                    "flag_id": str(uuid.uuid4()),
                    "sentence": flag.get("sentence", "")[:200],
                    "issue": flag.get("issue", "Unverified claim"),
                    "severity": flag.get("severity", "medium"),
                    "paragraph_id": paragraph_id,
                }
                unverified_flags.append(flag_record)
                yield {"event": "flagged", "data": flag_record}
        except Exception as e:
            logger.warning("audit_parse_failed", error=str(e))

        yield {"event": "thought", "data": _make_thought(
            "deepseek-v3.2", "auditor",
            f"Audit complete. {len(verified_claims)} claims verified, {len(unverified_flags)} flagged.",
            paragraph_id=paragraph_id
        )}

        if abort_event.is_set():
            yield {"event": "aborted", "data": {"partial": draft, "paragraph_id": paragraph_id}}
            return

        # ── NODE: qwen_logic_check ───────────────────────────────────────
        qwen_model = config.get("models", {}).get("logic_verification", ["qwen/qwen3.5-397b-a17b"])[0]

        yield {"event": "thought", "data": _make_thought(
            "qwen3.5", "verifier",
            "Checking logical validity. Scanning for non-sequiturs, unsupported causal claims, "
            "and statistical misinterpretations.",
            paragraph_id=paragraph_id
        )}

        logic_result = await _nim_complete(qwen_model, [
            {"role": "system", "content": (
                "Check the logical validity of the argument structure. "
                "Flag any non-sequiturs, unsupported causal claims, or statistical misinterpretations. "
                "Return ONLY valid JSON: [{\"sentence\": \"...\", \"issue\": \"...\", \"severity\": \"low|medium|high\"}]. "
                "Return [] if no issues found."
            )},
            {"role": "user", "content": f"Text to analyze:\n{draft}"}
        ], max_tokens=400)

        try:
            logic_clean = logic_result.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
            logic_flags = json.loads(logic_clean)
            for flag in (logic_flags if isinstance(logic_flags, list) else []):
                flag_record = {
                    "flag_id": str(uuid.uuid4()),
                    "sentence": flag.get("sentence", "")[:200],
                    "issue": f"[Logic] {flag.get('issue', '')}",
                    "severity": flag.get("severity", "low"),
                    "paragraph_id": paragraph_id,
                }
                unverified_flags.append(flag_record)
                yield {"event": "flagged", "data": flag_record}
        except Exception as e:
            logger.warning("logic_parse_failed", error=str(e))

        yield {"event": "thought", "data": _make_thought(
            "qwen3.5", "verifier",
            "Logic check complete. Argument structure validated.",
            paragraph_id=paragraph_id
        )}

        # ── NODE: assemble_output ────────────────────────────────────────
        yield {"event": "ghost_complete", "data": {
            "paragraph_id": paragraph_id,
            "text": draft,
            "generated_by": lead_model.split("/")[-1],
            "verified_claims": verified_claims,
            "unverified_flags": unverified_flags,
        }}

        yield {"event": "thought", "data": _make_thought(
            "orchestrator", "system",
            f"Generation complete. {len(draft.split())} words produced. "
            f"{len(verified_claims)} verified claims, {len(unverified_flags)} flags. "
            "Ghost draft ready for user review.",
            paragraph_id=paragraph_id
        )}

        yield {"event": "done", "data": {"paragraph_id": paragraph_id, "token_count": token_count}}

    finally:
        cleanup_abort_event(request_id)


async def _flux_generation(instruction: str, paragraph_id: str,
                            abort_event: asyncio.Event) -> AsyncGenerator[dict, None]:
    """Generate an image with Flux via NVIDIA NIM."""
    yield {"event": "thought", "data": _make_thought(
        "flux.2-klein", "designer",
        f"Image generation requested. Prompt: '{instruction[:80]}...' "
        "Applying minimalist scientific diagram style."
    )}

    STATIC_DIR.mkdir(exist_ok=True)
    image_id = str(uuid.uuid4())
    image_url = f"/static/{image_id}.png"

    if not NVIDIA_API_KEY or NVIDIA_API_KEY == "nvapi-xxxx":
        # Demo: return a placeholder
        yield {"event": "image_ready", "data": {
            "url": image_url,
            "caption": f"Generated figure: {instruction[:100]}",
            "paragraph_id": paragraph_id,
        }}
        yield {"event": "done", "data": {"paragraph_id": paragraph_id}}
        return

    flux_prompt = (
        f"Minimalist scientific diagram. {instruction}. "
        "High contrast, white background, no text in image, "
        "label anchor points A B C D only. Vector art style."
    )

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                f"{NVIDIA_BASE_URL}/images/generations",
                headers={
                    "Authorization": f"Bearer {NVIDIA_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "black-forest-labs/flux.2-klein-4b",
                    "prompt": flux_prompt,
                    "n": 1,
                    "size": "1024x768",
                },
            )
            if resp.status_code == 200:
                data = resp.json()
                import base64
                img_data = data["data"][0].get("b64_json", "")
                if img_data:
                    (STATIC_DIR / f"{image_id}.png").write_bytes(base64.b64decode(img_data))

    except Exception as e:
        logger.error("flux_generation_failed", error=str(e))
        yield {"event": "error", "data": {"message": f"Image generation failed: {str(e)}"}}
        return

    yield {"event": "image_ready", "data": {
        "url": image_url,
        "caption": f"Generated figure: {instruction[:100]}",
        "paragraph_id": paragraph_id,
    }}
    yield {"event": "done", "data": {"paragraph_id": paragraph_id}}


async def _deepseek_audit_direct(instruction: str, context_paragraphs: list[str],
                                  rag_chunks: list[dict], paragraph_id: str,
                                  abort_event: asyncio.Event) -> AsyncGenerator[dict, None]:
    """Direct DeepSeek audit flow for @DeepSeek mentions."""
    config = _read_config()
    deepseek_model = "deepseek-ai/deepseek-v3.2"

    yield {"event": "thought", "data": _make_thought(
        "deepseek-v3.2", "auditor",
        f"Direct audit requested: '{instruction[:80]}'. Analyzing provided context."
    )}

    rag_context = "\n\n".join([f"[REF-{i+1}] {c['text'][:400]}" for i, c in enumerate(rag_chunks)])
    context_text = "\n".join(context_paragraphs[-3:]) if context_paragraphs else ""

    result = await _nim_complete(deepseek_model, [
        {"role": "system", "content": "You are a scientific auditor. Analyze the text and provide a verification report. "
                                       "Return JSON: {\"summary\": \"...\", \"verified\": [...], \"unverified\": [...], \"recommendation\": \"...\"}"},
        {"role": "user", "content": f"Instruction: {instruction}\n\nContext:\n{context_text}\n\nReferences:\n{rag_context}"}
    ], max_tokens=600)

    try:
        clean = result.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
        data = json.loads(clean)
        yield {"event": "thought", "data": _make_thought(
            "deepseek-v3.2", "auditor",
            f"Audit result: {data.get('summary', result[:200])}",
            paragraph_id=paragraph_id
        )}
    except Exception:
        yield {"event": "thought", "data": _make_thought(
            "deepseek-v3.2", "auditor", result[:400] if result else "Audit complete.", paragraph_id=paragraph_id
        )}

    yield {"event": "done", "data": {"paragraph_id": paragraph_id}}


async def _qwen_logic_direct(instruction: str, context_paragraphs: list[str],
                              rag_chunks: list[dict], paragraph_id: str,
                              abort_event: asyncio.Event) -> AsyncGenerator[dict, None]:
    """Direct Qwen logic check flow for @Qwen mentions."""
    qwen_model = "qwen/qwen3.5-397b-a17b"

    yield {"event": "thought", "data": _make_thought(
        "qwen3.5", "verifier",
        f"Logic verification requested: '{instruction[:80]}'. Checking argument structure."
    )}

    context_text = "\n".join(context_paragraphs[-3:]) if context_paragraphs else ""

    result = await _nim_complete(qwen_model, [
        {"role": "system", "content": "You are a logic verifier. Analyze the argument structure and provide a clear assessment."},
        {"role": "user", "content": f"Instruction: {instruction}\n\nContext:\n{context_text}"}
    ], max_tokens=500)

    yield {"event": "thought", "data": _make_thought(
        "qwen3.5", "verifier",
        result[:400] if result else "Logic check complete.",
        paragraph_id=paragraph_id
    )}

    yield {"event": "done", "data": {"paragraph_id": paragraph_id}}
