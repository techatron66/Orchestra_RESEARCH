from pydantic import BaseModel
from typing import Optional, Literal
from datetime import datetime


class DocumentMeta(BaseModel):
    id: str
    title: str
    template: Literal["ieee", "nature", "apa", "blank"]
    created_at: datetime
    updated_at: datetime
    word_count: int = 0
    citation_count: int = 0
    references: list[str] = []


class DocumentCreate(BaseModel):
    template: Literal["ieee", "nature", "apa", "blank"] = "blank"
    title: str = "Untitled Research"


class DocumentContent(BaseModel):
    id: str
    meta: DocumentMeta
    content: dict  # Tiptap JSON


class Reference(BaseModel):
    id: str
    filename: str
    doi: Optional[str] = None
    title: Optional[str] = None
    authors: Optional[list[str]] = None
    year: Optional[int] = None
    journal: Optional[str] = None
    key_claims: list[str] = []
    chunk_count: int = 0
    indexed_at: datetime


class IngestJob(BaseModel):
    job_id: str
    document_id: str
    filename: str
    status: Literal["pending", "processing", "complete", "error"]
    progress: float = 0.0
    stage: str = "Queued"
    reference: Optional[Reference] = None
    error: Optional[str] = None
