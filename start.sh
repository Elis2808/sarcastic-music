#!/bin/bash
# Start both Python audio server and Next.js

set -e

echo "=== Starting Sarcastic Music Server ==="

# Check if scripts directory exists
if [ ! -d "/app/scripts" ]; then
    echo "ERROR: /app/scripts directory not found"
    exit 1
fi

# Check if key-server.py exists
if [ ! -f "/app/scripts/key-server.py" ]; then
    echo "ERROR: key-server.py not found in /app/scripts"
    exit 1
fi

# Start Python audio analysis server in background
echo "Starting Python audio server on port 5001..."
cd /app/scripts
HOST=0.0.0.0 PORT=5001 python3 key-server.py > /tmp/python-server.log 2>&1 &
PYTHON_PID=$!

# Wait for Python server to start
echo "Waiting for Python server to initialize..."
sleep 3

# Check if Python server is running
if ! kill -0 $PYTHON_PID 2>/dev/null; then
    echo "ERROR: Python audio server failed to start"
    echo "Python server logs:"
    cat /tmp/python-server.log 2>/dev/null || echo "No log file found"
    exit 1
fi

# Test if Python server is actually responding
echo "Testing Python server health..."
for i in {1..5}; do
    if curl -s http://localhost:5001/health > /dev/null 2>&1; then
        echo "✓ Python audio server is healthy on port 5001 (PID: $PYTHON_PID)"
        break
    fi
    if [ $i -eq 5 ]; then
        echo "WARNING: Python server started but health check failed"
        echo "Python server logs:"
        cat /tmp/python-server.log 2>/dev/null || echo "No log file found"
    fi
    sleep 1
done

# Start Next.js with PORT from environment
echo "Starting Next.js on port ${PORT:-3000}..."
cd /app
exec next start -p ${PORT:-3000}
