FROM node:22.13.0

WORKDIR /app

RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    curl \
    unzip

# Install Deno (yt-dlp's preferred JavaScript runtime)
RUN curl -fsSL https://deno.land/install.sh | sh && \
    mv /root/.deno/bin/deno /usr/local/bin/deno

RUN pip3 install --break-system-packages yt-dlp

# Make yt-dlp executable
RUN chmod +x /usr/local/bin/yt-dlp

# Make start script executable
RUN chmod +x /app/start.sh

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

# Enable MPS fallback for PyTorch
ENV PYTORCH_ENABLE_MPS_FALLBACK=1

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
