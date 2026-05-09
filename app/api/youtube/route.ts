import { NextRequest } from "next/server";
import { spawn, execFile } from "child_process";
import { promisify } from "util";
import { mkdtemp, unlink, rmdir } from "fs/promises";
import { createReadStream, existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

export const runtime = "nodejs";
const execFileAsync = promisify(execFile);

// Hardcoded paths for Docker deployment
const YTDLP = "/usr/local/bin/yt-dlp";
const FFMPEG = "/usr/bin/ffmpeg";

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
  "--retries", "2",
  "--js-runtimes", "deno",
];

// Get YouTube-specific flags to bypass bot detection
function getYouTubeFlags(url: string): string[] {
  if (!isYouTubeUrl(url)) return [];
  return ["--extractor-args", "youtube:player_client=android"];
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
  // Generate all proxy+strategy combinations
  const strategies: { name: string; flags: string[] }[] = [];
  
  // If we have proxies, try each one with different clients
  if (PROXY_LIST.length > 0) {
    for (let i = 0; i < PROXY_LIST.length; i++) {
      const proxy = PROXY_LIST[i];
      const proxyFlags = getProxyFlags(proxy);
      
      strategies.push(
        { name: `proxy${i + 1}+android`, flags: [...BASE_FLAGS, ...proxyFlags, "--extractor-args", "youtube:player_client=android"] },
        { name: `proxy${i + 1}+web`, flags: [...BASE_FLAGS, ...proxyFlags, "--extractor-args", "youtube:player_client=web_embedded"] },
        { name: `proxy${i + 1}+ios`, flags: [...BASE_FLAGS, ...proxyFlags, "--extractor-args", "youtube:player_client=ios"] },
      );
    }
  } else {
    // No proxies, try without
    strategies.push(
      { name: "no-proxy+android", flags: [...BASE_FLAGS, "--extractor-args", "youtube:player_client=android"] },
      { name: "no-proxy+web", flags: [...BASE_FLAGS, "--extractor-args", "youtube:player_client=web_embedded"] },
    );
  }

  for (const strategy of strategies) {
    try {
      console.log(`[YouTube] Trying strategy: ${strategy.name}`);
      const args = [
        ...strategy.flags,
        "--print", "%(title)s\n%(uploader)s\n%(duration)s\n%(thumbnail)s",
        url,
      ];
      
      const raw = await runYtDlpText(args);
      const [title, author, lengthSeconds, thumbnail] = raw.split("\n");
      
      if (title) {
        console.log(`[YouTube] Success with strategy: ${strategy.name}`);
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
  // Generate all proxy+strategy combinations
  const strategies: { name: string; flags: string[] }[] = [];
  
  // If we have proxies, try each one with different clients
  if (PROXY_LIST.length > 0) {
    for (let i = 0; i < PROXY_LIST.length; i++) {
      const proxy = PROXY_LIST[i];
      const proxyFlags = getProxyFlags(proxy);
      
      strategies.push(
        { name: `proxy${i + 1}+android`, flags: [...BASE_FLAGS, ...proxyFlags, "--extractor-args", "youtube:player_client=android"] },
        { name: `proxy${i + 1}+web`, flags: [...BASE_FLAGS, ...proxyFlags, "--extractor-args", "youtube:player_client=web_embedded"] },
        { name: `proxy${i + 1}+ios`, flags: [...BASE_FLAGS, ...proxyFlags, "--extractor-args", "youtube:player_client=ios"] },
      );
    }
  } else {
    // No proxies, try without
    strategies.push(
      { name: "no-proxy+android", flags: [...BASE_FLAGS, "--extractor-args", "youtube:player_client=android"] },
      { name: "no-proxy+web", flags: [...BASE_FLAGS, "--extractor-args", "youtube:player_client=web_embedded"] },
    );
  }

  let lastError = "";
  
  for (const strategy of strategies) {
    try {
      console.log(`[YouTube] Trying download strategy: ${strategy.name}`);
      
      if (format === "mp3") {
        const { stdout, stderr } = await execFileAsync(YTDLP, [
          ...strategy.flags,
          "-f", "bestaudio",
          "--no-part",
          "-o", "-",
          url,
        ], { 
          encoding: "buffer",
          maxBuffer: 100 * 1024 * 1024,
          timeout: 180000,
        });
        
        if (stderr) {
          const errText = stderr.toString();
          if (errText.includes("Sign in to confirm") || errText.includes("bot")) {
            lastError = errText;
            throw new Error("Bot detection");
          }
        }
        
        // Convert to mp3 using ffmpeg
        await new Promise<void>((resolve, reject) => {
          const ffmpeg = spawn(FFMPEG, [
            "-i", "pipe:0",
            "-f", "mp3",
            "-ab", "192k",
            "-vn",
            tempPath,
          ]);
          
          ffmpeg.stdin.write(stdout);
          ffmpeg.stdin.end();
          
          let ffmpegError = "";
          ffmpeg.stderr.on("data", (d) => { ffmpegError += d.toString(); });
          
          ffmpeg.on("close", (code) => {
            if (code === 0) resolve();
            else reject(new Error(`ffmpeg failed (code ${code}): ${ffmpegError}`));
          });
        });
        
        console.log(`[YouTube] Audio converted to MP3 with strategy: ${strategy.name}`);
        return;
      } else {
        const { stderr } = await execFileAsync(YTDLP, [
          ...strategy.flags,
          "-f", "best[ext=mp4]/best",
          "--no-part",
          "-o", tempPath,
          url,
        ], { 
          encoding: "utf-8",
          timeout: 180000,
        });
        
        if (stderr && (stderr.includes("Sign in to confirm") || stderr.includes("bot"))) {
          lastError = stderr;
          throw new Error("Bot detection");
        }
        
        console.log(`[YouTube] Video downloaded with strategy: ${strategy.name}`);
        return;
      }
    } catch (err) {
      console.log(`[YouTube] Download strategy ${strategy.name} failed`);
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
