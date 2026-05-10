import { NextRequest } from "next/server";
import { spawn, execFile, execSync } from "child_process";
import { promisify } from "util";
import { mkdtemp, unlink, rmdir } from "fs/promises";
import { createReadStream, existsSync, unlinkSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

export const runtime = "nodejs";
const execFileAsync = promisify(execFile);

const YTDLP = "/usr/local/bin/yt-dlp";
const FFMPEG = "/usr/bin/ffmpeg";
const YOUTUBE_COOKIES = process.env.YOUTUBE_COOKIES || "";

// Verify binaries at startup
try {
  const ytdlpVersion = execSync(`${YTDLP} --version 2>&1`).toString().trim();
  console.log(`[YouTube] yt-dlp version: ${ytdlpVersion}`);
} catch (e: any) {
  console.error(`[YouTube] CRITICAL: yt-dlp not found at ${YTDLP}:`, e.message);
  try {
    const fallback = execSync("which yt-dlp 2>&1 || echo NOT_FOUND").toString().trim();
    console.log(`[YouTube] yt-dlp fallback location: ${fallback}`);
  } catch {}
}
try {
  execSync(`${FFMPEG} -version 2>&1 | head -1`);
  console.log(`[YouTube] ffmpeg found at ${FFMPEG}`);
} catch (e: any) {
  console.error(`[YouTube] CRITICAL: ffmpeg not found at ${FFMPEG}:`, e.message);
}
console.log(`[YouTube] cookies: ${YOUTUBE_COOKIES ? "yes" : "no"}`);

// Get cookie flags from environment variable (base64 encoded)
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

// Get proxy list from environment variables (PROXY_URL, PROXY_URL_1, PROXY_URL_2, etc.)
function getProxyList(): string[] {
  const proxies: string[] = [];
  if (process.env.PROXY_URL) proxies.push(process.env.PROXY_URL);
  for (let i = 1; i <= 5; i++) {
    const proxy = process.env[`PROXY_URL_${i}`];
    if (proxy) proxies.push(proxy);
  }
  return proxies;
}

const PROXY_LIST = getProxyList();

// Log proxy count on startup
if (PROXY_LIST.length > 0) {
  console.log(`[YouTube] Loaded ${PROXY_LIST.length} proxy(s)`);
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

// Base flags for all platforms
const BASE_FLAGS = [
  "--no-playlist",
  "--no-cache-dir",
  "--socket-timeout", "5",
  "--retries", "0",
  "--js-runtimes", "deno",
];

const FAST_FLAGS = [
  "--no-playlist",
  "--no-cache-dir",
  "--socket-timeout", "3",
  "--retries", "0",
];

const FACEBOOK_FLAGS = [
  "--no-playlist",
  "--socket-timeout", "5",
  "--retries", "0",
  "--extractor-args", "facebook:video_format=direct",
];

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

function runYtDlpText(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(YTDLP, args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => { stdout += d.toString(); });
    proc.stderr.on("data", (d) => { stderr += d.toString(); });
    proc.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr || `yt-dlp exited with code ${code}`));
    });
    proc.on("error", (err) => reject(err));
  });
}

// Get video info - tries proxies sequentially until one works
async function getVideoInfoWithFallback(url: string): Promise<{ title: string; author: string; lengthSeconds: string; thumbnail: string }> {
  const platform = getPlatform(url);
  const isYouTube = platform === "YouTube";
  const isFacebook = platform === "Facebook";
  const baseFlags = isYouTube ? BASE_FLAGS : isFacebook ? FACEBOOK_FLAGS : FAST_FLAGS;
  const cookieFlags = getCookieFlags();
  
  // Build strategies: try each proxy once, then no-proxy
  const strategies: { name: string; flags: string[] }[] = [];
  
  // Try each proxy with cookies
  for (let i = 0; i < PROXY_LIST.length; i++) {
    const proxy = PROXY_LIST[i];
    const userAgent = getRandomUserAgent();
    strategies.push({
      name: `proxy${i + 1}`,
      flags: [...baseFlags, "--proxy", proxy, ...cookieFlags, "--extractor-args", "youtube:player_client=android", "--user-agent", userAgent]
    });
  }
  
  // Try no-proxy with cookies as last resort
  if (isYouTube) {
    const userAgent = getRandomUserAgent();
    strategies.push({
      name: "no-proxy",
      flags: [...baseFlags, ...cookieFlags, "--extractor-args", "youtube:player_client=android", "--user-agent", userAgent]
    });
  } else {
    strategies.push({ name: "no-proxy", flags: [...baseFlags] });
  }

  // Try sequentially
  let lastError = "";
  for (let i = 0; i < strategies.length; i++) {
    const strategy = strategies[i];
    
    if (i > 0) {
      console.log(`[YouTube] Waiting 1s before trying next strategy...`);
      await sleep(1000);
    }
    
    try {
      console.log(`[YouTube] Trying info with ${strategy.name}...`);
      const args = [...strategy.flags, "--dump-single-json", url];
      const raw = await runYtDlpText(args);
      const data = JSON.parse(raw);
      
      const result = {
        title: data.title || "Unknown",
        author: data.uploader || data.channel || data.creator || "Unknown",
        lengthSeconds: String(data.duration || 0),
        thumbnail: data.thumbnail || (data.thumbnails?.[0]?.url) || "",
      };
      
      console.log(`[YouTube] Info success with ${strategy.name}!`);
      return result;
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      console.log(`[YouTube] ${strategy.name} failed: ${errMsg.slice(0, 100)}`);
      if (errMsg.includes("bot") || errMsg.includes("Sign in")) {
        lastError = errMsg;
      }
    }
  }

  throw new Error(`All info strategies failed. ${lastError?.slice(0, 100) || ""}`);
}

// Download video - tries proxies sequentially until one works
async function downloadWithFallback(url: string, format: "mp3" | "mp4", tempPath: string): Promise<void> {
  const platform = getPlatform(url);
  const isYouTube = platform === "YouTube";
  const isFacebook = platform === "Facebook";
  const baseFlags = isYouTube ? BASE_FLAGS : isFacebook ? FACEBOOK_FLAGS : FAST_FLAGS;
  const cookieFlags = getCookieFlags();
  
  const strategies: { name: string; flags: string[] }[] = [];
  
  // Try each proxy with cookies
  for (let i = 0; i < PROXY_LIST.length; i++) {
    const proxy = PROXY_LIST[i];
    const userAgent = getRandomUserAgent();
    strategies.push({
      name: `proxy${i + 1}`,
      flags: [...baseFlags, "--proxy", proxy, ...cookieFlags, "--extractor-args", "youtube:player_client=android", "--user-agent", userAgent]
    });
  }
  
  // Try no-proxy with cookies
  if (isYouTube) {
    const userAgent = getRandomUserAgent();
    strategies.push({
      name: "no-proxy",
      flags: [...baseFlags, ...cookieFlags, "--extractor-args", "youtube:player_client=android", "--user-agent", userAgent]
    });
  } else {
    strategies.push({ name: "no-proxy", flags: [...baseFlags] });
  }

  let lastError = "";
  
  for (let i = 0; i < strategies.length; i++) {
    const strategy = strategies[i];
    
    if (i > 0) {
      const delay = Math.min(1000 + i * 500, 3000);
      console.log(`[YouTube] Waiting ${delay}ms before next download attempt...`);
      await sleep(delay);
    }
    
    try {
      console.log(`[YouTube] Trying download with ${strategy.name}...`);
      
      if (format === "mp3") {
        const videoTempPath = `${tempPath}.video`;
        try {
          await execFileAsync(YTDLP, [...strategy.flags, "-f", "best[ext=mp4]/best", "--no-part", "-o", videoTempPath, url], { encoding: "utf-8", timeout: 30000 });
        } catch (err: any) {
          const errStr = err.stderr || err.message || "";
          if (errStr.includes("Sign in to confirm") || errStr.includes("bot")) {
            lastError = errStr;
          }
          throw err;
        }
        
        await new Promise<void>((resolve, reject) => {
          const ffmpeg = spawn(FFMPEG, ["-i", videoTempPath, "-f", "mp3", "-ab", "192k", "-vn", "-y", tempPath]);
          let ffmpegError = "";
          ffmpeg.stderr.on("data", (d) => { ffmpegError += d.toString(); });
          ffmpeg.on("close", (code) => {
            try { unlinkSync(videoTempPath); } catch {}
            if (code === 0) resolve();
            else reject(new Error(`ffmpeg failed: ${ffmpegError}`));
          });
        });
        
        console.log(`[YouTube] MP3 download success with ${strategy.name}!`);
        return;
      } else {
        try {
          await execFileAsync(YTDLP, [...strategy.flags, "-f", "best[ext=mp4]/best", "--no-part", "-o", tempPath, url], { encoding: "utf-8", timeout: 30000 });
        } catch (err: any) {
          const errStr = err.stderr || err.message || "";
          if (errStr.includes("Sign in to confirm") || errStr.includes("bot")) {
            lastError = errStr;
          }
          throw err;
        }
        
        console.log(`[YouTube] Video download success with ${strategy.name}!`);
        return;
      }
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      console.log(`[YouTube] ${strategy.name} failed: ${errMsg.slice(0, 100)}`);
    }
  }

  throw new Error(`All download strategies failed. ${lastError?.slice(0, 100) || ""}`);
}

const infoCache = new Map<string, { title: string; author: string; lengthSeconds: string; thumbnail: string; ts: number }>();
const INFO_CACHE_TTL = 5 * 60 * 1000;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  
  if (!url || !isValidUrl(url)) {
    return new Response("Invalid or unsupported URL", { status: 400 });
  }

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

    tempDir = await mkdtemp(join(tmpdir(), "yt-"));
    const tempPath = join(tempDir, `download.${format}`);

    await downloadWithFallback(url, format, tempPath);

    if (!existsSync(tempPath)) {
      throw new Error("Download failed - file not created");
    }

    const fileStream = createReadStream(tempPath);
    const platform = getPlatform(url);
    
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
    if (tempDir) {
      try {
        rmdir(tempDir, { recursive: true }).catch(() => {});
      } catch {}
    }
    return new Response(err.message || "Download failed", { status: 500 });
  }
}
