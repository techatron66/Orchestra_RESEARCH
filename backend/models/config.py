from pydantic import BaseModel
from typing import Optional


class ProjectConfig(BaseModel):
    title: Optional[str] = None
    target_journal: Optional[str] = None
    citation_standard: Optional[str] = None
    field: Optional[str] = None


class ToneConfig(BaseModel):
    profile: Optional[str] = None
    voice: Optional[str] = None
    density: Optional[str] = None


class RigorConfig(BaseModel):
    level: Optional[int] = None
    require_citations: Optional[bool] = None
    flag_unverified_claims: Optional[bool] = None
    max_hallucination_score: Optional[float] = None
    peer_review_mode: Optional[bool] = None


class ModelsConfig(BaseModel):
    lead_synthesis: Optional[list[str]] = None
    logic_verification: Optional[list[str]] = None
    visual_generation: Optional[str] = None
    metadata_extraction: Optional[str] = None


class RAGConfig(BaseModel):
    top_k: Optional[int] = None
    similarity_threshold: Optional[float] = None
    web_augmentation: Optional[bool] = None
    auto_search_on_new_doc: Optional[bool] = None


class ConfigUpdate(BaseModel):
    project: Optional[dict] = None
    tone: Optional[dict] = None
    rigor: Optional[dict] = None
    models: Optional[dict] = None
    rag: Optional[dict] = None
