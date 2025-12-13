from typing import List, Optional, Literal
from pydantic import BaseModel, Field


class Document(BaseModel):
    id: str = Field(..., min_length=1)
    content: str = Field(..., min_length=1)


class AnalyzeRequest(BaseModel):
    documents: List[Document] = Field(..., min_items=1)
    chunk_size: Optional[int] = Field(None, gt=256, lt=64_000)
    chunk_overlap: Optional[int] = Field(None, ge=0, lt=8_000)
    language: Optional[str] = None


class Position(BaseModel):
    start: int
    end: int
    line: int
    col: int


class Issue(BaseModel):
    type: Literal["spelling", "grammar"]
    message: str
    original: str
    suggestions: List[str]
    position: Position


class Token(BaseModel):
    text: str
    position: Position


class FileResult(BaseModel):
    id: str
    tokens: List[Token]
    issues: List[Issue]
    stats: dict
    error: Optional[str] = None


class AnalyzeResponse(BaseModel):
    files: List[FileResult]


class HealthResponse(BaseModel):
    status: str = "ok"
    details: Optional[dict] = None
