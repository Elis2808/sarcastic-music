import { NextRequest } from "next/server";
import { spawn, execFile } from "child_process";
import { promisify } from "util";
import { mkdtemp, unlink, rmdir } from "fs/promises";
import { createReadStream, existsSync, unlinkSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

export const runtime = "nodejs";
const execFileAsync = promisify(execFile);

// Hardcoded paths for Docker deployment
const YTDLP = "/usr/local/bin/yt-dlp";
const FFMPEG = "/usr/bin/ffmpeg";

// YouTube cookies from environment variable (base64 encoded)
const YOUTUBE_COOKIES = process.env.YOUTUBE_COOKIES || "";

// Write cookies to temp file for yt-dlp
function getCookieFlags(): string[] {
  if (!YOUTUBE_COOKIES) return [];
  try {
    const cookiePath = join(tmpdir(), `yt-cookies-${Date.now()}.txt`);
    const decoded = Buffer.from(YOUTUBE_COOKIES, "base64").toString("utf-8");
    writeFileSync(cookiePath, decoded);
    return ["--cookies", cookiePath];
  } catch {
    return [];
  }
}

// Multi-proxy rotating support
function getProxyList(): string[] {
  const proxies = [];
  if (process.env.PROXY_URL) {
    proxies.push(process.env.PROXY_URL);
  }
  for (let i = 1; i <= 5; i++) {
    const proxy = process.env[`PROXY_URL_${i}`];
    if (proxy) proxies.push(proxy);
  }
  return proxies;
}

const PROXY_LIST = getProxyList();
if (PROXY_LIST.length > 0) {
  console.log(`[YouTube] Loaded ${PROXY_LIST.length} proxy(s)`);
  PROXY_LIST.forEach((p, i) => {
    console.log(`[YouTube] Proxy ${i + 1}: ${p.replace(/:\/\/.*@/, "://***@")}`);
  });
}

const SUPPORTED_PLATFORMS = [
  { host: "youtube.com", name: "YouTube" },
  { host: "youtu.be", name: "YouTube" },
  { host: "tiktok.com", name: "TikTok" },
  { host: "instagram.com", name: "Instagram" },
  { host: "facebook.com", name: "Facebook" },
  { host: "fb.watch", name: "Facebook" },
  { host: "twitter.com", name: "Twitter" },
  { host: "x.com", name: "Twitter" },
  { host: "soundcloud.com", name: "SoundCloud" },
  { host: "vimeo.com", name: "Vimeo" },
  { host: "twitch.tv", name: "Twitch" },
];

function isValidUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    return SUPPORTED_PLATFORMS.some(p => host.includes(p.host));
  } catch {
    return false;
  }
}

function isYouTubeUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    return host.includes("youtube.com") || host.includes("youtu.be");
  } catch {
    return false;
  }
}

function getPlatform(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    const platform = SUPPORTED_PLATFORMS.find(p => host.includes(p.host));
    return platform?.name || "Unknown";
  } catch {
    return "Unknown";
  }
}

// Base flags optimized for speed
const BASE_FLAGS = [
  "--no-playlist",
  "--no-cache-dir",
  "--socket-timeout", "5",
  "--retries", "0",
  "--js-runtimes", "deno",
];

// Fast flags for non-YouTube platforms
const FAST_FLAGS = [
  "--no-playlist",
  "--no-cache-dir",
  "--socket-timeout", "3",
  "--retries", "0",
];

// Facebook-specific flags
const FACEBOOK_FLAGS = [
  "--no-playlist",
  "--socket-timeout", "5",
  "--retries", "0",
  "--extractor-args", "facebook:video_format=direct",
];

// User-Agent rotation for anti-bot
const USER_AGENTS = [
  "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
];

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run yt-dlp and return text output
function runYtDlpText(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(YTDLP, args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => { stdout += d.toString(); });
    proc.stderr.on("data", (d) => { stderr += d.toString(); });
    proc.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(stderr || `yt-dlp exited with code ${code}`));
      }
    });
    proc.on("error", (err) => reject(err));
  });
}

// Get video info with parallel strategy racing
async function getVideoInfoWithFallback(url: string): Promise<{ title: string; author: string; lengthSeconds: string; thumbnail: string }> {
  const platform = getPlatform(url);
  const isYouTube = platform === "YouTube";
  const isFacebook = platform === "Facebook";
  
  const strategies: { name: string; flags: string[] }[] = [];
  
  // Build strategy list
  const baseFlags = isYouTube ? BASE_FLAGS : isFacebook ? FACEBOOK_FLAGS : FAST_FLAGS;
  
  if (PROXY_LIST.length > 0 && isYouTube) {
    // Add proxy strategies for YouTube
    for (let i = 0; i < PROXY_LIST.length; i++) {
      const proxy = PROXY_LIST[i];
      const proxyFlags = ["--proxy", proxy];
      const userAgent = getRandomUserAgent();
      const cookieFlags = getCookieFlags();
      
      strategies.push(
        { name: `proxy${i + 1}+android`, flags: [...baseFlags, ...proxyFlags, ...cookieFlags, "--extractor-args", "youtube:player_client=android", "--user-agent", userAgent] },
        { name: `proxy${i + 1}+web`, flags: [...baseFlags, ...proxyFlags, ...cookieFlags, "--extractor-args", "youtube:player_client=web_embedded", "--user-agent", userAgent] },
      );
    }
  }
  
  // Add no-proxy strategies
  if (isYouTube) {
    const userAgent = getRandomUserAgent();
    const cookieFlags = getCookieFlags();
    strategies.push(
      { name: "no-proxy+android", flags: [...baseFlags, ...cookieFlags, "--extractor-args", "youtube:player_client=android", "--user-agent", userAgent] },
      { name: "no-proxy+web", flags: [...baseFlags, ...cookieFlags, "--extractor-args", "youtube:player_client=web_embedded", "--user-agent", userAgent] },
    );
  } else {
    strategies.push({ name: "no-proxy+standard", flags: [...baseFlags] });
  }

  // Try all strategies in parallel - first to succeed wins
  const attempts = strategies.map(async (strategy) => {
    try {
      console.log(`[YouTube] Trying info strategy: ${strategy.name}`);
      const args = [...strategy.flags, "--dump-single-json", url];
      const raw = await runYtDlpText(args);
      const data = JSON.parse(raw);
      
      const title = data.title || "Unknown";
      const author = data.uploader || data.channel || data.creator || "Unknown";
      const lengthSeconds = String(data.duration || 0);
      const thumbnail = data.thumbnail || (data.thumbnails?.[0]?.url) || "";
      
      if (title && title !== "Unknown") {
        console.log(`[YouTube] Info success with strategy: ${strategy.name}`);
        return { title, author, lengthSeconds, thumbnail };
      }
      throw new Error("No title found");
    } catch (err) {
      console.log(`[YouTube] Info strategy ${strategy.name} failed: ${err}`);
      throw err;
    }
  });

  try {
    return await Promise.race(attempts);
  } catch {
    throw new Error("All info strategies failed. YouTube may be blocking this server.");
  }
}

// Download with sequential fallback (to avoid spam detection)
async function downloadWithFallback(url: string, format: "mp3" | "mp4", tempPath: string): Promise<void> {
  const platform = getPlatform(url);
  const isYouTube = platform === "YouTube";
  const isFacebook = platform === "Facebook";
  
  const strategies: { name: string; flags: string[] }[] = [];
  const baseFlags = isYouTube ? BASE_FLAGS : isFacebook ? FACEBOOK_FLAGS : FAST_FLAGS;
  
  if (PROXY_LIST.length > 0 && isYouTube) {
    for (let i = 0; i < PROXY_LIST.length; i++) {
      const proxy = PROXY_LIST[i];
      const proxyFlags = ["--proxy", proxy];
      const userAgent = getRandomUserAgent();
      const cookieFlags = getCookieFlags();
      
      strategies.push(
        { name: `proxy${i + 1}+android`, flags: [...baseFlags, ...proxyFlags, ...cookieFlags, "--extractor-args", "youtube:player_client=android", "--user-agent", userAgent] },
        { name: `proxy${i + 1}+web`, flags: [...baseFlags, ...proxyFlags, ...cookieFlags, "--extractor-args", "youtube:player_client=web_embedded", "--user-agent", userAgent] },
      );
    }
  }
  
  if (isYouTube) {
    const userAgent = getRandomUserAgent();
    const cookieFlags = getCookieFlags();
    strategies.push(
      { name: "no-proxy+android", flags: [...baseFlags, ...cookieFlags, "--extractor-args", "youtube:player_client=android", "--user-agent", userAgent] },
      { name: "no-proxy+web", flags: [...baseFlags, ...cookieFlags, "--extractor-args", "youtube:player_client=web_embedded", "--user-agent", userAgent] },
    );
  } else {
    strategies.push({ name: "no-proxy+standard", flags: [...baseFlags] });
  }

  let lastError = "";
  
  // Try strategies sequentially with small delays to avoid spam detection
  for (let i = 0; i < strategies.length; i++) {
    const strategy = strategies[i];
    
    if (i > 0) {
      const delay = Math.min(1000 + i * 500, 3000); // 1s, 1.5s, 2s, 2.5s, 3s max
      console.log(`[YouTube] Waiting ${delay}ms before next attempt...`);
      await sleep(delay);
    }
    
    try {
      console.log(`[YouTube] Trying download: ${strategy.name}`);
      
      if (format === "mp3") {
        // Download video first, then extract audio
        const videoTempPath = `${tempPath}.video`;
        try {
          await execFileAsync(YTDLP, [
            ...strategy.flags,
            "-f", "best[ext=mp4]/best",
            "--no-part",
            "-o", videoTempPath,
            url,
          ], { encoding: "utf-8", timeout: 30000 });
        } catch (err: any) {
          const errStr = err.stderr || err.message || "";
          if (errStr.includes("Sign in to confirm") || errStr.includes("bot")) {
            lastError = errStr;
          }
          throw err;
        }
        
        // Extract audio with ffmpeg
        await new Promise<void>((resolve, reject) => {
          const ffmpeg = spawn(FFMPEG, [
            "-i", videoTempPath,
            "-f", "mp3",
            "-ab", "192k",
            "-vn",
            "-y",
            tempPath,
          ]);
          
          let ffmpegError = "";
          ffmpeg.stderr.on("data", (d) => { ffmpegError += d.toString(); });
          
          ffmpeg.on("close", (code) => {
            try { unlinkSync(videoTempPath); } catch {}
            if (code === 0) resolve();
            else reject(new Error(`ffmpeg failed: ${ffmpegError}`));
          });
        });
        
        console.log(`[YouTube] MP3 extracted: ${strategy.name}`);
        return;
      } else {
        // Download video directly
        try {
          await execFileAsync(YTDLP, [
            ...strategy.flags,
            "-f", "best[ext=mp4]/best",
            "--no-part",
            "-o", tempPath,
            url,
          ], { encoding: "utf-8", timeout: 30000 });
        } catch (err: any) {
          const errStr = err.stderr || err.message || "";
          if (errStr.includes("Sign in to confirm") || errStr.includes("bot")) {
            lastError = errStr;
          }
          throw err;
        }
        
        console.log(`[YouTube] Video downloaded: ${strategy.name}`);
        return;
      }
    } catch (err: any) {
      const errMsg = err?.message || err?.stderr || String(err);
      console.log(`[YouTube] Download ${strategy.name} failed: ${errMsg.slice(0, 100)}`);
    }
  }

  throw new Error(`All download strategies failed. ${lastError?.slice(0, 100) || ""}`);
}

// Info cache to avoid repeated fetches
const infoCache = new Map<string, { title: string; author: string; lengthSeconds: string; thumbnail: string; ts: number }>();
const INFO_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  
  if (!url || !isValidUrl(url)) {
    return new Response("Invalid or unsupported URL", { status: 400 });
  }

  // Check cache
  const cached = infoCache.get(url);
  if (cached && Date.now() - cached.ts < INFO_CACHE_TTL) {
    console.log(`[YouTube] Info cache hit for ${url}`);
    return Response.json(cached);
  }

  try {
    const info = await getVideoInfoWithFallback(url);
    infoCache.set(url, { ...info, ts: Date.now() });
    return Response.json(info);
  } catch (err: any) {
    console.error("[YouTube] Info error:", err);
    return new Response(err.message || "Failed to fetch video info", { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let tempDir: string | null = null;
  
  try {
    const body = await request.json();
    const { url, format } = body;

    if (!url || !isValidUrl(url)) {
      return new Response("Invalid or unsupported URL", { status: 400 });
    }
    if (!format || (format !== "mp3" && format !== "mp4")) {
      return new Response("Invalid format (must be mp3 or mp4)", { status: 400 });
    }

    // Create temp directory
    tempDir = await mkdtemp(join(tmpdir(), "yt-"));
    const tempPath = join(tempDir, `download.${format}`);

    // Download the file
    await downloadWithFallback(url, format, tempPath);

    // Verify file exists and has content
    if (!existsSync(tempPath)) {
      throw new Error("Download failed - file not created");
    }

    const stats = createReadStream(tempPath);
    
    // Return file as stream
    const fileStream = createReadStream(tempPath);
    const platform = getPlatform(url);
    
    // Clean up temp file after streaming
    fileStream.on("close", () => {
      try {
        unlinkSync(tempPath);
        if (tempDir) rmdir(tempDir).catch(() => {});
      } catch {}
    });

    return new Response(fileStream as any, {
      headers: {
        "Content-Type": format === "mp3" ? "audio/mpeg" : "video/mp4",
        "Content-Disposition": `attachment; filename="${platform.toLowerCase()}-download.${format}"`,
      },
    });
  } catch (err: any) {
    console.error("[YouTube] Download error:", err);
    
    // Clean up on error
    if (tempDir) {
      try {
        const tempPath = join(tempDir, "download.mp3");
        const videoTempPath = `${tempPath}.video`;
        if (existsSync(videoTempPath)) unlinkSync(videoTempPath);
        if (existsSync(tempPath)) unlinkSync(tempPath);
        rmdir(tempDir).catch(() => {});
      } catch {}
    }
    
    return new Response(err.message || "Download failed", { status: 500 });
  }
}
