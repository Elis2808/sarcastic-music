# Multi-service container for sarcastic-music
FROM node:20-slim

# Install Python and system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install yt-dlp via official release (more reliable than pip)
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp && \
    /usr/local/bin/yt-dlp --version

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
RUN npm install

# Copy requirements and install Python dependencies
COPY requirements.txt ./
RUN pip3 install -r requirements.txt --break-system-packages

# Copy the rest of the application
COPY . .

# Build Next.js
RUN npm run build

# Make startup script executable
RUN chmod +x /app/start.sh

# Expose the Next.js port
EXPOSE 3000

# Start both services
CMD ["/app/start.sh"]
