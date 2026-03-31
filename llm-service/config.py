import os

ERNIE_API_KEY = os.getenv("ERNIE_API_KEY", "")
ERNIE_SECRET_KEY = os.getenv("ERNIE_SECRET_KEY", "")
ERNIE_TOKEN_URL = "https://aip.baidubce.com/oauth/2.0/token"
ERNIE_CHAT_URL = "https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/ernie-4.0-8k"
