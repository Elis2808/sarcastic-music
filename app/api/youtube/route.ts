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
  // Check for PROXY_URL (single proxy) or PROXY_URL_1 through PROXY_URL_5 (multiple)
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
    return host === "youtube.com" || host === "youtu.be";
  } catch {
    return false;
  }
}

// Base flags for all yt-dlp operations (using Deno as JS runtime)
const BASE_FLAGS = [
  "--no-playlist",
  "--no-cache-dir",
  "--socket-timeout", "10",
  "--retries", "1",
  "--js-runtimes", "deno",
  "--sleep-requests", "2",
  "--sleep-interval", "2",
  "--max-sleep-interval", "6",
];

// Rotating User-Agents to avoid fingerprinting
const USER_AGENTS = [
  "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Linux; Android 12; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Mobile Safari/537.36",
];

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// Exponential backoff delay
async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Fast flags for non-YouTube platforms (very low timeout for quick failure)
const FAST_FLAGS = [
  "--no-playlist",
  "--no-cache-dir",
  "--socket-timeout", "8",
  "--retries", "1",
];

// Ultra-fast flags for Facebook (no proxy, minimal extraction)
const FACEBOOK_FLAGS = [
  "--no-playlist",
  "--socket-timeout", "8",
  "--retries", "1",
  "--extractor-args", "facebook:video_format=direct",
];

// Get YouTube-specific flags to bypass bot detection
function getYouTubeFlags(url: string): string[] {
  if (!isYouTubeUrl(url)) return [];
  return ["--extractor-args", "youtube:player_client=android"];
}

// Detect platform from URL
function getPlatform(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host.includes("youtube.com") || host.includes("youtu.be")) return "youtube";
    if (host.includes("instagram.com")) return "instagram";
    if (host.includes("twitch.tv")) return "twitch";
    if (host.includes("twitter.com") || host.includes("x.com")) return "twitter";
    if (host.includes("vimeo.com")) return "vimeo";
    if (host.includes("tiktok.com")) return "tiktok";
    if (host.includes("facebook.com") || host.includes("fb.watch")) return "facebook";
    if (host.includes("soundcloud.com")) return "soundcloud";
    return "generic";
  } catch {
    return "generic";
  }
}

// Run yt-dlp and return stdout, with detailed error logging
async function runYtDlpText(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    console.log(`[yt-dlp] Running: ${YTDLP} ${args.join(" ")}`);
    const proc = spawn(YTDLP, args, { shell: false });
    let stdout = "";
    let stderr = "";
    
    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    
    proc.on("close", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        console.error(`[yt-dlp] Exit code ${code}, stderr: ${stderr}`);
        reject(new Error(`yt-dlp failed (code ${code}): ${stderr || "Unknown error"}`));
      }
    });
    
    proc.on("error", (err) => {
      console.error(`[yt-dlp] Process error:`, err);
      reject(new Error(`yt-dlp process error: ${err.message}`));
    });
  });
}

// Build proxy flags for a specific proxy
function getProxyFlags(proxyUrl: string | null): string[] {
  return proxyUrl ? ["--proxy", proxyUrl] : [];
}

// Try multiple proxies and strategies to get video info
async function getVideoInfoWithFallback(url: string): Promise<{ title: string; author: string; lengthSeconds: string; thumbnail: string }> {
  const platform = getPlatform(url);
  const isYouTube = platform === "youtube";
  
  // Generate all proxy+strategy combinations
  const strategies: { name: string; flags: string[] }[] = [];
  
  // Use fast flags for non-YouTube platforms
  const baseFlags = isYouTube ? BASE_FLAGS : FAST_FLAGS;
  
  // If we have proxies, try each one with appropriate flags
  if (PROXY_LIST.length > 0) {
    for (let i = 0; i < PROXY_LIST.length; i++) {
      const proxy = PROXY_LIST[i];
      const proxyFlags = getProxyFlags(proxy);
      
      // YouTube needs special flags - ONLY use android (not iOS - it's heavily blocked)
      if (isYouTube) {
        const userAgent = getRandomUserAgent();
        const cookieFlags = getCookieFlags();
        strategies.push(
          { name: `proxy${i + 1}+android`, flags: [...baseFlags, ...proxyFlags, ...cookieFlags, "--extractor-args", "youtube:player_client=android", "--user-agent", userAgent] },
          { name: `proxy${i + 1}+web`, flags: [...baseFlags, ...proxyFlags, ...cookieFlags, "--extractor-args", "youtube:player_client=web_embedded", "--user-agent", userAgent] },
        );
      } else {
        // Non-YouTube: just use proxy with base flags
        strategies.push(
          { name: `proxy${i + 1}+standard`, flags: [...baseFlags, ...proxyFlags] },
        );
      }
    }
  } else {
    // No proxies, try without
    if (isYouTube) {
      strategies.push(
        { name: "no-proxy+android", flags: [...baseFlags, "--extractor-args", "youtube:player_client=android"] },
        { name: "no-proxy+web", flags: [...baseFlags, "--extractor-args", "youtube:player_client=web_embedded"] },
      );
    } else {
      strategies.push(
        { name: "no-proxy+standard", flags: [...baseFlags] },
      );
    }
  }

  let attemptCount = 0;
  for (const strategy of strategies) {
    // Exponential backoff between attempts (only for YouTube)
    if (isYouTube && attemptCount > 0) {
      const delay = Math.min(5000 * attemptCount, 15000); // 5s, 10s, 15s max
      console.log(`[YouTube] Waiting ${delay}ms before next attempt...`);
      await sleep(delay);
    }
    attemptCount++;
    
    try {
      console.log(`[YouTube] Trying strategy: ${strategy.name}`);
      const args = [
        ...strategy.flags,
        "--dump-single-json",
        url,
      ];
      
      const raw = await runYtDlpText(args);
      const data = JSON.parse(raw);
      
      // Extract fields with fallbacks for different platforms
      const title = data.title || "Unknown";
      const author = data.uploader || data.channel || data.creator || "Unknown";
      const lengthSeconds = String(data.duration || 0);
      // Thumbnail can be in different places depending on platform
      const thumbnail = data.thumbnail || 
                        (data.thumbnails && data.thumbnails[0] && data.thumbnails[0].url) || 
                        "";
      
      if (title && title !== "Unknown") {
        console.log(`[YouTube] Success with strategy: ${strategy.name}`);
        console.log(`[YouTube] Thumbnail URL: ${thumbnail?.substring(0, 80)}...`);
        return { title, author, lengthSeconds, thumbnail };
      }
    } catch (err) {
      console.log(`[YouTube] Strategy ${strategy.name} failed: ${err}`);
      continue;
    }
  }

  throw new Error("All download strategies failed. YouTube is blocking this server IP. Consider using a proxy service (Webshare, BrightData, etc.)");
}

// Legacy wrapper for compatibility
async function getVideoInfo(url: string): Promise<{ title: string; author: string; lengthSeconds: string; thumbnail: string }> {
  return getVideoInfoWithFallback(url);
}

// Download with fallback strategies (rotating through all proxies)
async function downloadWithFallback(url: string, format: "mp3" | "mp4", tempPath: string): Promise<void> {
  const platform = getPlatform(url);
  const isYouTube = platform === "youtube";
  
  // Generate all proxy+strategy combinations
  const strategies: { name: string; flags: string[] }[] = [];
  
  // Use fast flags for non-YouTube platforms
  const baseFlags = isYouTube ? BASE_FLAGS : FAST_FLAGS;
  
  // If we have proxies, try each one with appropriate flags
  if (PROXY_LIST.length > 0) {
    // For non-YouTube platforms (Facebook, etc), try direct first - no proxy needed
    if (!isYouTube) {
      // Facebook: use special fast flags, single attempt (no proxy)
      if (platform === "facebook") {
        strategies.push({ name: "facebook+direct", flags: [...FACEBOOK_FLAGS] });
      } else {
        // Other non-YouTube: fast flags, direct only
        strategies.push({ name: "direct+fast", flags: [...baseFlags] });
      }
    } else {
      // YouTube: cycle through all proxies with different clients
      for (let i = 0; i < PROXY_LIST.length; i++) {
        const proxy = PROXY_LIST[i];
        const proxyFlags = getProxyFlags(proxy);
        strategies.push(
          { name: `proxy${i + 1}+android`, flags: [...baseFlags, ...proxyFlags, "--extractor-args", "youtube:player_client=android"] },
          { name: `proxy${i + 1}+web`, flags: [...baseFlags, ...proxyFlags, "--extractor-args", "youtube:player_client=web_embedded"] },
          { name: `proxy${i + 1}+ios`, flags: [...baseFlags, ...proxyFlags, "--extractor-args", "youtube:player_client=ios"] },
        );
      }
    }
  } else {
    // No proxies, try without
    if (isYouTube) {
      strategies.push(
        { name: "no-proxy+android", flags: [...baseFlags, "--extractor-args", "youtube:player_client=android"] },
        { name: "no-proxy+web", flags: [...baseFlags, "--extractor-args", "youtube:player_client=web_embedded"] },
      );
    } else {
      strategies.push(
        { name: "no-proxy+standard", flags: [...baseFlags] },
      );
    }
  }

  let lastError = "";
  
  let attemptCount = 0;
  for (const strategy of strategies) {
    // Exponential backoff between attempts (only for YouTube)
    if (isYouTube && attemptCount > 0) {
      const delay = Math.min(5000 * attemptCount, 15000);
      console.log(`[YouTube] Waiting ${delay}ms before download attempt...`);
      await sleep(delay);
    }
    attemptCount++;
    
    try {
      console.log(`[YouTube] Trying download strategy: ${strategy.name}`);
      
      if (format === "mp3") {
        // Download video first, then extract audio (avoids YouTube's audio-only blocking)
        const videoTempPath = `${tempPath}.video`;
        try {
          await execFileAsync(YTDLP, [
            ...strategy.flags,
            "-f", "best[ext=mp4]/best",
            "--no-part",
            "-o", videoTempPath,
            url,
          ], { 
            encoding: "utf-8",
            timeout: 60000, // 60 seconds per strategy
          });
        } catch (err: any) {
          const errStr = err.stderr || err.message || "";
          if (errStr.includes("Sign in to confirm") || errStr.includes("bot")) {
            lastError = errStr;
            console.log(`[YouTube] Proxy blocked, trying next...`);
          }
          throw err;
        }
        
        // Extract audio to mp3 using ffmpeg
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
            // Clean up temp video file
            try { unlinkSync(videoTempPath); } catch {}
            if (code === 0) {
              resolve();
            } else {
              console.log(`[YouTube] ffmpeg failed (code ${code}): ${ffmpegError.slice(0, 100)}`);
              reject(new Error(`ffmpeg failed (code ${code}): ${ffmpegError}`));
            }
          });
        });
        
        console.log(`[YouTube] Audio extracted to MP3 with strategy: ${strategy.name}`);
        return;
      } else {
        try {
          await execFileAsync(YTDLP, [
            ...strategy.flags,
            "-f", "best[ext=mp4]/best",
            "--no-part",
            "-o", tempPath,
            url,
          ], { 
            encoding: "utf-8",
            timeout: 60000, // 60 seconds per strategy
          });
        } catch (err: any) {
          // Check stderr in error object
          const errStr = err.stderr || err.message || "";
          if (errStr.includes("Sign in to confirm") || errStr.includes("bot")) {
            lastError = errStr;
            console.log(`[YouTube] Proxy blocked, trying next...`);
          }
          throw err; // Re-throw to trigger strategy fallback
        }
        
        console.log(`[YouTube] Video downloaded with strategy: ${strategy.name}`);
        return;
      }
    } catch (err: any) {
      const errMsg = err?.message || err?.stderr || String(err);
      console.log(`[YouTube] Download strategy ${strategy.name} failed: ${errMsg.slice(0, 100)}`);
      continue;
    }
  }
  
  throw new Error(`YouTube has blocked this server IP. The video cannot be downloaded without a residential proxy. Options: 1) Buy a proxy from Webshare/BrightData (~$5-10/month) and set PROXY_URL env var, 2) Self-host on a home server, 3) Use y2mate.is instead. Error: ${lastError?.slice(0, 100) || ""}`);
}

// Download video/audio to temp file
async function downloadToTemp(url: string, format: "mp3" | "mp4"): Promise<{ tempPath: string; safeTitle: string; cleanup: () => Promise<void> }> {
  const tempDir = await mkdtemp(join(tmpdir(), "yt-"));
  const info = await getVideoInfo(url);
  const safeTitle = info.title.replace(/[^\w\s-]/g, "").trim() || "download";
  const tempPath = join(tempDir, `download.${format}`);
  
  await downloadWithFallback(url, format, tempPath);

  const cleanup = async () => {
    try {
      await unlink(tempPath);
      await rmdir(tempDir);
    } catch {}
  };

  return { tempPath, safeTitle, cleanup };
}

// POST /api/youtube — fetch video info
export async function POST(request: NextRequest) {
  const { url } = await request.json();

  if (!url || !isValidUrl(url)) {
    return Response.json({ 
      error: "Invalid URL. Supported: YouTube, TikTok, Instagram, Facebook, Twitter/X, SoundCloud, Vimeo, Twitch" 
    }, { status: 400 });
  }

  try {
    const data = await getVideoInfo(url);
    return Response.json(data);
  } catch (error) {
    console.error("[YouTube] Info error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ 
      error: "Could not fetch video info", 
      details: message.slice(0, 500)
    }, { status: 500 });
  }
}

// GET /api/youtube?url=...&format=mp3|mp4 — download to temp then stream
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  const format = (searchParams.get("format") || "mp3") as "mp3" | "mp4";

  if (!url || !isValidUrl(url)) {
    return Response.json({ 
      error: "Invalid URL. Supported: YouTube, TikTok, Instagram, Facebook, Twitter/X, SoundCloud, Vimeo, Twitch" 
    }, { status: 400 });
  }

  let cleanup: (() => Promise<void>) | undefined;

  try {
    console.log(`[YouTube] Starting download: ${url} (${format})`);
    const { tempPath, safeTitle, cleanup: doCleanup } = await downloadToTemp(url, format);
    cleanup = doCleanup;

    console.log(`[YouTube] Downloaded to ${tempPath}, streaming...`);

    const contentType = format === "mp3" ? "audio/mpeg" : "video/mp4";
    const fileStream = createReadStream(tempPath);

    return new Response(fileStream as unknown as ReadableStream, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${safeTitle}.${format}"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[YouTube] Download error:", error);
    const message = error instanceof Error ? error.message : String(error);
    
    // Return detailed error to help debugging
    return Response.json({ 
      error: "Download failed", 
      details: message.slice(0, 500)
    }, { status: 500 });
  } finally {
    // Cleanup after a delay (allow download to start)
    if (cleanup) {
      setTimeout(() => cleanup!().catch(() => {}), 30000);
    }
  }
}
