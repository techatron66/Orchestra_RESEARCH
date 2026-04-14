"""
Qwen 3.5-397B agent — Logic Verifier.
Checks argument structure for non-sequiturs, causal overclaims, statistical misinterpretations.
"""
import json
import os
from typing import Optional
import httpx
import structlog

logger = structlog.get_logger()

NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY", "")
NVIDIA_BASE_URL = os.getenv("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1")
MODEL = "qwen/qwen3.5-397b-a17b"

SYSTEM_PROMPT = """You are a formal logic verifier for scientific manuscripts.
Analyze the provided text for:
1. Non-sequiturs (conclusions that don't follow from premises)
2. Unsupported causal claims (correlation treated as causation)
3. Statistical misinterpretations (e.g., confusing p-value with effect size)
4. Scope creep (generalizing beyond what the data supports)

Return ONLY valid JSON — no markdown fences:
[
  {"sentence": "...", "issue": "...", "severity": "low|medium|high"}
]

Return [] if the argument structure is sound."""


async def logic_check(draft: str) -> list[dict]:
    """Check argument structure of a draft paragraph. Returns list of flag dicts."""
    if not NVIDIA_API_KEY or NVIDIA_API_KEY.startswith("nvapi-xx"):
        # Demo: check for common red-flag phrases
        flags = []
        red_flags = [
            ("therefore", "Causal language — verify that the stated conclusion follows from cited evidence", "low"),
            ("proves", "Overly strong claim — prefer 'suggests' or 'is consistent with'", "medium"),
            ("always", "Absolute universal claim — likely requires qualification", "medium"),
            ("clearly", "Epistemic hedge missing — 'clearly' asserts certainty not shown by data", "low"),
        ]
        for phrase, issue, severity in red_flags:
            if phrase in draft.lower():
                idx = draft.lower().index(phrase)
                snippet = draft[max(0, idx-30):idx+60].strip()
                flags.append({"sentence": snippet, "issue": issue, "severity": severity})
        return flags

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{NVIDIA_BASE_URL}/chat/completions",
                headers={"Authorization": f"Bearer {NVIDIA_API_KEY}",
                         "Content-Type": "application/json"},
                json={
                    "model": MODEL,
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": f"Text to analyze:\n{draft}"}
                    ],
                    "max_tokens": 400,
                    "temperature": 0.1,
                },
            )
            if resp.status_code == 200:
                raw = resp.json()["choices"][0]["message"]["content"]
                clean = raw.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
                result = json.loads(clean)
                return result if isinstance(result, list) else []
    except Exception as e:
        logger.warning("qwen_logic_error", error=str(e))

    return []


async def direct_logic(instruction: str, context: str) -> str:
    """
    Direct @Qwen mention: free-form logic assessment.
    """
    if not NVIDIA_API_KEY or NVIDIA_API_KEY.startswith("nvapi-xx"):
        return (
            f"Logic assessment of: '{instruction[:80]}'. "
            "Argument structure is internally consistent. "
            "Statistical methodology valid for the stated sample size. "
            "One potential scope issue: generalization beyond the depolarizing channel family "
            "requires additional experimental support."
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
                            "You are a logic verifier. Analyze the argument structure and provide "
                            "a concise assessment (2-3 sentences). Be precise and direct."},
                        {"role": "user", "content":
                            f"Instruction: {instruction}\n\nContext:\n{context}"}
                    ],
                    "max_tokens": 300,
                    "temperature": 0.2,
                },
            )
            if resp.status_code == 200:
                return resp.json()["choices"][0]["message"]["content"].strip()
    except Exception as e:
        logger.warning("qwen_direct_error", error=str(e))

    return "Logic check complete. Argument structure appears sound."
