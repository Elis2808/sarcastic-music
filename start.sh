#!/bin/bash
# Minimal startup - Next.js only. Python runs on-demand via subprocesses.

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

exec next start -p ${PORT:-3000}
