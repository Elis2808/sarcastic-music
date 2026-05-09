#!/bin/bash
# Build script for Render

# Install system dependencies
apt-get update || true
apt-get install -y ffmpeg python3-pip || true

# Install yt-dlp
pip3 install yt-dlp || pip install yt-dlp

# Install Node dependencies
npm install

# Build Next.js
npm run build

echo "Build complete!"
echo "ffmpeg: $(which ffmpeg)"
echo "yt-dlp: $(which yt-dlp)"
