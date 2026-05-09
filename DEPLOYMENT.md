# Deploy to Server with FFmpeg

## Option 1: DigitalOcean Droplet (Recommended - $6/month)

### Step 1: Create Droplet
1. Go to digitalocean.com
2. Create Droplet
3. Choose:
   - **OS:** Ubuntu 22.04
   - **Plan:** Basic, $6/month (1GB RAM)
   - **Region:** Closest to you
   - **Authentication:** SSH key (recommended) or password

### Step 2: Connect to Server
```bash
ssh root@YOUR_DROPLET_IP
```

### Step 3: Install Everything
```bash
# Update system
apt update && apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt install -y nodejs

# Install ffmpeg
apt install -y ffmpeg

# Verify installations
node --version  # Should show v20.x
ffmpeg --version  # Should show ffmpeg version
```

### Step 4: Deploy Your App
```bash
# Install git
apt install -y git

# Clone your repo (or upload files via scp)
git clone https://github.com/YOUR_USERNAME/sarcastic-music.git
# OR use SCP: scp -r /local/path root@IP:/root/sarcastic-music

cd sarcastic-music

# Install dependencies
npm install

# Build the app
npm run build

# Start the server
npm start
```

### Step 5: Keep It Running (PM2)
```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start npm --name "sarcastic-music" -- start

# Save PM2 config
pm2 save
pm2 startup

# Check status
pm2 status
pm2 logs
```

### Step 6: Add Domain (Optional)
```bash
# Install Nginx
apt install -y nginx

# Create config
nano /etc/nginx/sites-available/sarcastic-music
```

Add this:
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable:
```bash
ln -s /etc/nginx/sites-available/sarcastic-music /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx

# Get SSL certificate
certbot --nginx -d yourdomain.com
```

## Option 2: Railway/Render (Easier but more expensive)

### Railway ($5/month + usage)
1. Push code to GitHub
2. Go to railway.app
3. New Project → Deploy from GitHub
4. Add environment variable if needed
5. Railway auto-installs ffmpeg in most cases

### Render ($7/month)
1. Push code to GitHub  
2. Go to render.com
3. New Web Service
4. Connect GitHub repo
5. Build Command: `npm install && npm run build`
6. Start Command: `npm start`
7. Render has ffmpeg pre-installed

## Option 3: Self-Host (Your Own Computer)

If you have a computer that's always on:

```bash
# Install ffmpeg
# macOS:
brew install ffmpeg

# Ubuntu/Debian:
sudo apt install ffmpeg

# Windows:
# Download from ffmpeg.org and add to PATH

# Test ffmpeg
ffmpeg --version
```

Then use ngrok to expose it:
```bash
npm run dev
ngrok http 3000
```

## Environment Variables

Create `.env.local` on server:
```
# Optional: API keys for external services
# CLOUDCONVERT_API_KEY=your_key_here
```

## Updating the App

```bash
cd sarcastic-music
git pull  # or upload new files
npm install
npm run build
pm2 restart sarcastic-music
```

## Troubleshooting

**ffmpeg not found:**
```bash
which ffmpeg
# If nothing, reinstall: apt install ffmpeg
```

**Out of memory:**
- Upgrade to $12/month droplet (2GB RAM)
- Or add swap: `fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile`

**Port 3000 blocked:**
```bash
ufw allow 3000
# Or use Nginx reverse proxy
```

## Quick Start Summary

**DigitalOcean ($6/month):**
1. Create Ubuntu 22.04 droplet
2. `apt install nodejs ffmpeg git`
3. Upload/clone your code
4. `npm install && npm run build`
5. `npm start` or use PM2

**Done!** All 30 conversions now work with unlimited usage.
