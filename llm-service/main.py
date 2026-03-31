"""
百度文心一言 LLM 微服务
Word Quest - AI学伴"小智"后端
"""
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Word Quest LLM Service", version="1.0.0")

# CORS: 仅允许已知源，生产环境通过环境变量配置
allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:4000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "llm-service"}


from services.ernie_client import router as ernie_router
app.include_router(ernie_router, prefix="/api/llm", tags=["LLM"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
