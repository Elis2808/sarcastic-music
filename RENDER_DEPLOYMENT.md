# Deploy to Render - Complete Guide

This guide covers deploying the sarcastic-music app to Render with full functionality including audio analysis and YouTube downloading.

## Architecture

The app runs as a **single Docker container** with both services:
- **Next.js web app** on port 3000
- **Python audio analysis server** on port 5001 (internal)

## Prerequisites

- GitHub account with your code pushed
- Render account (free tier works)

## Step-by-Step Deployment

### 1. Push Your Code to GitHub

```bash
git add .
git commit -m "Prepare for Render deployment"
git push origin main
```

### 2. Create Render Web Service

1. Go to [render.com](https://render.com) and sign in
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Configure:
   - **Name**: `sarcastic-music` (or your choice)
   - **Runtime**: `Docker`
   - **Plan**: Starter ($7/month minimum for audio processing)
   
   > ⚠️ **Important**: The free plan won't work for audio processing (demucs/essentia need more resources). Use at least the Starter plan ($7/month).

5. Click **"Create Web Service"**

### 3. Set Environment Variables

In your Render dashboard, go to **Environment** tab and add:

| Variable | Value | Required |
|----------|-------|----------|
| `PYTHON_API_URL` | `http://localhost:5001` | ✅ Yes |
| `NODE_ENV` | `production` | ✅ Yes |
| `CRON_SECRET` | (generate random string) | Optional |

To generate a random CRON_SECRET:
```bash
openssl rand -base64 32
```

### 4. Deploy

Render will automatically:
1. Build the Docker image (5-10 minutes)
2. Install Node.js + Python dependencies
3. Install ffmpeg and yt-dlp
4. Start both services

Monitor the logs for any errors.

---

## Post-Deployment Verification

Once deployed, verify these features work:

### 1. Basic App
Visit your `https://<app-name>.onrender.com` - the homepage should load.

### 2. Audio Analysis (Key/BPM Detection)
Upload an audio file to test key and BPM detection.

### 3. Stem Separation (Voice Remover)
Upload a song and try removing vocals. This uses demucs and takes ~30-60 seconds.

### 4. YouTube Downloader
Paste a YouTube URL and test downloading audio/video.

### 5. File Conversions
Try the various file format conversions.

### 6. Rap Dictionary & Rhymes
Test the text-based features (these don't need the Python server).

---

## Updating the yt-dlp Binary

YouTube frequently changes their API. When downloads stop working:

1. Go to Render dashboard → **Shell** tab
2. Run:
```bash
pip3 install -U yt-dlp
```
3. Or trigger the update endpoint (if you set CRON_SECRET):
```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://your-app.onrender.com/api/cron/update-ytdlp
```

---

## Troubleshooting

### "Analysis server is not running" Error

The Python server didn't start. Check logs:
- Look for Python import errors (librosa/essentia/demucs)
- Make sure `HOST=0.0.0.0` is set in start.sh

### Out of Memory During Stem Separation

Demucs is memory-intensive. Upgrade your Render plan:
- Starter ($7): Works for short songs (< 5 min)
- Standard ($25): Better for longer songs

### YouTube Downloads Failing

1. Check yt-dlp version in logs
2. Update yt-dlp (see above)
3. Some videos may be geo-restricted or require cookies

### "ffmpeg not found"

Should be installed automatically. If missing:
```bash
# In Render Shell
apt-get update && apt-get install -y ffmpeg
```

### Port Already in Use

Make sure nothing else uses port 5001. The `start.sh` script handles this.

---

## Alternative: Deploy Python Server Separately

If you want to scale the audio processing independently:

1. Deploy Python server as a separate Render Web Service
2. Update `PYTHON_API_URL` to point to that service's URL
3. Remove the Python server startup from `start.sh`

---

## Files Changed for Deployment

These files were created/modified:
- `Dockerfile` - Multi-service container
- `render.yaml` - Render configuration
- `start.sh` - Startup script
- `requirements.txt` - Python dependencies
- `app/api/youtube/route.ts` - Uses env vars for paths
- `app/api/cron/update-ytdlp/route.ts` - Uses env vars for paths
- `app/api/detect-key/route.ts` - Uses PYTHON_API_URL
- `app/api/detect-bpm/route.ts` - Uses PYTHON_API_URL
- `app/api/separate/route.ts` - Uses PYTHON_API_URL
- `scripts/key-server.py` - Uses env vars for host/port/demucs

---

## Cost Estimate

| Plan | Price | Suitable For |
|------|-------|--------------|
| Free | $0 | ❌ Won't work (insufficient RAM for demucs) |
| Starter | $7/mo | ✅ Short songs, light usage |
| Standard | $25/mo | ✅ Longer songs, frequent usage |

---

## Next Steps

After successful deployment:
1. Add a custom domain (optional)
2. Set up monitoring (Render has built-in metrics)
3. Configure auto-deploy on git push

---

**Need help?** Check Render's [documentation](https://render.com/docs) or the app logs in the dashboard.
