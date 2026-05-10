#!/bin/bash
# Start both Python audio server and Next.js

echo "=== Starting Sarcastic Music Server ==="

# Start Python audio analysis server in background
echo "Starting Python audio server on port 5001..."
cd /app/scripts
HOST=0.0.0.0 PORT=5001 python3 key-server.py > /tmp/python-server.log 2>&1 &
PYTHON_PID=$!

# Wait for Python server
echo "Waiting for Python server..."
sleep 5

# Check if still running
if kill -0 $PYTHON_PID 2>/dev/null; then
    echo "✓ Python audio server running on port 5001"
else
    echo "⚠ Python server failed to start, continuing anyway..."
    cat /tmp/python-server.log 2>/dev/null || true
fi

# Start Next.js
echo "Starting Next.js on port ${PORT:-3000}..."
cd /app
exec next start -p ${PORT:-3000}
