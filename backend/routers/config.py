"""
Config router: read/write the Instruction Ledger (config.json).
"""
import json
from pathlib import Path

from fastapi import APIRouter, HTTPException
import structlog

from ..models.config import ConfigUpdate

logger = structlog.get_logger()
router = APIRouter()

CONFIG_PATH = Path(__file__).parent.parent / "config.json"


@router.get("/config")
async def get_config():
    """Read and return config.json."""
    try:
        return json.loads(CONFIG_PATH.read_text())
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read config: {e}")


@router.put("/config")
async def update_config(body: ConfigUpdate):
    """Merge partial config update into config.json."""
    try:
        current = json.loads(CONFIG_PATH.read_text())
    except Exception:
        current = {}

    update = body.model_dump(exclude_none=True)
    for section, values in update.items():
        if isinstance(values, dict):
            current.setdefault(section, {}).update(values)
        else:
            current[section] = values

    CONFIG_PATH.write_text(json.dumps(current, indent=2))
    logger.info("config_updated", sections=list(update.keys()))
    return {"status": "saved", "config": current}
