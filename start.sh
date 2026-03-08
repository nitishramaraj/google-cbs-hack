#!/bin/bash
echo "Starting VitalSense..."
cd "$(dirname "$0")"

echo "Starting backend on port 8765..."
python3 -m uvicorn main:combined_app --host 0.0.0.0 --port 8765 --reload &
BACKEND_PID=$!

echo "Starting frontend on port 5173..."
cd frontend && npm run dev &
FRONTEND_PID=$!

echo ""
echo "VitalSense is running!"
echo "  Frontend: http://localhost:5173"
echo "  Backend:  http://localhost:8765"
echo ""
echo "Press Ctrl+C to stop."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
