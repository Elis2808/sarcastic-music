FROM node:22.13.0

WORKDIR /app

RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    curl

RUN pip3 install --break-system-packages yt-dlp

COPY package*.json ./

RUN npm install

# Copy cookies.txt for YouTube authentication
COPY app/cookies.txt /app/cookies.txt

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
