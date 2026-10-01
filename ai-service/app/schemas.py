"""Pydantic contracts for the Aurora local AI sidecar."""

from typing import Literal, Optional

from pydantic import BaseModel, Field

Severity = Literal["low", "moderate", "high"]


class HealthResponse(BaseModel):
    status: str
    modelLoaded: bool
    modelVersion: str
    backend: str
    device: Optional[str] = None
    nGpuLayers: int
    mmprojOffloaded: bool
    serverUrl: str


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    max_tokens: Optional[int] = Field(default=None, ge=16, le=4096)
    temperature: Optional[float] = Field(default=None, ge=0.0, le=2.0)


class ChatResponse(BaseModel):
    reply: str
    model_version: str
    latency_ms: int


class AnalysisResponse(BaseModel):
    findings: list[str]
    impression: Literal["normal", "abnormal"]
    severity: Severity
    confidence: float = Field(ge=0.0, le=1.0)
    recommended_followup: str
    disclaimer: str
    model_version: str
    latency_ms: int
    raw: Optional[str] = None


class RagQueryRequest(BaseModel):
    question: str = Field(min_length=4, max_length=500)
    k: Optional[int] = Field(default=None, ge=1, le=8)


class RagSource(BaseModel):
    source: str
    heading: str
    score: float


class RagAnswer(BaseModel):
    answer: str
    sources: list[RagSource]
    retrieved: int
    model_version: str
    latency_ms: int


class RagStats(BaseModel):
    collection: str
    chunks: int
    sources: list[str]
    path: str
    queue: dict


class RagDocumentRequest(BaseModel):
    title: str = Field(min_length=3, max_length=120)
    text: str = Field(min_length=40, max_length=200_000)
    source: Optional[str] = Field(default=None, max_length=60)
