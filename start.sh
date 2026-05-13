#!/bin/bash
# Start audio server (persistent Python) + Next.js

echo "=== Sarcastic Music Starting ==="
echo "Date: $(date)"
echo "Node: $(node --version 2>/dev/null || echo 'not found')"
echo "Python: $(python3 --version 2>/dev/null || echo 'not found')"
echo "yt-dlp: $(yt-dlp --version 2>/dev/null || echo 'not found')"
echo "ffmpeg: $(ffmpeg -version 2>/dev/null | head -1 || echo 'not found')"
echo "demucs: $(demucs --version 2>/dev/null || python3 -c 'import demucs; print(demucs.__version__)' 2>/dev/null || echo 'not found')"
echo "RAM: $(free -m 2>/dev/null | awk '/Mem:/{print $2"MB total, "$7"MB available"}' || echo 'unknown')"
echo "PORT: ${PORT:-3000}"
echo "================================"

# Start persistent audio analysis server in background
echo "[start.sh] Starting audio server on port 5001..."
python3 /app/audio_server.py &
AUDIO_PID=$!

# Wait up to 30s for audio server to be ready
for i in $(seq 1 30); do
  if curl -sf http://localhost:5001/health > /dev/null 2>&1; then
    echo "[start.sh] Audio server ready."
    break
  fi
  sleep 1
done

WEB_CONCURRENCY=1 exec next start -p ${PORT:-3000}
