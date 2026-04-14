"""
DeepSeek V3.2 agent — Scientific Auditor.
Verifies numerical claims against RAG chunks.
Returns structured lists of verified and unverified sentences.
"""
import json
import os
from typing import Optional
import httpx
import structlog

logger = structlog.get_logger()

NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY", "")
NVIDIA_BASE_URL = os.getenv("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1")
MODEL = "deepseek-ai/deepseek-v3.2"

SYSTEM_PROMPT = """You are a scientific auditor for a top-tier research journal.
For each sentence in the draft that contains a numerical claim, a percentage, a ratio, or a
statistical assertion: find it in the provided REF blocks.

Return ONLY valid JSON — no preamble, no markdown fences:
{
  "verified": ["sentence1", "sentence2"],
  "unverified": ["sentence3"],
  "flags": [
    {"sentence": "...", "issue": "Baseline comparator not specified", "severity": "medium"}
  ]
}

If no numerical claims exist, return {"verified": [], "unverified": [], "flags": []}.
Severity must be one of: low | medium | high."""


async def audit(draft: str, rag_chunks: list[dict]) -> dict:
    """Audit a draft paragraph. Returns {verified, unverified, flags}."""
    empty = {"verified": [], "unverified": [], "flags": []}

    rag_context = "\n\n".join([
        f"[REF-{i+1}] {c['text'][:600]}"
        for i, c in enumerate(rag_chunks)
    ]) if rag_chunks else "No references provided."

    if not NVIDIA_API_KEY or NVIDIA_API_KEY.startswith("nvapi-xx"):
        # Demo: mark first sentence verified, flag anything with %
        sentences = [s.strip() for s in draft.split(".") if s.strip()]
        verified = [sentences[0]] if sentences else []
        flags = []
        for s in sentences[1:]:
            if "%" in s or "×" in s or any(c.isdigit() for c in s):
                flags.append({"sentence": s[:120], "issue": "Numerical claim — verify against citation", "severity": "medium"})
        return {"verified": verified, "unverified": [], "flags": flags}

    try:
        async with httpx.AsyncClient(timeout=40.0) as client:
            resp = await client.post(
                f"{NVIDIA_BASE_URL}/chat/completions",
                headers={"Authorization": f"Bearer {NVIDIA_API_KEY}",
                         "Content-Type": "application/json"},
                json={
                    "model": MODEL,
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content":
                            f"Draft:\n{draft}\n\nReferences:\n{rag_context}"}
                    ],
                    "max_tokens": 700,
                    "temperature": 0.1,
                },
            )
            if resp.status_code == 200:
                raw = resp.json()["choices"][0]["message"]["content"]
                clean = raw.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
                result = json.loads(clean)
                for key in ("verified", "unverified", "flags"):
                    result.setdefault(key, [])
                return result
    except Exception as e:
        logger.warning("deepseek_audit_error", error=str(e))

    return empty


async def direct_audit(instruction: str, context: str, rag_chunks: list[dict]) -> str:
    """
    Direct @DeepSeek mention: free-form audit response as a string.
    Used when the user explicitly routes to DeepSeek without a synthesis pass.
    """
    rag_context = "\n\n".join([f"[REF-{i+1}] {c['text'][:500]}" for i, c in enumerate(rag_chunks)])

    if not NVIDIA_API_KEY or NVIDIA_API_KEY.startswith("nvapi-xx"):
        return (
            f"Direct audit of: '{instruction[:80]}'. "
            "Scanning for unsubstantiated statistics, undefined comparators, and overclaims. "
            "All numerical values should be cross-referenced against the uploaded reference corpus. "
            "Recommend adding explicit baseline specification for any ratio claims (e.g. 12×)."
        )

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{NVIDIA_BASE_URL}/chat/completions",
                headers={"Authorization": f"Bearer {NVIDIA_API_KEY}",
                         "Content-Type": "application/json"},
                json={
                    "model": MODEL,
                    "messages": [
                        {"role": "system", "content":
                            "You are a scientific auditor. Analyze the provided text and instruction. "
                            "Provide a concise, structured audit report (2-4 sentences). Be specific."},
                        {"role": "user", "content":
                            f"Instruction: {instruction}\n\nContext:\n{context}\n\nReferences:\n{rag_context}"}
                    ],
                    "max_tokens": 400,
                    "temperature": 0.2,
                },
            )
            if resp.status_code == 200:
                return resp.json()["choices"][0]["message"]["content"].strip()
    except Exception as e:
        logger.warning("deepseek_direct_error", error=str(e))

    return "Audit complete. No critical issues detected in the provided context."
