#!/bin/bash
# IncidentIQ Startup Script
# Starts both the Python FastAPI backend and React frontend dev server

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"

echo "============================================"
echo "  IncidentIQ — AI Incident Response Agent"
echo "============================================"
echo ""

# Check if Python venv exists
if [ ! -d "$PROJECT_DIR/venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv "$PROJECT_DIR/venv"
fi

# Activate venv
source "$PROJECT_DIR/venv/bin/activate"

# Install Python dependencies if needed
echo "Checking Python dependencies..."
pip install -q -r "$BACKEND_DIR/requirements.txt" 2>/dev/null

# Install Node dependencies if needed
if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
    echo "Installing frontend dependencies..."
    cd "$FRONTEND_DIR"
    npm install
fi

echo ""
echo "Starting services..."
echo ""

# Start backend in background
echo "[1/2] Starting FastAPI backend on port 8000..."
cd "$BACKEND_DIR"
uvicorn api:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
echo "  Backend PID: $BACKEND_PID"

# Wait for backend to be ready
sleep 2

# Start frontend dev server
echo "[2/2] Starting React dev server on port 3000..."
cd "$FRONTEND_DIR"
npm run dev &
FRONTEND_PID=$!
echo "  Frontend PID: $FRONTEND_PID"

echo ""
echo "============================================"
echo "  All services are running!"
echo "============================================"
echo ""
echo "  Backend API:  http://localhost:8000"
echo "  Frontend UI:  http://localhost:3000"
echo ""
echo "  Press Ctrl+C to stop all services"
echo ""

# Cleanup on exit
cleanup() {
    echo ""
    echo "Shutting down services..."
    kill $BACKEND_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    echo "Done."
}

trap cleanup EXIT INT TERM

# Wait for background processes
wait
