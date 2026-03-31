"""
百度文心一言API客户端
"""
import os
import json
import time
import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional
from config import ERNIE_API_KEY, ERNIE_SECRET_KEY, ERNIE_TOKEN_URL, ERNIE_CHAT_URL
from services.prompt_manager import PromptManager
from services.safety_filter import SafetyFilter

router = APIRouter()
prompt_manager = PromptManager()
safety_filter = SafetyFilter()

# Access Token 缓存
_token_cache = {"token": "", "expires_at": 0}


class ChatRequest(BaseModel):
    message: str
    userId: Optional[str] = ""
    context: Optional[dict] = Field(default_factory=dict)


class ChatResponse(BaseModel):
    content: str
    usage: Optional[dict] = None


async def get_access_token() -> str:
    """获取百度文心API access_token（带缓存）"""
    if _token_cache["token"] and time.time() < _token_cache["expires_at"]:
        return _token_cache["token"]

    if not ERNIE_API_KEY or not ERNIE_SECRET_KEY:
        # 开发模式：没有API key时返回模拟token
        return "mock_token"

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            response = await client.post(
                ERNIE_TOKEN_URL,
                params={
                    "grant_type": "client_credentials",
                    "client_id": ERNIE_API_KEY,
                    "client_secret": ERNIE_SECRET_KEY,
                },
            )
            response.raise_for_status()
            data = response.json()
        except (httpx.TimeoutException, httpx.HTTPStatusError) as e:
            raise HTTPException(status_code=502, detail=f"Token服务异常: {e}")

        if "access_token" not in data:
            raise HTTPException(status_code=500, detail=f"获取access_token失败: {data}")

        _token_cache["token"] = data["access_token"]
        _token_cache["expires_at"] = time.time() + data.get("expires_in", 2592000) - 60
        return data["access_token"]


def get_mock_response(message: str, context: dict) -> str:
    """开发模式下的模拟回复"""
    current_word = context.get("currentWord", "")
    trigger_type = context.get("triggerType", "manual")

    if trigger_type == "wrong_answer" and current_word:
        return (
            f"别灰心哦！'{current_word}' 这个词确实有点容易搞混呢~ 😊\n\n"
            f"💡 记忆技巧：试试把 '{current_word}' 拆分来记，"
            f"或者联想一个你熟悉的场景。\n\n"
            f"多练几次就能记住啦，加油！💪"
        )
    elif "记" in message or "记忆" in message:
        return (
            "记忆单词有很多好方法呢！🧠\n\n"
            "1️⃣ 词根词缀法：了解单词的构成\n"
            "2️⃣ 联想记忆法：把单词和画面联系起来\n"
            "3️⃣ 语境记忆法：在句子中记单词\n\n"
            "你想用哪种方法试试呢？"
        )
    elif "例句" in message:
        return f"好的，让我给你造个例句~ 📝\n\n多看例句能帮你更好地理解单词的用法哦！"
    else:
        return (
            "嗨！我是小智~ ✨\n\n"
            "我可以帮你：\n"
            "📖 分析词根词缀\n"
            "💡 提供记忆技巧\n"
            "📝 造句练习\n"
            "🔍 对比近义词\n\n"
            "有什么想问的，尽管来吧！"
        )


@router.post("/chat")
async def chat(request: ChatRequest):
    """非流式对话接口"""
    # 安全过滤
    if not safety_filter.check_input(request.message):
        return ChatResponse(
            content="嘿嘿，这个话题我不太擅长呢~ 😅 我们还是聊英语学习吧！有什么单词想了解的吗？"
        )

    # 构建Prompt
    system_prompt = prompt_manager.build_system_prompt(request.context or {})
    messages = [{"role": "user", "content": request.message}]

    try:
        access_token = await get_access_token()

        # 如果是mock token，返回模拟回复
        if access_token == "mock_token":
            mock_reply = get_mock_response(request.message, request.context or {})
            return ChatResponse(content=mock_reply)

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{ERNIE_CHAT_URL}?access_token={access_token}",
                json={
                    "messages": messages,
                    "system": system_prompt,
                    "temperature": 0.7,
                    "top_p": 0.8,
                },
            )
            data = response.json()

            if "result" in data:
                content = safety_filter.filter_output(data["result"])
                return ChatResponse(content=content, usage=data.get("usage"))
            else:
                raise HTTPException(status_code=500, detail=f"API返回错误: {data}")

    except httpx.TimeoutException:
        return ChatResponse(content="哎呀，我思考得太久了~ 请再问我一次吧！⏰")
    except Exception as e:
        if "mock_token" in str(e):
            return ChatResponse(
                content=get_mock_response(request.message, request.context or {})
            )
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    """流式对话接口 (SSE)"""
    # 安全过滤
    if not safety_filter.check_input(request.message):

        async def reject_gen():
            yield 'data: {"content": "嘿嘿，这个话题我不太擅长呢~ 我们还是聊英语学习吧！"}\n\n'
            yield "data: [DONE]\n\n"

        return StreamingResponse(reject_gen(), media_type="text/event-stream")

    system_prompt = prompt_manager.build_system_prompt(request.context or {})
    messages = [{"role": "user", "content": request.message}]

    async def generate():
        try:
            access_token = await get_access_token()

            # Mock模式
            if access_token == "mock_token":
                mock_reply = get_mock_response(request.message, request.context or {})
                # 模拟流式输出（使用 json.dumps 防止特殊字符注入）
                for char in mock_reply:
                    yield f"data: {json.dumps({'content': char})}\n\n"
                yield "data: [DONE]\n\n"
                return

            async with httpx.AsyncClient(timeout=60.0) as client:
                async with client.stream(
                    "POST",
                    f"{ERNIE_CHAT_URL}?access_token={access_token}",
                    json={
                        "messages": messages,
                        "system": system_prompt,
                        "stream": True,
                        "temperature": 0.7,
                        "top_p": 0.8,
                    },
                ) as response:
                    async for line in response.aiter_lines():
                        if line.startswith("data: "):
                            yield line + "\n\n"

            yield "data: [DONE]\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")
