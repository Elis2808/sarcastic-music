#!/bin/bash
# Start both Python audio server and Next.js

# Start Python audio analysis server in background
cd /app/scripts
HOST=0.0.0.0 PORT=5001 python3 key-server.py &
PYTHON_PID=$!

# Wait a moment for Python server to start
sleep 2

# Check if Python server is running
if ! kill -0 $PYTHON_PID 2>/dev/null; then
    echo "ERROR: Python audio server failed to start"
    exit 1
fi

echo "Python audio server started on port 5001 (PID: $PYTHON_PID)"

# Start Next.js
cd /app
exec npm start
