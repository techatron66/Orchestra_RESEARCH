"""
Flux.2-Klein-4B agent — Visual Designer.
Generates scientific figures via NVIDIA NIM image endpoint.
Saves to /static/{uuid}.png and returns the URL.
"""
import base64
import os
import uuid
from pathlib import Path
from typing import Optional
import httpx
import structlog

logger = structlog.get_logger()

NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY", "")
NVIDIA_BASE_URL = os.getenv("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1")
MODEL = "black-forest-labs/flux.2-klein-4b"
STATIC_DIR = Path(os.getenv("STATIC_DIR", "./static"))


def build_flux_prompt(instruction: str, context_paragraphs: list[str]) -> str:
    """Build a Flux prompt that externalizes all text from the image."""
    # Extract figure description from instruction or context
    ctx_snippet = " ".join(context_paragraphs[-1:])[:200] if context_paragraphs else ""
    return (
        f"Minimalist scientific diagram. {instruction}. "
        f"Context: {ctx_snippet}. "
        "High contrast lines on white background. "
        "No text or labels embedded in image — label anchor points A B C D only with small markers. "
        "Vector art style. Clean grid lines. Scientific illustration aesthetic."
    )


async def generate_figure(
    instruction: str,
    context_paragraphs: list[str],
    width: int = 1024,
    height: int = 768,
) -> dict:
    """
    Call the Flux image endpoint and save the result.
    Returns: {url, image_id, prompt, status}
    """
    STATIC_DIR.mkdir(parents=True, exist_ok=True)
    image_id = str(uuid.uuid4())
    image_path = STATIC_DIR / f"{image_id}.png"
    prompt = build_flux_prompt(instruction, context_paragraphs)

    if not NVIDIA_API_KEY or NVIDIA_API_KEY.startswith("nvapi-xx"):
        # Demo mode: write a tiny 1×1 transparent PNG placeholder
        # Real PNG header for a 1×1 white pixel
        png_bytes = bytes([
            0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A,  # PNG signature
            0x00,0x00,0x00,0x0D,0x49,0x48,0x44,0x52,  # IHDR chunk
            0x00,0x00,0x00,0x01,0x00,0x00,0x00,0x01,  # 1x1
            0x08,0x02,0x00,0x00,0x00,0x90,0x77,0x53,0xDE,  # 8-bit RGB
            0x00,0x00,0x00,0x0C,0x49,0x44,0x41,0x54,  # IDAT chunk
            0x08,0xD7,0x63,0xF8,0xFF,0xFF,0x3F,0x00,
            0x05,0xFE,0x02,0xFE,0xA7,0x35,0x81,0xA4,
            0x00,0x00,0x00,0x00,0x49,0x45,0x4E,0x44,  # IEND
            0xAE,0x42,0x60,0x82
        ])
        image_path.write_bytes(png_bytes)
        logger.info("flux_demo_placeholder", image_id=image_id)
        return {
            "url": f"/static/{image_id}.png",
            "image_id": image_id,
            "prompt": prompt,
            "status": "demo",
        }

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                f"{NVIDIA_BASE_URL}/images/generations",
                headers={
                    "Authorization": f"Bearer {NVIDIA_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": MODEL,
                    "prompt": prompt,
                    "n": 1,
                    "size": f"{width}x{height}",
                    "response_format": "b64_json",
                },
            )

            if resp.status_code == 200:
                data = resp.json()
                b64 = data["data"][0].get("b64_json", "")
                if b64:
                    image_path.write_bytes(base64.b64decode(b64))
                    logger.info("flux_image_saved", image_id=image_id, path=str(image_path))
                    return {
                        "url": f"/static/{image_id}.png",
                        "image_id": image_id,
                        "prompt": prompt,
                        "status": "generated",
                    }
                else:
                    # Try URL response format
                    url = data["data"][0].get("url", "")
                    return {"url": url, "image_id": image_id, "prompt": prompt, "status": "url"}
            else:
                error_detail = resp.text[:200]
                logger.error("flux_api_error", status=resp.status_code, detail=error_detail)
                raise RuntimeError(f"Flux API returned {resp.status_code}: {error_detail}")

    except Exception as e:
        logger.error("flux_generation_failed", error=str(e))
        raise
