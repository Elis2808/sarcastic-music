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

// Check for cookies.txt (for authenticated YouTube requests)
const COOKIES_PATH = "/app/cookies.txt";
const hasCookies = existsSync(COOKIES_PATH);
console.log(`[YouTube] Cookies file ${hasCookies ? "found" : "NOT found"} at ${COOKIES_PATH}`);

// Proxy support for bypassing IP blocks
const PROXY_URL = process.env.PROXY_URL;
if (PROXY_URL) {
  console.log(`[YouTube] Using proxy: ${PROXY_URL.replace(/:\/\/.*@/, "://***@")}`);
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

// Base flags for all yt-dlp operations
const BASE_FLAGS = [
  "--no-playlist",
  "--no-cache-dir",
  "--socket-timeout", "10",
  "--retries", "2",
  "--js-runtimes", "node",
  ...(hasCookies ? ["--cookies", COOKIES_PATH] : []),
  ...(PROXY_URL ? ["--proxy", PROXY_URL] : []),
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

// Try multiple strategies to get video info (free tier approach)
async function getVideoInfoWithFallback(url: string): Promise<{ title: string; author: string; lengthSeconds: string; thumbnail: string }> {
  const strategies = [
    // Strategy 1: With cookies + android client
    {
      name: "cookies+android",
      flags: [...BASE_FLAGS, "--extractor-args", "youtube:player_client=android"],
    },
    // Strategy 2: No cookies, android client
    {
      name: "no-cookies+android",
      flags: ["--no-playlist", "--no-cache-dir", "--socket-timeout", "10", "--retries", "2", "--js-runtimes", "node", "--extractor-args", "youtube:player_client=android"],
    },
    // Strategy 3: Web client with embedded player
    {
      name: "web+embedded",
      flags: ["--no-playlist", "--no-cache-dir", "--socket-timeout", "10", "--retries", "2", "--js-runtimes", "node", "--extractor-args", "youtube:player_client=web_embedded"],
    },
    // Strategy 4: TV client (sometimes works when others don't)
    {
      name: "tv",
      flags: ["--no-playlist", "--no-cache-dir", "--socket-timeout", "10", "--retries", "2", "--js-runtimes", "node", "--extractor-args", "youtube:player_client=tv_embedded"],
    },
    // Strategy 5: Bare minimum
    {
      name: "minimal",
      flags: ["--no-playlist", "--socket-timeout", "15"],
    },
  ];

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

// Download with fallback strategies
async function downloadWithFallback(url: string, format: "mp3" | "mp4", tempPath: string): Promise<void> {
  const strategies = [
    { name: "cookies+android", flags: [...BASE_FLAGS, "--extractor-args", "youtube:player_client=android"] },
    { name: "no-cookies+android", flags: ["--no-playlist", "--no-cache-dir", "--socket-timeout", "10", "--retries", "2", "--js-runtimes", "node", "--extractor-args", "youtube:player_client=android"] },
    { name: "web+embedded", flags: ["--no-playlist", "--no-cache-dir", "--socket-timeout", "10", "--retries", "2", "--js-runtimes", "node", "--extractor-args", "youtube:player_client=web_embedded"] },
    { name: "tv", flags: ["--no-playlist", "--no-cache-dir", "--socket-timeout", "10", "--retries", "2", "--js-runtimes", "node", "--extractor-args", "youtube:player_client=tv_embedded"] },
    { name: "minimal", flags: ["--no-playlist", "--socket-timeout", "15"] },
  ];

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
  
  throw new Error(`All download strategies failed. ${lastError?.slice(0, 200) || ""}`);
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
