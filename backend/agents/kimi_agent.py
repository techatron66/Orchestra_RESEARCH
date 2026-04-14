"""
Kimi K2.5 agent — Lead Synthesis.
Responsible for producing the primary prose draft using RAG context.
"""
import os
from typing import AsyncGenerator, Optional
import httpx
import structlog

logger = structlog.get_logger()

NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY", "")
NVIDIA_BASE_URL = os.getenv("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1")
MODEL = "moonshotai/kimi-k2.5"


def build_system_prompt(config: dict) -> str:
    project = config.get("project", {})
    tone = config.get("tone", {})
    rigor = config.get("rigor", {})
    return f"""You are a research writing assistant for {project.get('target_journal', 'Nature')} journal.
Citation standard: {project.get('citation_standard', 'IEEE')}.
Writing profile: {tone.get('profile', 'Academic/Formal')}.
Voice: {tone.get('voice', 'Third Person')}.
Scientific rigor level: {rigor.get('level', 9)}/10.

Rules:
- Write exactly one well-formed paragraph. No headings or preamble.
- When a claim is drawn from a provided reference, insert [REF-N] inline immediately after the claim.
- Do not fabricate statistics. If no reference supports a claim, write it without a citation marker.
- Maintain the target journal's style throughout."""


def build_user_prompt(section: str, instruction: str,
                       context_paragraphs: list[str], rag_chunks: list[dict]) -> str:
    rag_context = "\n\n".join([
        f"[REF-{i+1}] (source: {c['metadata'].get('source_doc','?')[:12]}, "
        f"page {c['metadata'].get('page','?')})\n{c['text'][:700]}"
        for i, c in enumerate(rag_chunks)
    ]) if rag_chunks else "No RAG sources available for this query."

    ctx = context_paragraphs[-1] if context_paragraphs else "(start of section)"
    return f"""Section: {section}
Instruction: {instruction}

Preceding paragraph for context:
{ctx}

Available references:
{rag_context}

Write the next paragraph."""


async def stream_synthesis(
    config: dict,
    section: str,
    instruction: str,
    context_paragraphs: list[str],
    rag_chunks: list[dict],
    abort_event,
    max_tokens: int = 600,
) -> AsyncGenerator[str, None]:
    """Stream synthesis tokens from Kimi K2.5."""
    system = build_system_prompt(config)
    user = build_user_prompt(section, instruction, context_paragraphs, rag_chunks)

    if not NVIDIA_API_KEY or NVIDIA_API_KEY.startswith("nvapi-xx"):
        mock = (
            "Building on the theoretical framework established above, the proposed architecture "
            "demonstrates substantial gains across all evaluated benchmarks [REF-1]. "
            "Crucially, the observed improvements persist under distribution shift between training "
            "and evaluation noise channels, suggesting the model has internalized a generalizable "
            "representation of syndrome topology rather than memorizing specific error patterns [REF-2]."
        )
        for word in mock.split():
            if abort_event.is_set():
                return
            yield word + " "
        return

    try:
        async with httpx.AsyncClient(timeout=90.0) as client:
            async with client.stream(
                "POST",
                f"{NVIDIA_BASE_URL}/chat/completions",
                headers={"Authorization": f"Bearer {NVIDIA_API_KEY}",
                         "Content-Type": "application/json"},
                json={
                    "model": MODEL,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": user},
                    ],
                    "max_tokens": max_tokens,
                    "stream": True,
                    "temperature": 0.7,
                },
            ) as resp:
                import json
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
        logger.error("kimi_stream_error", error=str(e))
        yield f" [Kimi error: {str(e)[:60]}]"
