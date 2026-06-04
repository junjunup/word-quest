"""
通义千问 API 客户端（DashScope OpenAI 兼容模式）
"""
import os
import json
import logging
import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional
from config import QWEN_API_KEY, QWEN_BASE_URL, QWEN_MODEL
from services.prompt_manager import PromptManager
from services.safety_filter import SafetyFilter

# 清除代理环境变量，防止 httpx 通过本地代理访问千问 API 时 SSL 握手失败
for _proxy_var in ['HTTP_PROXY', 'http_proxy', 'HTTPS_PROXY', 'https_proxy', 'ALL_PROXY', 'all_proxy']:
    os.environ.pop(_proxy_var, None)

logger = logging.getLogger(__name__)

router = APIRouter()
prompt_manager = PromptManager()
safety_filter = SafetyFilter()


class ChatRequest(BaseModel):
    message: str
    userId: Optional[str] = ""
    context: Optional[dict] = Field(default_factory=dict)


class ChatResponse(BaseModel):
    content: str
    usage: Optional[dict] = None


def _build_headers():
    return {
        "Authorization": f"Bearer {QWEN_API_KEY}",
        "Content-Type": "application/json",
    }


def _build_body(system_prompt: str, messages: list, stream: bool = False) -> dict:
    return {
        "model": QWEN_MODEL,
        "messages": [{"role": "system", "content": system_prompt}] + messages,
        "temperature": 0.7,
        "top_p": 0.8,
        "stream": stream,
    }


class DistractorRequest(BaseModel):
    word: str
    meaning: str
    count: int = Field(default=3, ge=1, le=6)
    difficulty: str = "intermediate"


def _parse_distractor_response(raw_text: str, count: int) -> list:
    """解析 LLM 返回的干扰项 JSON 数组"""
    import re
    try:
        data = json.loads(raw_text.strip())
        if isinstance(data, list):
            return [str(item).strip() for item in data if isinstance(item, str)][:count]
        if isinstance(data, dict) and "distractors" in data:
            return [str(item).strip() for item in data["distractors"] if isinstance(item, str)][:count]
    except json.JSONDecodeError:
        # 尝试从文本中提取 JSON 数组
        match = re.search(r'\[.*?\]', raw_text.strip(), re.DOTALL)
        if match:
            try:
                items = json.loads(match.group())
                if isinstance(items, list):
                    return [str(item).strip() for item in items if isinstance(item, str)][:count]
            except json.JSONDecodeError:
                pass
    return []


@router.post("/distractors")
async def generate_distractors(request: DistractorRequest):
    """生成语义干扰项（选择题错误选项）"""
    if not safety_filter.check_input(f"{request.word} {request.meaning}"):
        return {"distractors": [], "source": "safety_blocked"}

    if not QWEN_API_KEY:
        return {"distractors": [], "source": "no_api_key"}

    prompt = prompt_manager.build_distractor_prompt(
        word=request.word,
        meaning=request.meaning,
        count=request.count,
        difficulty=request.difficulty
    )

    try:
        async with httpx.AsyncClient(timeout=8.0, trust_env=False) as client:
            response = await client.post(
                f"{QWEN_BASE_URL}/chat/completions",
                headers=_build_headers(),
                json={
                    "model": QWEN_MODEL,
                    "messages": [
                        {"role": "system", "content": "你只返回 JSON 数组，不返回其他内容。"},
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0.5,
                    "max_tokens": 200,
                    "stream": False
                }
            )

        if response.status_code == 200:
            body = response.json()
            raw_text = body.get("choices", [{}])[0].get("message", {}).get("content", "")
            distractors = _parse_distractor_response(raw_text, request.count)
            return {"distractors": distractors, "source": "qwen"}
        else:
            logger.warning(f"Distractor LLM call failed: {response.status_code}")
            return {"distractors": [], "source": "llm_error"}

    except Exception as e:
        logger.warning(f"Distractor generation failed: {str(e)}")
        return {"distractors": [], "source": "timeout_or_error"}


def get_mock_response(message: str, context: dict) -> str:
    """开发模式下的模拟回复"""
    current_word = context.get("currentWord", "")
    trigger_type = context.get("triggerType", "manual")

    if trigger_type == "wrong_answer" and current_word:
        knowledge = context.get("wordKnowledge") or {}
        player_answer = context.get("playerAnswer", "")
        correct_answer = context.get("correctAnswer", current_word)
        answer_quality = context.get("answerQuality", "wrong")
        memory_tip = knowledge.get("memoryTip") or f"试试把 '{current_word}' 拆分成音节或词根来记。"
        if answer_quality == "near":
            prefix = f"已经很接近啦！你写的 '{player_answer}' 和标准答案 '{correct_answer}' 只有细微差异。"
        else:
            prefix = f"别灰心，'{current_word}' 确实容易混。你刚才的答案是 '{player_answer or '空'}'。"
        return (
            f"{prefix}\n\n"
            f"记忆技巧：{memory_tip}\n\n"
            f"下次先默念发音，再检查每个字母的位置。"
        )
    elif "记" in message or "记忆" in message:
        return (
            "记忆单词有很多好方法呢！\n\n"
            "1. 词根词缀法：了解单词的构成\n"
            "2. 联想记忆法：把单词和画面联系起来\n"
            "3. 语境记忆法：在句子中记单词\n\n"
            "你想用哪种方法试试呢？"
        )
    elif "例句" in message:
        return "好的，让我给你造个例句~\n\n多看例句能帮你更好地理解单词的用法哦！"
    else:
        return (
            "嗨！我是小智~\n\n"
            "我可以帮你：\n"
            "- 分析词根词缀\n"
            "- 提供记忆技巧\n"
            "- 造句练习\n"
            "- 对比近义词\n\n"
            "有什么想问的，尽管来吧！"
        )


@router.post("/chat")
async def chat(request: ChatRequest):
    """非流式对话接口"""
    if not safety_filter.check_input(request.message):
        return ChatResponse(
            content="嘿嘿，这个话题我不太擅长呢~ 我们还是聊英语学习吧！有什么单词想了解的吗？"
        )

    if not QWEN_API_KEY:
        mock_reply = get_mock_response(request.message, request.context or {})
        return ChatResponse(content=mock_reply)

    system_prompt = prompt_manager.build_system_prompt(request.context or {})
    messages = [{"role": "user", "content": request.message}]

    try:
        async with httpx.AsyncClient(timeout=30.0, trust_env=False) as client:
            response = await client.post(
                f"{QWEN_BASE_URL}/chat/completions",
                headers=_build_headers(),
                json=_build_body(system_prompt, messages, stream=False),
            )
            data = response.json()

            if "choices" in data and len(data["choices"]) > 0:
                content = safety_filter.filter_output(data["choices"][0]["message"]["content"])
                usage = data.get("usage")
                return ChatResponse(content=content, usage=usage)
            else:
                logger.error(f"Qwen API returned error: {data}")
                raise HTTPException(status_code=500, detail="AI 服务暂时不可用，请稍后再试")

    except httpx.TimeoutException:
        return ChatResponse(content="哎呀，我思考得太久了~ 请再问我一次吧！")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Qwen chat error: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"AI 服务暂时不可用: {type(e).__name__}: {str(e)}")


@router.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    """流式对话接口 (SSE)"""
    if not safety_filter.check_input(request.message):

        async def reject_gen():
            yield 'data: {"content": "嘿嘿，这个话题我不太擅长呢~ 我们还是聊英语学习吧！"}\n\n'
            yield "data: [DONE]\n\n"

        return StreamingResponse(reject_gen(), media_type="text/event-stream")

    if not QWEN_API_KEY:
        mock_reply = get_mock_response(request.message, request.context or {})

        async def mock_gen():
            for char in mock_reply:
                yield f"data: {json.dumps({'content': char})}\n\n"
            yield "data: [DONE]\n\n"

        return StreamingResponse(mock_gen(), media_type="text/event-stream")

    system_prompt = prompt_manager.build_system_prompt(request.context or {})
    messages = [{"role": "user", "content": request.message}]

    async def generate():
        try:
            async with httpx.AsyncClient(timeout=60.0, trust_env=False) as client:
                async with client.stream(
                    "POST",
                    f"{QWEN_BASE_URL}/chat/completions",
                    headers=_build_headers(),
                    json=_build_body(system_prompt, messages, stream=True),
                ) as response:
                    async for line in response.aiter_lines():
                        if line.startswith("data: ") and line.strip() != "data: [DONE]":
                            # 千问返回的是 OpenAI 格式的 SSE data
                            try:
                                chunk = json.loads(line[6:])
                                delta = chunk.get("choices", [{}])[0].get("delta", {})
                                if "content" in delta:
                                    yield f"data: {json.dumps({'content': delta['content']})}\n\n"
                            except json.JSONDecodeError:
                                pass

            yield "data: [DONE]\n\n"

        except Exception as e:
            logger.error(f"Qwen stream error: {str(e)}", exc_info=True)
            yield f"data: {json.dumps({'error': 'AI 服务暂时不可用，请稍后再试'})}\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")
