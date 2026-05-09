FROM node:22.13.0

WORKDIR /app

RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    curl

RUN pip3 install --break-system-packages yt-dlp

# Upgrade pip
RUN pip3 install --no-cache-dir --upgrade pip --break-system-packages

COPY package*.json ./
COPY requirements.txt ./

RUN npm install

# Copy cookies.txt for YouTube authentication
COPY app/cookies.txt /app/cookies.txt

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
