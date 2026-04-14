from pydantic import BaseModel
from typing import Optional, Literal
from datetime import datetime


class GenerationRequest(BaseModel):
    document_id: str
    section: str
    instruction: str
    context_paragraphs: list[str] = []
    mention_override: Optional[str] = None
    stream: bool = True
    request_id: Optional[str] = None


class ThoughtEntry(BaseModel):
    id: str
    timestamp: datetime
    model: str
    role: str
    content: str
    citation: Optional[str] = None
    paragraph_id: Optional[str] = None
    confidence: float = 1.0


class ClaimMeta(BaseModel):
    claim_id: str
    text: str
    verified_by: str
    ref_id: str
    chunk_index: int
    confidence: float
    paragraph_id: Optional[str] = None


class FlagMeta(BaseModel):
    flag_id: str
    sentence: str
    issue: str
    severity: Literal["low", "medium", "high"]
    paragraph_id: Optional[str] = None


class GenerationEvent(BaseModel):
    event: Literal["thought", "delta", "ghost_complete", "verified", "flagged",
                   "image_ready", "aborted", "done", "error"]
    data: dict


class AbortRequest(BaseModel):
    request_id: str
