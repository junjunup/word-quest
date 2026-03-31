#!/bin/bash
set -e

echo ""
echo "======================================"
echo "  词汇大冒险 Word Quest - 一键部署"
echo "======================================"
echo ""

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo "[错误] 未检测到 Docker，请先安装"
    echo "  Ubuntu: curl -fsSL https://get.docker.com | sh"
    echo "  Mac:    brew install --cask docker"
    exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "[错误] 未检测到 docker-compose"
    exit 1
fi

# 兼容 docker compose v2
COMPOSE_CMD="docker-compose"
if ! command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker compose"
fi

# 检查 .env 文件
if [ ! -f ".env" ]; then
    echo "[提示] 未检测到 .env 配置文件，将从模板创建..."
    cp .env.example .env
    echo "[提示] 已创建 .env，请编辑填入你的百度文心一言 API Key"
    echo "[提示] 如果不填写，小智将使用本地模拟回复"
    echo ""
    read -p "按回车继续部署..." _
fi

echo ""
echo "[1/3] 构建 Docker 镜像..."
$COMPOSE_CMD build

echo ""
echo "[2/3] 启动所有服务..."
$COMPOSE_CMD up -d

echo ""
echo "[3/3] 等待服务就绪..."
sleep 8

echo ""
echo "检查服务状态:"
$COMPOSE_CMD ps

echo ""
echo "======================================"
echo "  部署完成！"
echo "======================================"
echo ""
echo "  游戏地址:    http://localhost:3000"
echo "  API 地址:    http://localhost:4000/api/health"
echo "  LLM 服务:    http://localhost:8000/health"
echo ""
echo "  测试账号:    test / 123456"
echo ""
echo "  停止服务:    $COMPOSE_CMD down"
echo "  查看日志:    $COMPOSE_CMD logs -f"
echo "  重新部署:    $COMPOSE_CMD up -d --build"
echo "======================================"
