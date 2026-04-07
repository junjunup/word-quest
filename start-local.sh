#!/bin/bash
set -e

echo ""
echo "======================================"
echo "  Word Quest - Local Start (No Docker)"
echo "======================================"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js not found. Please install from https://nodejs.org"
    exit 1
fi
echo "[OK] Node.js $(node --version) found"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Install server deps
echo ""
echo "[1/4] Installing server dependencies..."
cd "$SCRIPT_DIR/server"
if [ ! -d "node_modules" ]; then
    npm install
else
    echo "      Already installed, skipping..."
fi

# Install client deps
echo ""
echo "[2/4] Installing client dependencies..."
cd "$SCRIPT_DIR/client"
if [ ! -d "node_modules" ]; then
    npm install
else
    echo "      Already installed, skipping..."
fi

# Start backend server (auto-seeds with in-memory DB if no MongoDB)
echo ""
echo "[3/4] Starting backend server (port 4000)..."
echo "      (If MongoDB is not installed, an in-memory database will be used automatically)"
echo "      (Data seeding is handled automatically on startup)"
cd "$SCRIPT_DIR/server"
node src/app.js &
SERVER_PID=$!

# Wait for server to be ready
echo "      Waiting for server to start..."
sleep 5

if curl -s http://localhost:4000/api/health > /dev/null 2>&1; then
    echo "[OK] Backend server is running"
else
    echo "[WARN] Server may not be ready yet. If login fails, wait a moment and retry."
fi

# Cleanup on exit
cleanup() {
    echo ""
    echo "Shutting down..."
    kill $SERVER_PID 2>/dev/null
    exit 0
}
trap cleanup INT TERM

# Start client
echo ""
echo "[4/4] Starting frontend (port 3000)..."
echo ""
echo "======================================"
echo "  Ready!"
echo "======================================"
echo ""
echo "  Game:     http://localhost:3000"
echo "  API:      http://localhost:4000/api/health"
echo "  Account:  test / 123456"
echo ""
echo "  Press Ctrl+C to stop all services"
echo "======================================"
echo ""
cd "$SCRIPT_DIR/client"
npx vite --host
