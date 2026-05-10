FROM node:22.13.0

WORKDIR /app

RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    curl \
    unzip \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install yt-dlp as standalone binary (most reliable method) + update to latest
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod +x /usr/local/bin/yt-dlp \
    && yt-dlp -U \
    && yt-dlp --version

# Install Deno (used by yt-dlp for JS extraction)
RUN curl -fsSL https://deno.land/install.sh | sh && \
    mv /root/.deno/bin/deno /usr/local/bin/deno

# Upgrade pip
RUN pip3 install --no-cache-dir --upgrade pip --break-system-packages

COPY package*.json ./
COPY requirements.txt ./

RUN npm install

# Install CPU-only PyTorch first (prevents CUDA packages)
RUN pip3 install --no-cache-dir \
    --index-url https://download.pytorch.org/whl/cpu \
    torch==2.7.1+cpu torchaudio==2.7.1+cpu \
    --break-system-packages

# Install remaining Python dependencies
RUN pip3 install --no-cache-dir \
    -r requirements.txt \
    --break-system-packages

# Pre-download htdemucs model weights at build time (prevents runtime download timeout/crash)
RUN printf '%s\n' \
    'import os' \
    'os.environ["OMP_NUM_THREADS"] = "1"' \
    'os.environ["MKL_NUM_THREADS"] = "1"' \
    'try:' \
    '    from demucs.pretrained import get_model' \
    '    get_model("htdemucs")' \
    '    print("htdemucs model downloaded successfully")' \
    'except Exception as e:' \
    '    print("Warning: model pre-download failed:", e)' \
    > /tmp/preload_model.py && python3 /tmp/preload_model.py

# Memory optimization env vars
ENV PYTORCH_ENABLE_MPS_FALLBACK=1
ENV OMP_NUM_THREADS=1
ENV MKL_NUM_THREADS=1
ENV MALLOC_TRIM_THRESHOLD_=100000

COPY . .

# Make start script executable (must be after COPY)
RUN chmod +x /app/start.sh

RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
