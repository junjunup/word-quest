"""
Pydantic 数据模型
"""
from pydantic import BaseModel
from typing import Optional


class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    message: str
    userId: Optional[str] = ""
    context: Optional[dict] = {}


class ChatResponse(BaseModel):
    content: str
    usage: Optional[dict] = None


class HealthResponse(BaseModel):
    status: str
    service: str
