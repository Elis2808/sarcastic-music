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

# Install Python dependencies (BPM/key analysis — no demucs/torch needed)
RUN pip3 install --no-cache-dir \
    -r requirements.txt \
    --break-system-packages

# Install curl_cffi for yt-dlp browser impersonation (needed for Vimeo etc.)
RUN pip3 install --no-cache-dir curl_cffi --break-system-packages

COPY . .

# Copy pdfjs worker to public so it's served at /pdf.worker.min.mjs
RUN cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs public/pdf.worker.min.mjs

# Make start script executable (must be after COPY)
RUN chmod +x /app/start.sh

RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
